import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User } from '@/lib/api';
import { api } from '@/lib/api';
import {
  createMagicSessionUser,
  isMagicCredentials,
  isMagicToken,
  makeMagicToken,
  MAGIC_USER_STORAGE_KEY,
} from '@/lib/auth-magic-bypass';

function decodeTokenPayload(token: string): { user_id?: string; role?: string; exp?: number } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payloadB64Url = parts[1];
    const payloadB64 = payloadB64Url.replace(/-/g, '+').replace(/_/g, '/');
    const pad = payloadB64.length % 4;
    const padded = pad ? payloadB64 + '='.repeat(4 - pad) : payloadB64;
    const json = atob(padded);
    const payload = JSON.parse(json) as { user_id?: string; role?: string; exp?: number };
    if (!payload || typeof payload !== 'object') return null;
    return payload;
  } catch {
    return null;
  }
}

export interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  /** Per-customer price augmentation % (0-100). 0 = no augmentation. */
  priceAugmentationPercent: number;
  /** Per-product augmentation overrides { productId: percent }. */
  productAugmentations: Record<string, number>;
  /** True when the logged-in customer has a validated contract. */
  isContractCustomer: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  register: (email: string, password: string, full_name: string, phone?: string) => Promise<User>;
  updateProfile: (data: Partial<User>) => Promise<User>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AUTH_TOKEN_KEY_STOREFRONT = 'remquip_auth_token';
export const AUTH_TOKEN_KEY_ADMIN = 'remquip_admin_token';

interface AuthProviderProps {
  children: React.ReactNode;
  tokenKey?: string;
}

export function AuthProvider({ children, tokenKey = AUTH_TOKEN_KEY_STOREFRONT }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [priceAugmentationPercent, setPriceAugmentationPercent] = useState(0);
  const [productAugmentations, setProductAugmentations] = useState<Record<string, number>>({});
  const [isContractCustomer, setIsContractCustomer] = useState(false);

  // Initialize auth state from localStorage
  useEffect(() => {
    const initializeAuth = async () => {
      const TOKEN_KEY = tokenKey;
      let storedToken: string | null = null;
      try {
        storedToken = localStorage.getItem(TOKEN_KEY);
        if (storedToken && isMagicToken(storedToken)) {
          setToken(storedToken);
          const raw = localStorage.getItem(MAGIC_USER_STORAGE_KEY);
          if (raw) {
            setUser(JSON.parse(raw) as User);
          } else {
            setUser(createMagicSessionUser());
          }
          return;
        }
        if (storedToken) {
          const tokenAtStart = storedToken;
          setToken(tokenAtStart);

          // Immediately set a fallback user from token claims so admin access
          // doesn't disappear if profile fetch fails temporarily.
          const decoded = decodeTokenPayload(tokenAtStart);
          if (decoded?.user_id && decoded?.role) {
            setUser({
              id: String(decoded.user_id),
              email: '',
              full_name: '',
              role: decoded.role as User['role'],
              status: 'active',
              created_at: '',
              updated_at: '',
            });
          }

          // Verify token is still valid by fetching current user.
          // If it fails with 401, remove the token; otherwise keep fallback.
          try {
            const response = await api.getProfile({ skipAuthRedirect: true });
            if (response.data) {
              setUser(response.data);
              setPriceAugmentationPercent(Number((response.data as any).price_augmentation_percent ?? 0));
              const rd = response.data as any;
              setIsContractCustomer(
                rd.contract_validated === true && rd.customer_category === 'contract'
              );
              const pa = rd.product_augmentations;
              if (pa && typeof pa === 'object' && !Array.isArray(pa)) {
                setProductAugmentations(
                  Object.fromEntries(Object.entries(pa).map(([k, v]) => [k, Number(v)]))
                );
              }
            }
          } catch (err: any) {
            const statusCode = err?.statusCode ?? err?.response?.status;
            const currentToken = localStorage.getItem(TOKEN_KEY);
            // Race protection: only clear token if the token that failed is still current.
            // IMPORTANT: Do NOT clear token here. Keeping the session prevents
            // "missing token" loops if the profile endpoint is temporarily failing
            // or if a parallel redirect race occurs. Admin/backend endpoints will
            // still enforce permissions if the token truly is invalid.
            // For network/5xx issues, keep fallback user + token.
          }
        }

      } catch {
        const currentToken = localStorage.getItem(tokenKey);
        if (storedToken && currentToken === storedToken) {
          localStorage.removeItem(tokenKey);
        }
        localStorage.removeItem(MAGIC_USER_STORAGE_KEY);
        // Only clear state if the token we were validating is still the active token.
        if (storedToken && currentToken === storedToken) {
          setToken(null);
          setUser(null);
        }
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, [tokenKey]);

  const login = useCallback(async (email: string, password: string): Promise<User> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.login(email, password);
      
      if (response.data?.token && response.data?.user) {
        setToken(response.data.token);
        setUser(response.data.user);
        setPriceAugmentationPercent(0);
        setProductAugmentations({});
        setIsContractCustomer(false);
        localStorage.setItem(tokenKey, response.data.token);

        try {
          const profile = await api.getProfile({ skipAuthRedirect: true });
          if (profile.data) {
            const fullUser = profile.data as User;
            setUser(fullUser);
            setPriceAugmentationPercent(Number((profile.data as any).price_augmentation_percent ?? 0));
            const rd = profile.data as any;
            setIsContractCustomer(
              rd.contract_validated === true && rd.customer_category === 'contract'
            );
            const pa = rd.product_augmentations;
            if (pa && typeof pa === 'object' && !Array.isArray(pa)) {
              setProductAugmentations(
                Object.fromEntries(Object.entries(pa).map(([k, v]) => [k, Number(v)]))
              );
            } else {
              setProductAugmentations({});
            }
            return fullUser;
          }
        } catch {}

        return response.data.user;
      }
      throw new Error('Invalid login response');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Login failed';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [tokenKey]);

  const logout = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await api.logout();
    } catch {
      // Still clear local state even if API call fails
    } finally {
      setToken(null);
      setUser(null);
      setPriceAugmentationPercent(0);
      setProductAugmentations({});
      setIsContractCustomer(false);
      localStorage.removeItem(tokenKey);
      setIsLoading(false);
    }
  }, [tokenKey]);

  const register = useCallback(async (
    email: string,
    password: string,
    full_name: string,
    phone?: string
  ): Promise<User> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.register({
        email,
        password,
        full_name,
        phone,
      });

      if (response.data?.token && response.data?.user) {
        setToken(response.data.token);
        setUser(response.data.user);
        setPriceAugmentationPercent(0);
        setProductAugmentations({});
        setIsContractCustomer(false);
        localStorage.setItem(tokenKey, response.data.token);
        
        try {
          const profile = await api.getProfile({ skipAuthRedirect: true });
          if (profile.data) {
            const fullUser = profile.data as User;
            setUser(fullUser);
            setPriceAugmentationPercent(Number((profile.data as any).price_augmentation_percent ?? 0));
            const rd = profile.data as any;
            setIsContractCustomer(
              rd.contract_validated === true && rd.customer_category === 'contract'
            );
            const pa = rd.product_augmentations;
            if (pa && typeof pa === 'object' && !Array.isArray(pa)) {
              setProductAugmentations(
                Object.fromEntries(Object.entries(pa).map(([k, v]) => [k, Number(v)]))
              );
            } else {
              setProductAugmentations({});
            }
            return fullUser;
          }
        } catch {}
        
        return response.data.user;
      }
      throw new Error('Invalid registration response');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Registration failed';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [tokenKey]);

  const updateProfile = useCallback(async (data: Partial<User>): Promise<User> => {
    setError(null);
    try {
      if (!user?.id) throw new Error('User not authenticated');
      const response = await api.updateUser(user.id, data);

      // Backend returns the updated user object. Guard against empty array
      // responses (legacy) which would corrupt auth state.
      const returned = response.data;
      if (returned && !Array.isArray(returned) && typeof returned === 'object' && (returned as any).id) {
        setUser(returned as User);
        return returned as User;
      }

      // Fallback: merge the changes into the existing user state so the UI
      // reflects what was saved without losing auth context.
      const merged = { ...user!, ...data };
      setUser(merged);
      return merged;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Update failed';
      setError(errorMessage);
      throw err;
    }
  }, [user]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value: AuthContextType = {
    user,
    token,
    isLoading,
    error,
    isAuthenticated: !!token && !!user,
    priceAugmentationPercent,
    productAugmentations,
    isContractCustomer,
    login,
    logout,
    register,
    updateProfile,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

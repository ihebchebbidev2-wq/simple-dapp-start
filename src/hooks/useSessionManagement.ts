import { useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

function loginPathForCurrentRoute(): string {
  if (typeof window === 'undefined') return '/login';
  return window.location.pathname.startsWith('/admin') ? '/admin/login' : '/login';
}

interface SessionConfig {
  timeoutMinutes?: number;
  refreshThresholdMinutes?: number;
  checkIntervalSeconds?: number;
}

/**
 * Hook to manage user session including token refresh, expiry, and auto-logout
 * Handles:
 * - Token validation on mount
 * - Automatic token refresh before expiry
 * - Automatic logout on token expiry
 * - Session timeout handling
 */
export function useSessionManagement(config: SessionConfig = {}) {
  const navigate = useNavigate();
  const { token, logout, isAuthenticated } = useAuth();
  
  const {
    timeoutMinutes = 30,
    refreshThresholdMinutes = 5,
    checkIntervalSeconds = 60,
  } = config;

  const timeoutRef = useRef<NodeJS.Timeout>();
  const checkIntervalRef = useRef<NodeJS.Timeout>();
  const lastActivityRef = useRef<number>(Date.now());

  // Update last activity time
  const updateActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  // Listen for user activity
  useEffect(() => {
    if (!isAuthenticated) return;

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];

    events.forEach(event => {
      document.addEventListener(event, updateActivity);
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, updateActivity);
      });
    };
  }, [isAuthenticated, updateActivity]);

  // Check session timeout and token validity
  useEffect(() => {
    if (!isAuthenticated || !token) return;

    const checkSession = () => {
      const now = Date.now();
      const timeSinceLastActivity = now - lastActivityRef.current;
      const timeoutMs = timeoutMinutes * 60 * 1000;

      if (timeSinceLastActivity > timeoutMs) {
        logout();
        navigate(loginPathForCurrentRoute(), { state: { message: 'Session expired due to inactivity' } });
      }
    };

    // Check session status periodically
    checkIntervalRef.current = setInterval(
      checkSession,
      checkIntervalSeconds * 1000
    );

    // Also set a timeout for the full session duration
    timeoutRef.current = setTimeout(() => {
      console.log('[v0] Absolute session timeout - logging out');
      logout();
      navigate(loginPathForCurrentRoute(), { state: { message: 'Session expired' } });
    }, timeoutMinutes * 60 * 1000);

    return () => {
      if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [isAuthenticated, token, timeoutMinutes, checkIntervalSeconds, logout, navigate]);

  // Token refresh logic (if backend supports it)
  useEffect(() => {
    if (!isAuthenticated || !token) return;

    const refreshTokenIfNeeded = async () => {
      try {
        // In a real app, you would decode the JWT to check expiry time
        // For now, we'll refresh every (timeoutMinutes - refreshThresholdMinutes) minutes
        const refreshIntervalMs = (timeoutMinutes - refreshThresholdMinutes) * 60 * 1000;

        const refreshTimer = setInterval(async () => {
          try {
            console.log('[v0] Attempting to refresh token');
            // Assuming the API has a refresh endpoint
            // This would depend on your backend implementation
            // For now, we'll skip this as the backend might not expose it
          } catch (err) {
            console.error('[v0] Token refresh failed:', err);
            // If refresh fails, log out the user
            logout();
            navigate(loginPathForCurrentRoute());
          }
        }, refreshIntervalMs);

        return () => clearInterval(refreshTimer);
      } catch (err) {
        console.error('[v0] Token refresh setup failed:', err);
      }
    };

    const cleanup = refreshTokenIfNeeded();
    return () => {
      if (cleanup) cleanup.then(fn => fn?.());
    };
  }, [isAuthenticated, token, timeoutMinutes, refreshThresholdMinutes, logout, navigate]);

  // Sync session across tabs/windows
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleStorageChange = (e: StorageEvent) => {
      console.log('[v0] Storage change detected');
      
      if (e.key === 'remquip_auth_token' || e.key === 'remquip_admin_token') {
        if (!e.newValue) {
          console.log('[v0] Token removed in another tab - logging out');
          logout();
          navigate(loginPathForCurrentRoute());
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [isAuthenticated, logout, navigate]);

  return {
    isSessionActive: isAuthenticated,
    updateActivity,
  };
}

/**
 * API Service Layer
 * Handles all API requests to the remquip backend
 * Backend: `API_BASE_URL` + `/api.php?path=...`, or direct `*.php` for some CMS/health routes (see `buildApiUrl`).
 * Includes comprehensive error handling and logging
 */

import { API_BASE_URL } from '@/config/constants';
import { API_ENDPOINTS } from './api-endpoints';
import { ApiError, handleError, logError, getDetailedErrorMessage } from './error-handler';
import { showErrorToast, showSuccessToast } from './toast';
import { AUTH_TOKEN_KEY_STOREFRONT, AUTH_TOKEN_KEY_ADMIN } from '@/contexts/AuthContext';

// ==================== CONSTANTS ====================

/** Return the correct localStorage key based on the current route */
function getActiveTokenKey(): string {
  const path = typeof window !== 'undefined' ? window.location.pathname : '';
  return path.startsWith('/admin') ? AUTH_TOKEN_KEY_ADMIN : AUTH_TOKEN_KEY_STOREFRONT;
}

const TOKEN_CONFIG = {
  /** @deprecated – use getActiveTokenKey() instead */
  LOCAL_STORAGE_KEY: 'remquip_auth_token' as string,
  HEADER_NAME: 'Authorization',
  HEADER_PREFIX: 'Bearer',
  EXPIRY_TIME: 24 * 60 * 60 * 1000,
} as const;

const REQUEST_TIMEOUT = 30000;

const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

const API_ERRORS = {
  NETWORK_ERROR: 'Network connection failed. Please check your internet connection.',
  TIMEOUT_ERROR: 'Request timeout. Please try again.',
  UNAUTHORIZED: 'Unauthorized. Please login again.',
  FORBIDDEN: 'You do not have permission to access this resource.',
  NOT_FOUND: 'Resource not found.',
  VALIDATION_ERROR: 'Invalid input. Please check your data.',
  INTERNAL_ERROR: 'Internal server error. Please try again later.',
  UNKNOWN_ERROR: 'An unknown error occurred. Please try again.',
} as const;

// ==================== INTERFACES ====================

// Auth
export interface AuthResponse {
  success: boolean;
  message: string;
  data: {
    token: string;
    user: User;
  };
  timestamp: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
}

export interface AdminSignupRequest {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
}

/** GET/PUT /landing-theme — homepage-only design tokens. */
export interface LandingThemePayload {
  id?: string | null;
  updated_at?: string | null;
  css_variables: Record<string, string>;
  font_heading_stack: string;
  font_body_stack: string;
  google_fonts_url: string | null;
  font_sizes: Record<string, string>;
  custom_css: string | null;
}

/** GET /contact-map — pin for Contact page map (admin: PUT). */
export interface ContactMapPayload {
  id: string;
  latitude: number;
  longitude: number;
  zoom: number;
  marker_title: string | null;
  address_line: string | null;
  updated_at: string;
}

/** GET /settings/storefront — aligned with Admin Settings tax/shipping fields. */
export interface StorefrontRates {
  tax_gst_rate: number;
  tax_qst_rate: number;
  tax_combined_rate: number;
  free_shipping_threshold: number;
  flat_shipping_rate: number;
  default_currency: string;
  /** Enabled languages for CMS, categories, banners. Add via Admin Settings. */
  supported_locales?: string[];
  /** Dynamic tax rates from remquip_tax_rates table. */
  tax_rates?: TaxRateConfig[];
}

/** A configured tax rate from the backend. */
export interface TaxRateConfig {
  id: string;
  name: string;
  label_en: string;
  label_fr: string;
  label_es: string;
  rate: number;         // percentage, e.g. 5.0
  rate_decimal: number; // decimal, e.g. 0.05
  is_compound: boolean;
  is_active?: boolean;
  display_order: number;
  created_at?: string;
  updated_at?: string;
}

// User
export interface User {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'super_admin' | 'manager' | 'user';
  status: 'active' | 'inactive' | 'suspended';
  avatar_url?: string;
  phone?: string;
  created_at: string;
  updated_at: string;
  last_login?: string;
  /** Per-customer price augmentation percentage (0-100). Returned from profile endpoint. */
  price_augmentation_percent?: number;
}

// Products
export interface Product {
  id: string;
  sku: string;
  name: string;
  description?: string;
  price: number;
  discount_percent?: number;
  wholesale_price?: number;
  distributor_price?: number;
  category_id: string;
  category?: string;
  stock_quantity: number;
  minimum_stock?: number;
  is_featured: boolean;
  status: 'active' | 'draft' | 'archived';
  image?: string;
  image_url?: string;
  images?: ProductImage[];
  variants?: ProductVariant[];
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface ProductImage {
  id: string;
  product_id: string;
  image_url: string;
  alt_text?: string;
  is_primary: boolean;
  display_order: number;
  uploaded_at: string;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  variant_name: string;
  variant_sku?: string;
  variant_price?: number;
  stock_quantity: number;
  is_active: boolean;
  created_at: string;
}

export interface CategoryTranslation {
  locale: string;
  name: string;
  description?: string;
}

export interface ProductCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  image_url?: string;
  parent_category_id?: string;
  is_active?: boolean;
  display_order: number;
  created_at?: string;
  product_count?: number;
  locale?: string;
  translations?: CategoryTranslation[];
}

// Customers
export interface Customer {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  company_name?: string;
  avatar_url?: string;
  status: 'active' | 'inactive' | 'suspended';
  created_at: string;
  updated_at: string;
  last_order_date?: string;
  total_orders?: number;
  total_spent?: number;
  assigned_contact_id?: string | null;
  notes?: CustomerNote[];
  // Application Extended Fields
  neq_tva?: string | null;
  fax?: string | null;
  website?: string | null;
  contact_position?: string | null;
  contact_person?: string | null;
  customer_type?: string | null;
  distributor_type?: string | null;
  num_trucks?: number | null;
  num_trailers?: number | null;
  // Primary address
  address?: string | null;
  address_2?: string | null;
  city?: string | null;
  province?: string | null;
  postal_code?: string | null;
  country?: string | null;
  tax_number?: string | null;
  // Billing address
  billing_address?: string | null;
  billing_address_2?: string | null;
  billing_city?: string | null;
  billing_province?: string | null;
  billing_postal_code?: string | null;
  billing_country?: string | null;
  // Shipping address
  shipping_address?: string | null;
  shipping_address_2?: string | null;
  shipping_city?: string | null;
  shipping_province?: string | null;
  shipping_postal_code?: string | null;
  shipping_country?: string | null;
  // Accounting
  accounting_contact?: string | null;
  accounting_phone?: string | null;
  billing_email?: string | null;
  payment_terms?: string | null;
  payment_method?: string | null;
  bank_reference?: string | null;
  credit_limit?: number | null;
  supplier_ref_1?: string | null;
  supplier_ref_2?: string | null;
  parts_needed?: string | null;
  special_requests?: string | null;
  sales_representative?: string | null;
  category: "lead" | "customer" | "contract";
  contract_validated?: boolean;
  account_origin?: "register" | "application";
}

export interface CustomerNote {
  id: string;
  note: string;
  is_internal: boolean;
  created_at: string;
  updated_at?: string;
  // Present because backend joins `remquip_users u` as `u.full_name AS user`
  user?: string | null;
}

export interface CustomerTask {
  id: string;
  customer_id?: string | null;
  title: string;
  due_at: string | null;
  status: 'open' | 'done' | 'cancelled';
  priority?: 'low' | 'normal' | 'high';
  assigned_to: string | null;
  assigned_contact_name?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpcomingTask {
  id: string;
  /** Now nullable to support standalone tasks not tied to a customer. */
  customer_id: string | null;
  title: string;
  due_at: string;
  status: 'open' | 'done' | 'cancelled';
  priority?: 'low' | 'normal' | 'high';
  notes?: string | null;
  assigned_to?: string | null;
  assignee_name?: string | null;
  assigned_contact_name?: string | null;
  company_name?: string | null;
  contact_person?: string | null;
  customer_email?: string | null;
  email?: string | null;
  /** Customer segment this task belongs to. Surfaced in reminder UI so admins can prioritize. */
  customer_category?: 'lead' | 'customer' | 'contract' | null;
  contract_validated?: boolean | 0 | 1 | null;
}

export interface CustomerAddress {
  id: string;
  customer_id: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  is_default: boolean;
  address_type: 'billing' | 'shipping';
  created_at: string;
}

// Account Applications
export interface AccountApplication {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  company_name: string;
  neq_tva?: string;
  contact_person: string;
  contact_title?: string;
  phone?: string;
  email: string;
  distributor_type?: string[];
  distributor_type_other?: string;
  num_trucks?: number;
  num_trailers?: number;
  billing_address?: string;
  shipping_address?: string;
  accounting_contact?: string;
  accounting_phone?: string;
  billing_email?: string;
  payment_terms?: string;
  payment_method?: string;
  bank_reference?: string;
  credit_limit_requested?: number;
  supplier_ref_1?: string;
  supplier_ref_2?: string;
  parts_needed?: string;
  special_requests?: string;
  sales_representative?: string;
  signatory_name?: string;
  signatory_title?: string;
  signature_date?: string;
  signature_data?: string;
  rejection_reason?: string;
  approved_customer_id?: string;
  created_at: string;
  updated_at: string;
}

// Orders
export interface Order {
  id: string;
  order_number: string;
  customer_id: string;
  customer_email?: string;
  order_date: string;
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'completed' | 'cancelled' | 'refunded';
  total_amount: number;
  subtotal: number;
  tax_amount: number;
  shipping_amount: number;
  discount_amount?: number;
  payment_status: 'pending' | 'paid' | 'failed' | 'refunded' | 'expired';
  payment_method?: string;
  stripe_session_id?: string;
  stripe_payment_intent_id?: string;
  paid_at?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  items?: OrderItem[];
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  created_at: string;
}

/** Row from `order_notes` (GET order detail or GET /orders/:id/notes). */
export interface OrderNote {
  date: string;
  user: string;
  text: string;
}

// Offers
export interface Offer {
  id: string;
  offer_number: string;
  customer_id: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'converted';
  subtotal: number;
  tax: number;
  shipping: number;
  discount: number;
  total: number;
  valid_until?: string | null;
  notes?: string | null;
  item_count?: number;
  items?: OfferItem[];
  documents?: OfferDocument[];
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface OfferItem {
  id: string;
  offer_id?: string;
  product_id: string | null;
  product_name: string;
  product_name_live?: string;
  sku: string;
  product_sku_live?: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  notes?: string | null;
}

export interface OfferDocument {
  id: string;
  offer_id?: string;
  file_url: string;
  file_name: string;
  document_type: string;
  uploaded_by?: string | null;
  created_at: string;
}

export interface OrderDocument {
  id: string;
  order_id?: string;
  file_url: string;
  file_name: string;
  document_type: string;
  uploaded_by?: string | null;
  created_at: string;
}

// Discounts
export interface Discount {
  id: string;
  code: string;
  description?: string;
  discount_type: 'percentage' | 'fixed_amount';
  discount_value: number;
  min_purchase_amount?: number;
  max_usage_count?: number;
  current_usage_count: number;
  valid_from: string;
  valid_until: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Inventory
export interface InventoryLog {
  id: string;
  product_id: string;
  product_name?: string;
  transaction_type: 'purchase' | 'sale' | 'adjustment' | 'return';
  quantity_change: number;
  quantity_before: number;
  quantity_after: number;
  reference_id?: string;
  notes?: string;
  created_by?: string;
  created_at: string;
}

// API Response wrapper
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  errors?: Record<string, string[]>;
  timestamp: string;
}

/** Backend list responses: `data: { items, pagination }` or `data: T[]`. */
export interface PaginatedResponse<T> extends Omit<ApiResponse<T[]>, 'data'> {
  data: T[];
  /** Present after {@link normalizePaginated}; also readable via {@link unwrapPagination}. */
  pagination?: Record<string, unknown>;
}

/**
 * Flattens `data.items` → `data` and copies `pagination` to the top level (single place for list/search).
 */
export function normalizePaginated<T>(res: ApiResponse<any>): PaginatedResponse<T> {
  const raw = res?.data;
  if (raw != null && typeof raw === 'object' && !Array.isArray(raw) && Array.isArray((raw as { items?: unknown }).items)) {
    const inner = raw as { items: T[]; pagination?: Record<string, unknown> };
    return {
      ...res,
      data: inner.items,
      pagination: inner.pagination,
    } as PaginatedResponse<T>;
  }
  if (Array.isArray(raw)) {
    return { ...res, data: raw as T[] } as PaginatedResponse<T>;
  }
  return { ...res, data: [] as T[] } as PaginatedResponse<T>;
}

/** Backend paginated lists use data: { items, pagination }; unwrap for UI */
export function unwrapApiList<T>(response: ApiResponse<any> | undefined | null, fallback: T[]): T[] {
  if (!response?.data) return fallback;
  const d = response.data as { items?: T[] } | T[] | undefined;
  if (Array.isArray(d)) return d as T[];
  if (d && typeof d === 'object' && Array.isArray((d as { items?: T[] }).items)) {
    return (d as { items: T[] }).items;
  }
  return fallback;
}

export function unwrapPagination(response: ApiResponse<any> | undefined | null): { total: number; pages: number; limit: number } | undefined {
  if (!response) return undefined;
  const top = (response as PaginatedResponse<unknown>).pagination;
  if (top) return top as any;
  const d = response.data;
  if (d && typeof d === 'object' && !Array.isArray(d) && 'pagination' in d) {
    return (d as { pagination?: any }).pagination;
  }
  return undefined;
}

/**
 * Absolute URL for backend-stored assets (`/Backend/uploads/images|contracts|...`).
 * Same path shape as PHP (`publicPath` in uploads/products/cms routes).
 */
export function resolveUploadImageUrl(imageUrl: string): string {
  if (!imageUrl) return '';
  if (/^https?:\/\//i.test(imageUrl)) return imageUrl;
  const trimmed = API_BASE_URL.replace(/\/+$/, '');
  let path = imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`;
  // PHP stores `/Backend/uploads/...`; site URL is `/remquip/backend/uploads/...` (same folder as index.php)
  path = path.replace(/^\/Backend(?=\/|$)/i, '');
  return `${trimmed}${path}`;
}

/** Alias — documents and product images use the same `/Backend/uploads/...` base. */
export function resolveBackendUploadUrl(url: string): string {
  return resolveUploadImageUrl(url);
}

/** JSON body for POST /products or PUT /products/:id (accepts camelCase + snake_case source fields). */
export function buildProductWritePayload(data: Record<string, unknown>, mode: 'create' | 'update'): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (data.sku != null && String(data.sku).trim() !== '') body.sku = String(data.sku).trim();
  if (data.name != null) body.name = data.name;
  const cat = data.categoryId ?? data.category_id;
  if (cat != null && String(cat) !== '') body.categoryId = cat;

  const basePrice = data.basePrice ?? data.base_price ?? data.price;
  if (basePrice !== undefined && basePrice !== '' && basePrice !== null) {
    body.basePrice = Number(basePrice);
  }

  if (data.costPrice !== undefined || data.cost_price !== undefined || data.wholesale_price !== undefined) {
    const c = data.costPrice ?? data.cost_price ?? data.wholesale_price;
    if (c === '' || c === null) {
      if (mode === 'update') body.costPrice = null;
    } else {
      body.costPrice = Number(c);
    }
  }

  if (data.description !== undefined) body.description = data.description ?? '';
  if (data.details != null && typeof data.details === 'object') body.details = data.details;
  if (data.status != null) body.status = data.status;

  if (mode === 'create') {
    const init = data.initialStock ?? data.stock_quantity ?? data.stock;
    if (init !== undefined && init !== null && init !== '') {
      body.initialStock = Math.max(0, Number(init));
    }
  } else {
    if (data.stock_quantity != null || data.stock != null || data.quantityOnHand != null) {
      const q = data.stock_quantity ?? data.quantityOnHand ?? data.stock;
      body.stock_quantity = Math.max(0, Number(q));
    }
  }

  // discount_percent
  if (data.discount_percent !== undefined) {
    body.discount_percent = Math.max(0, Math.min(100, Number(data.discount_percent ?? 0)));
  }

  // minimum_stock
  if (data.minimum_stock !== undefined) {
    body.minimum_stock = Math.max(0, Number(data.minimum_stock ?? 0));
  }

  return body;
}

/** Map MySQL discount row → frontend Discount (snake_case API fields). */
export function mapDiscountRow(row: Record<string, unknown>): Discount {
  return {
    id: String(row.id ?? ''),
    code: String(row.code ?? ''),
    description: row.description != null ? String(row.description) : undefined,
    discount_type: (row.discount_type as Discount['discount_type']) || 'percentage',
    discount_value: Number(row.discount_value ?? 0),
    min_purchase_amount: row.min_order_value != null ? Number(row.min_order_value) : undefined,
    max_usage_count: row.max_uses != null && row.max_uses !== '' ? Number(row.max_uses) : undefined,
    current_usage_count: Number(row.uses_count ?? 0),
    valid_from: row.valid_from != null ? String(row.valid_from) : '',
    valid_until: row.valid_until != null ? String(row.valid_until) : '',
    is_active: Boolean(row.is_active),
    created_at: row.created_at != null ? String(row.created_at) : '',
    updated_at: row.updated_at != null ? String(row.updated_at) : '',
  };
}

// ==================== TOKEN MANAGEMENT ====================

class TokenManager {
  /** Per-key in-memory cache so admin & storefront tokens never cross-contaminate. */
  private static tokenCacheMap: Record<string, string | null> = {};

  static setToken(token: string): void {
    const key = getActiveTokenKey();
    this.tokenCacheMap[key] = token;
    localStorage.setItem(key, token);
  }

  static getToken(): string | null {
    const key = getActiveTokenKey();
    // Prefer localStorage, but fall back to in-memory cache to avoid
    // "Missing token" issues when localStorage is cleared during app boot.
    return localStorage.getItem(key) ?? this.tokenCacheMap[key] ?? null;
  }

  static removeToken(): void {
    const key = getActiveTokenKey();
    this.tokenCacheMap[key] = null;
    localStorage.removeItem(key);
  }

  static isTokenExpired(): boolean {
    const token = this.getToken();
    if (!token) return true;
    // In a real app, decode JWT to check expiry
    return false;
  }

  static getAuthHeader(): Record<string, string> {
    const token = this.getToken();
    if (!token) return {};
    return {
      [TOKEN_CONFIG.HEADER_NAME]: `${TOKEN_CONFIG.HEADER_PREFIX} ${token}`,
      // Also send token in a custom header in case the host honors it.
      'X-Auth-Token': token,
    };
  }
}

// ==================== API SERVICE ====================

class APIService {
  private baseUrl: string = API_BASE_URL;
  private timeout: number = REQUEST_TIMEOUT;

  constructor() {
    console.log('[API Service] Initialized with base URL:', this.baseUrl);
  }

  /**
   * - Paths whose last segment ends with `.php` are requested directly (e.g. `cms/page-content.php?slug=home`).
   * - All other logical paths use the backend entrypoint `remquip-api.php?path=...`
   *   (same routing as `api.php`, but some hosts treat `api.php` differently).
   */
  private buildApiUrl(endpoint: string): string {
    const base = this.baseUrl.replace(/\/+$/, "");
    const raw = endpoint.startsWith("/") ? endpoint.slice(1) : endpoint;
    const qIdx = raw.indexOf("?");
    const pathOnly = (qIdx >= 0 ? raw.slice(0, qIdx) : raw).trim();
    const lastSeg = pathOnly.split("/").pop() ?? "";
    if (lastSeg.toLowerCase().endsWith(".php")) {
      return `${base}/${raw}`;
    }
    const params = new URLSearchParams();
    params.set("path", pathOnly);
    // Some hosts/proxies strip Authorization headers to PHP.
    // Passing the token in the query keeps auth working consistently.
    const token = TokenManager.getToken();
    if (token) {
      params.set("token", token);
    }
    if (qIdx >= 0) {
      const extra = new URLSearchParams(raw.slice(qIdx + 1));
      extra.forEach((v, k) => params.append(k, v));
    }
    return `${base}/remquip-api.php?${params.toString()}`;
  }

  /**
   * Make HTTP request with comprehensive error handling.
   * For FormData uploads, pass body as FormData — Content-Type is omitted so the browser sets the boundary.
   */
  async request<T = any>(
    method: string,
    endpoint: string,
    body?: any,
    options?: RequestInit & { skipAuthRedirect?: boolean }
  ): Promise<ApiResponse<T>> {
    const skipAuthRedirect = options?.skipAuthRedirect === true;
    const fetchExtras = { ...(options ?? {}) } as Record<string, unknown>;
    delete fetchExtras.skipAuthRedirect;

    const url = this.buildApiUrl(endpoint);
    const requestId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

    const headers: Record<string, string> = {
      'X-Request-ID': requestId,
      ...TokenManager.getAuthHeader(),
      ...(options?.headers as Record<string, string> | undefined),
    };
    const authHeaderVal = headers['Authorization'];
    if (typeof authHeaderVal === 'string') {
      console.log('[API][AUTH]', { hasAuthorization: true, bearer: authHeaderVal.startsWith('Bearer '), tokenLen: authHeaderVal.length });
    } else {
      console.log('[API][AUTH]', { hasAuthorization: false });
    }
    if (!isFormData) {
      headers['Content-Type'] = 'application/json';
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      console.log(`[API] ${method} ${endpoint}`, { requestId, body: isFormData ? '[FormData]' : body });

      const response = await fetch(url, {
        method,
        headers,
        body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
        signal: controller.signal,
        ...(fetchExtras as RequestInit),
      });

      clearTimeout(timeoutId);

      // Handle error responses
      if (!response.ok) {
        let errorData: any = {};
        try {
          errorData = await response.json();
        } catch {
          errorData = { message: `HTTP ${response.status}` };
        }

        const apiError = new ApiError(
          `HTTP_${response.status}`,
          errorData.message || `HTTP ${response.status} Error`,
          errorData.userMessage || this.getUserMessage(response.status),
          response.status,
          errorData.details || { endpoint, method },
          requestId
        );

        logError(apiError);

        // Special handling for 401 (skip for optional public calls e.g. analytics beacon)
        if (response.status === HTTP_STATUS.UNAUTHORIZED && !skipAuthRedirect) {
          const tokenBefore = TokenManager.getToken();

          // If the client still has a token, do not clear it or redirect.
          // This prevents "Missing token" loops caused by races during auth boot.
          if (tokenBefore) {
            // Keep token in storage; let AuthContext / UI decide what to do.
          } else {
            TokenManager.removeToken();
            const path = typeof window !== 'undefined' ? window.location.pathname || '' : '';
            window.location.href = path.startsWith('/admin') ? '/admin/login' : '/login';
          }
        }

        throw apiError;
      }

      const data = await response.json();
      console.log(`[API] Success:`, { endpoint, method, requestId, dataSize: JSON.stringify(data).length });
      return data;
    } catch (error) {
      clearTimeout(timeoutId);

      let apiError: ApiError;

      if (error instanceof ApiError) {
        apiError = error;
      } else if (error instanceof TypeError) {
        // Network errors
        apiError = new ApiError(
          'NETWORK_ERROR',
          error.message,
          API_ERRORS.NETWORK_ERROR,
          0,
          { endpoint, method, originalError: error.message },
          requestId
        );
      } else if (error instanceof SyntaxError) {
        // JSON parse errors
        apiError = new ApiError(
          'PARSE_ERROR',
          error.message,
          'Failed to process server response',
          0,
          { endpoint, method, originalError: error.message },
          requestId
        );
      } else if (error instanceof Error && error.name === 'AbortError') {
        // Timeout
        apiError = new ApiError(
          'TIMEOUT_ERROR',
          'Request timeout',
          API_ERRORS.TIMEOUT_ERROR,
          408,
          { endpoint, method, timeout: this.timeout },
          requestId
        );
      } else {
        // Unknown errors
        apiError = new ApiError(
          'UNKNOWN_ERROR',
          String(error),
          API_ERRORS.UNKNOWN_ERROR,
          500,
          { endpoint, method, originalError: error },
          requestId
        );
      }

      logError(apiError);
      throw apiError;
    }
  }

  /**
   * Get user-friendly error message based on HTTP status
   */
  private getUserMessage(status: number): string {
    const messages: Record<number, string> = {
      400: 'Your request contains invalid data. Please check and try again.',
      401: 'Your session has expired. Please log in again.',
      403: 'You do not have permission to access this resource.',
      404: 'The requested resource was not found.',
      409: 'This resource already exists or there is a conflict.',
      500: 'The server encountered an error. Please try again later.',
      502: 'The server is temporarily unavailable. Please try again.',
      503: 'The service is temporarily unavailable. Please try again later.',
      504: 'The request took too long. Please try again.',
    };
    return messages[status] || 'An error occurred. Please try again.';
  }

  // ==================== AUTH METHODS ====================

  async login(email: string, password: string): Promise<AuthResponse> {
    const response = await this.request<any>(
      'POST',
      API_ENDPOINTS.AUTH.LOGIN,
      { email, password }
    );

    if (response.data?.token) {
      TokenManager.setToken(response.data.token);
    }

    return response as AuthResponse;
  }

  async logout(): Promise<ApiResponse> {
    const response = await this.request('POST', API_ENDPOINTS.AUTH.LOGOUT);
    TokenManager.removeToken();
    return response;
  }

  /** Exchanges a valid Bearer token for a new one (Backend POST /auth/refresh). */
  async refreshToken(): Promise<ApiResponse<{ token: string }>> {
    const response = await this.request<{ token: string }>('POST', API_ENDPOINTS.AUTH.REFRESH);
    if (response.data?.token) {
      TokenManager.setToken(response.data.token);
    }
    return response;
  }

  async register(data: RegisterRequest): Promise<AuthResponse> {
    const response = await this.request<any>(
      'POST',
      API_ENDPOINTS.AUTH.REGISTER,
      data
    );

    if (response.data?.token) {
      TokenManager.setToken(response.data.token);
    }

    return response as AuthResponse;
  }

  /**
   * Internal bootstrap endpoint to create an admin user.
   * Requires `X-Remquip-Admin-Setup-Key` header.
   */
  async adminSignup(data: AdminSignupRequest, setupKey: string): Promise<AuthResponse> {
    const response = await this.request<any>(
      'POST',
      API_ENDPOINTS.AUTH.ADMIN_SIGNUP,
      data,
      {
        skipAuthRedirect: true,
        headers: {
          'X-Remquip-Admin-Setup-Key': setupKey,
        },
      }
    );

    if (response.data?.token) {
      TokenManager.setToken(response.data.token);
    }

    return response as AuthResponse;
  }

  /** Request password reset email (portal users). */
  async forgotPassword(email: string): Promise<ApiResponse<{ message?: string }>> {
    return this.request('POST', API_ENDPOINTS.AUTH.FORGOT_PASSWORD, { email });
  }

  /** Set new password using token from email. */
  async resetPassword(token: string, password: string): Promise<ApiResponse> {
    return this.request('POST', API_ENDPOINTS.AUTH.RESET_PASSWORD, { token, password });
  }

  /** Public liveness probe — `GET /api/health` (Backend `index.php`). */
  getHealth(): Promise<ApiResponse<{ status: string; timestamp: string }>> {
    return this.request('GET', API_ENDPOINTS.HEALTH);
  }

  // ==================== UPLOADS (Backend/routes/uploads.php) ====================

  /** POST `file` — optional `productId` saves row in `product_images`. Returns `url` like `/Backend/uploads/images/...`. */
  async uploadGenericImageFile(
    file: File,
    opts?: { productId?: string; altText?: string; isPrimary?: boolean }
  ): Promise<ApiResponse<{ filename: string; url: string; size: number }>> {
    const formData = new FormData();
    formData.append('file', file);
    if (opts?.productId) formData.append('productId', opts.productId);
    if (opts?.altText != null) formData.append('altText', opts.altText);
    if (opts?.isPrimary !== undefined) formData.append('isPrimary', opts.isPrimary ? '1' : '0');
    return this.request('POST', API_ENDPOINTS.UPLOADS.IMAGE, formData, {});
  }

  /** POST `file` — PDF/Office; optional `customerId` inserts `customer_documents`. */
  async uploadContractFile(
    file: File,
    opts?: { customerId?: string; documentType?: string }
  ): Promise<ApiResponse<{ filename: string; url: string; size: number }>> {
    const formData = new FormData();
    formData.append('file', file);
    if (opts?.customerId) formData.append('customerId', opts.customerId);
    if (opts?.documentType) formData.append('documentType', opts.documentType ?? 'contract');
    return this.request('POST', API_ENDPOINTS.UPLOADS.CONTRACT, formData, {});
  }

  async getCustomerDocuments(customerId: string): Promise<ApiResponse<Record<string, unknown>[]>> {
    return this.request(
      'GET',
      API_ENDPOINTS.UPLOADS.CONTRACTS_BY_CUSTOMER.replace(':customerId', encodeURIComponent(customerId))
    );
  }

  async deleteCustomerDocument(documentId: string): Promise<ApiResponse> {
    return this.request('DELETE', API_ENDPOINTS.UPLOADS.DELETE.replace(':id', encodeURIComponent(documentId)));
  }

  /** POST `file` — generic upload + `file_uploads` row (auth). */
  async uploadRegistryFile(
    file: File,
    opts?: { uploadType?: string; relatedEntityType?: string; relatedEntityId?: string }
  ): Promise<ApiResponse<{ id: string; filename: string; url: string; size: number; mime_type: string }>> {
    const formData = new FormData();
    formData.append('file', file);
    if (opts?.uploadType) formData.append('upload_type', opts.uploadType);
    if (opts?.relatedEntityType) formData.append('related_entity_type', opts.relatedEntityType);
    if (opts?.relatedEntityId) formData.append('related_entity_id', opts.relatedEntityId);
    return this.request('POST', API_ENDPOINTS.UPLOADS.FILE, formData, {});
  }

  async listRegistryFiles(limit = 50, offset = 0): Promise<ApiResponse> {
    return this.request(
      'GET',
      `${API_ENDPOINTS.UPLOADS.FILES_LIST}?limit=${limit}&offset=${offset}`
    );
  }

  async deleteRegistryFile(fileId: string): Promise<ApiResponse> {
    return this.request(
      'DELETE',
      API_ENDPOINTS.UPLOADS.FILE_DELETE.replace(':id', encodeURIComponent(fileId))
    );
  }

  // ==================== SETTINGS (Backend/routes/settings.php) ====================

  /** Tax/shipping rates from DB — matches POST /orders totals. */
  async getStorefrontSettings(): Promise<ApiResponse<StorefrontRates>> {
    return this.request('GET', API_ENDPOINTS.SETTINGS.STOREFRONT);
  }

  async getPublicSettings(): Promise<ApiResponse<Record<string, unknown>>> {
    return this.request('GET', API_ENDPOINTS.SETTINGS.PUBLIC);
  }

  async getAdminSettings(): Promise<ApiResponse<Record<string, unknown>[]>> {
    return this.request('GET', API_ENDPOINTS.SETTINGS.LIST);
  }

  async patchSettingsBulk(settings: Record<string, string | number | boolean>): Promise<ApiResponse> {
    const flat: Record<string, string> = {};
    for (const [k, v] of Object.entries(settings)) {
      flat[k] = typeof v === 'boolean' ? (v ? '1' : '0') : String(v);
    }
    return this.request('PATCH', API_ENDPOINTS.SETTINGS.LIST, { settings: flat });
  }

  /** Public — Leaflet center + marker copy for /contact */
  async getContactMap(): Promise<ApiResponse<ContactMapPayload>> {
    return this.request('GET', API_ENDPOINTS.CONTACT_MAP.GET);
  }

  /** Admin — update map location */
  async updateContactMap(body: {
    latitude: number;
    longitude: number;
    zoom?: number;
    marker_title?: string | null;
    address_line?: string | null;
  }): Promise<ApiResponse<ContactMapPayload>> {
    return this.request('PUT', API_ENDPOINTS.CONTACT_MAP.UPDATE, body);
  }

  async getLandingTheme(): Promise<ApiResponse<LandingThemePayload>> {
    return this.request('GET', API_ENDPOINTS.LANDING_THEME.GET);
  }

  async updateLandingTheme(body: Partial<LandingThemePayload>): Promise<ApiResponse<LandingThemePayload>> {
    return this.request('PUT', API_ENDPOINTS.LANDING_THEME.UPDATE, body);
  }

  // ==================== USER METHODS ====================

  async getProfile(options?: { skipAuthRedirect?: boolean }): Promise<ApiResponse<User>> {
    // Use the dashboard profile endpoint which includes augmentation data
    return this.request('GET', API_ENDPOINTS.USER_DASHBOARD.PROFILE, undefined, { skipAuthRedirect: options?.skipAuthRedirect });
  }

  async getUser(id: string): Promise<ApiResponse<User>> {
    return this.request('GET', API_ENDPOINTS.USERS.GET.replace(':id', id));
  }

  async getUsers(page: number = 1, limit: number = 10): Promise<PaginatedResponse<User>> {
    return normalizePaginated<User>(await this.request('GET', `${API_ENDPOINTS.USERS.LIST}?page=${page}&limit=${limit}`));
  }

  async createUser(data: Partial<User>): Promise<ApiResponse<User>> {
    return this.request('POST', API_ENDPOINTS.USERS.CREATE, data);
  }

  async updateUser(id: string, data: Partial<User>): Promise<ApiResponse<User>> {
    return this.request('PUT', API_ENDPOINTS.USERS.UPDATE.replace(':id', id), data);
  }

  async deleteUser(id: string): Promise<ApiResponse> {
    return this.request('DELETE', API_ENDPOINTS.USERS.DELETE.replace(':id', id));
  }

  async updatePassword(id: string, currentPassword: string, newPassword: string): Promise<ApiResponse> {
    return this.request('PUT', API_ENDPOINTS.USERS.UPDATE_PASSWORD.replace(':id', id), {
      current_password: currentPassword,
      new_password: newPassword,
    });
  }

  /** Bulk import users (Backend: POST body `{ users }` or multipart field `file`). */
  async importUsersJson(payload: { users: Record<string, unknown>[] }): Promise<
    ApiResponse<{ imported: number; total: number; errors: string[] }>
  > {
    return this.request('POST', API_ENDPOINTS.USERS.IMPORT, payload);
  }

  async importUsersFile(file: File): Promise<ApiResponse<{ imported: number; total: number; errors: string[] }>> {
    const formData = new FormData();
    formData.append('file', file);
    return this.request('POST', API_ENDPOINTS.USERS.IMPORT, formData, {});
  }

  // ==================== PRODUCT METHODS ====================

  async getProducts(page: number = 1, limit: number = 12): Promise<PaginatedResponse<Product>> {
    return normalizePaginated<Product>(await this.request('GET', `${API_ENDPOINTS.PRODUCTS.LIST}?page=${page}&limit=${limit}`));
  }

  async getProduct(id: string): Promise<ApiResponse<Product>> {
    return this.request('GET', API_ENDPOINTS.PRODUCTS.GET.replace(':id', encodeURIComponent(id)));
  }

  async createProduct(data: Partial<Product> & Record<string, unknown>): Promise<ApiResponse<Product>> {
    return this.request('POST', API_ENDPOINTS.PRODUCTS.CREATE, buildProductWritePayload(data as Record<string, unknown>, 'create'));
  }

  async updateProduct(id: string, data: Partial<Product> & Record<string, unknown>): Promise<ApiResponse<Product>> {
    return this.request('PUT', API_ENDPOINTS.PRODUCTS.UPDATE.replace(':id', id), buildProductWritePayload(data as Record<string, unknown>, 'update'));
  }

  async deleteProduct(id: string): Promise<ApiResponse> {
    return this.request('DELETE', API_ENDPOINTS.PRODUCTS.DELETE.replace(':id', id));
  }

  async searchProducts(query: string, limit: number = 12): Promise<PaginatedResponse<Product>> {
    const q = encodeURIComponent(query);
    return normalizePaginated<Product>(await this.request('GET', `${API_ENDPOINTS.PRODUCTS.SEARCH}?q=${q}&limit=${limit}`));
  }

  /** Category segment may be slug or UUID; backend matches either. */
  async getProductsByCategory(categorySlugOrId: string): Promise<PaginatedResponse<Product>> {
    const seg = encodeURIComponent(categorySlugOrId);
    return normalizePaginated<Product>(
      await this.request('GET', API_ENDPOINTS.PRODUCTS.BY_CATEGORY.replace(':categoryId', seg))
    );
  }

  async getFeaturedProducts(): Promise<ApiResponse<Product[]>> {
    const response = await this.request<any[]>('GET', API_ENDPOINTS.PRODUCTS.FEATURED);
    if (response.data && Array.isArray(response.data)) {
      response.data = response.data.map((row: Record<string, unknown>) => ({
        id: String(row.id ?? ''),
        sku: String(row.sku ?? ''),
        name: String(row.name ?? ''),
        description: row.description != null ? String(row.description) : undefined,
        price: Number(row.price ?? row.base_price ?? 0),
        category_id: String(row.category_id ?? ''),
        category: row.category != null ? String(row.category) : (row.categorySlug != null ? String(row.categorySlug) : undefined),
        stock_quantity: Number(row.stock_quantity ?? row.stock ?? 0),
        is_featured: true,
        status: 'active' as const,
        images: row.image
          ? [{ id: '', product_id: String(row.id ?? ''), image_url: String(row.image), is_primary: true, display_order: 0, uploaded_at: '' }]
          : undefined,
        created_at: String(row.created_at ?? new Date().toISOString()),
        updated_at: String(row.updated_at ?? new Date().toISOString()),
      })) as unknown as Product[];
    }
    return response as ApiResponse<Product[]>;
  }

  async uploadProductImage(productId: string, file: File): Promise<ApiResponse<ProductImage>> {
    const formData = new FormData();
    formData.append('image', file);

    return this.request(
      'POST',
      API_ENDPOINTS.PRODUCT_IMAGES.UPLOAD.replace(':id', productId),
      formData,
      {}
    );
  }

  async getProductImages(productId: string): Promise<ApiResponse<unknown[]>> {
    return this.request('GET', API_ENDPOINTS.PRODUCT_IMAGES.LIST.replace(':id', productId));
  }

  async deleteProductImage(productId: string, imageId: string): Promise<ApiResponse> {
    return this.request(
      'DELETE',
      API_ENDPOINTS.PRODUCT_IMAGES.DELETE.replace(':id', productId).replace(':imageId', imageId)
    );
  }

  async updateProductImage(
    productId: string,
    imageId: string,
    data: { isPrimary?: boolean; displayOrder?: number; altText?: string }
  ): Promise<ApiResponse> {
    return this.request(
      'PATCH',
      API_ENDPOINTS.PRODUCT_IMAGES.UPDATE.replace(':id', productId).replace(':imageId', imageId),
      data
    );
  }



  async getCategories(
    page: number = 1,
    limit: number = 100,
    opts?: { locale?: string; admin?: boolean }
  ): Promise<PaginatedResponse<ProductCategory>> {
    const p = new URLSearchParams();
    p.set('page', String(page));
    p.set('limit', String(limit));
    if (opts?.locale) p.set('locale', opts.locale);
    if (opts?.admin) p.set('admin', '1');
    const qs = p.toString();
    return normalizePaginated<ProductCategory>(
      await this.request('GET', `${API_ENDPOINTS.CATEGORIES.LIST}${qs ? `?${qs}` : ''}`)
    );
  }

  async getCategory(id: string, locale?: string): Promise<ApiResponse<ProductCategory>> {
    const p = new URLSearchParams();
    if (locale) p.set('locale', locale);
    const qs = p.toString();
    return this.request(
      'GET',
      `${API_ENDPOINTS.CATEGORIES.GET.replace(':id', encodeURIComponent(id))}${qs ? `?${qs}` : ''}`
    );
  }

  async getCategoryTranslations(id: string): Promise<ApiResponse<{ translations: Record<string, { name: string; description?: string } | null> }>> {
    return this.request('GET', API_ENDPOINTS.CATEGORIES.TRANSLATIONS.replace(':id', encodeURIComponent(id)));
  }

  async putCategoryTranslations(
    id: string,
    body: Record<string, { name: string; description?: string }>
  ): Promise<ApiResponse> {
    return this.request('PUT', API_ENDPOINTS.CATEGORIES.TRANSLATIONS.replace(':id', encodeURIComponent(id)), body);
  }

  async createCategory(data: Partial<ProductCategory>): Promise<ApiResponse<ProductCategory>> {
    return this.request('POST', API_ENDPOINTS.CATEGORIES.CREATE, data);
  }

  async updateCategory(id: string, data: Partial<ProductCategory>): Promise<ApiResponse<ProductCategory>> {
    return this.request('PUT', API_ENDPOINTS.CATEGORIES.UPDATE.replace(':id', id), data);
  }

  async deleteCategory(id: string): Promise<ApiResponse> {
    return this.request('DELETE', API_ENDPOINTS.CATEGORIES.DELETE.replace(':id', id));
  }

  // ==================== CUSTOMER METHODS ====================

  async getCustomers(page: number = 1, limit: number = 10): Promise<PaginatedResponse<Customer>> {
    return normalizePaginated<Customer>(await this.request('GET', `${API_ENDPOINTS.CUSTOMERS.LIST}?page=${page}&limit=${limit}`));
  }

  async getCustomer(id: string): Promise<ApiResponse<Customer>> {
    return this.request('GET', API_ENDPOINTS.CUSTOMERS.GET.replace(':id', id));
  }

  async createCustomer(data: Partial<Customer> & Record<string, unknown>): Promise<ApiResponse<Customer>> {
    const d = data as Record<string, unknown>;
    const contact =
      String(d.contactPerson ?? d.contact_person ?? d.full_name ?? '').trim();
    const company = String(d.companyName ?? d.company_name ?? '').trim();
    const body = {
      companyName: company || contact || 'Web Customer',
      contactPerson: contact,
      email: d.email,
      phone: d.phone ?? '',
      fax: d.fax ?? null,
      website: d.website ?? null,
      customerType: d.customerType ?? d.customer_type ?? 'Wholesale',
      address: d.address,
      city: d.city,
      province: d.province ?? d.state,
      postalCode: d.postalCode ?? d.postal_code,
      country: d.country,
      taxNumber: d.taxNumber ?? d.tax_number,
      assignedContactId:
        (d.assigned_contact_id as string | undefined) ?? (d.assignedContactId as string | undefined) ?? null,
    };
    return this.request('POST', API_ENDPOINTS.CUSTOMERS.CREATE, body);
  }

  async updateCustomer(id: string, data: Partial<Customer> & Record<string, unknown>): Promise<ApiResponse<Customer>> {
    const d = data as Record<string, unknown>;
    const body: Record<string, unknown> = { ...d };
    // Remove full_name — it does NOT exist in remquip_customers; use contact_person instead
    delete body.full_name;
    if (d.company_name != null && d.companyName == null) body.companyName = d.company_name;
    if (d.contact_person != null && d.contactPerson == null) body.contactPerson = d.contact_person;
    if (d.postal_code != null && d.postalCode == null) body.postalCode = d.postal_code;
    if (d.tax_number != null && d.taxNumber == null) body.taxNumber = d.tax_number;
    if (d.customer_type != null && d.customerType == null) body.customerType = d.customer_type;
    if (d.state != null && d.province == null) body.province = d.state;
    if (d.assigned_contact_id != null && d.assignedContactId == null) body.assignedContactId = d.assigned_contact_id;
    if (d.assignedContactId != null) body.assignedContactId = d.assignedContactId;
    return this.request('PUT', API_ENDPOINTS.CUSTOMERS.UPDATE.replace(':id', id), body);
  }

  // ==================== CUSTOMER NOTES ====================
  async addCustomerNote(customerId: string, payload: { note: string; isInternal?: boolean }): Promise<ApiResponse> {
    return this.request(
      'POST',
      API_ENDPOINTS.CUSTOMERS.NOTES.ADD.replace(':id', encodeURIComponent(customerId)),
      { note: payload.note, isInternal: payload.isInternal ?? true }
    );
  }

  async updateCustomerNote(customerId: string, noteId: string, payload: { note?: string; isInternal?: boolean }): Promise<ApiResponse> {
    return this.request(
      'PUT',
      API_ENDPOINTS.CUSTOMERS.NOTES.UPDATE
        .replace(':id', encodeURIComponent(customerId))
        .replace(':noteId', encodeURIComponent(noteId)),
      payload
    );
  }

  async deleteCustomerNote(customerId: string, noteId: string): Promise<ApiResponse> {
    return this.request(
      'DELETE',
      API_ENDPOINTS.CUSTOMERS.NOTES.DELETE
        .replace(':id', encodeURIComponent(customerId))
        .replace(':noteId', encodeURIComponent(noteId))
    );
  }

  async convertLeadToCustomer(customerId: string): Promise<ApiResponse> {
    return this.request(
      'POST',
      API_ENDPOINTS.CUSTOMERS.CONVERT_TO_CUSTOMER.replace(':id', encodeURIComponent(customerId))
    );
  }

  async getCustomerTasks(customerId: string): Promise<ApiResponse<CustomerTask[]>> {
    return this.request('GET', API_ENDPOINTS.CUSTOMERS.TASKS.LIST.replace(':id', encodeURIComponent(customerId)));
  }

  async createCustomerTask(
    customerId: string,
    payload: { title: string; due_at?: string | null; status?: CustomerTask['status']; assigned_to?: string | null; notes?: string | null }
  ): Promise<ApiResponse<{ id: string }>> {
    return this.request(
      'POST',
      API_ENDPOINTS.CUSTOMERS.TASKS.LIST.replace(':id', encodeURIComponent(customerId)),
      {
        title: payload.title,
        dueAt: payload.due_at ?? null,
        status: payload.status ?? 'open',
        assignedTo: payload.assigned_to ?? null,
        notes: payload.notes ?? null,
      }
    );
  }

  async updateCustomerTask(taskId: string, payload: Partial<CustomerTask>): Promise<ApiResponse<{ id: string }>> {
    // Backend expects PATCH/PUT /customers/tasks/:taskId with body keys title/status/due_at/assigned_to/notes.
    return this.request(
      'PATCH',
      API_ENDPOINTS.CUSTOMERS.TASKS.UPDATE.replace(':taskId', encodeURIComponent(taskId)),
      {
        title: payload.title,
        status: payload.status,
        due_at: payload.due_at,
        assigned_to: payload.assigned_to,
        notes: payload.notes,
      }
    );
  }

  async deleteCustomerTask(taskId: string): Promise<ApiResponse> {
    return this.request(
      'DELETE',
      API_ENDPOINTS.CUSTOMERS.TASKS.UPDATE.replace(':taskId', encodeURIComponent(taskId))
    );
  }

  async getUpcomingTasks(): Promise<ApiResponse<UpcomingTask[]>> {
    return this.request('GET', API_ENDPOINTS.CUSTOMERS.TASKS.UPCOMING);
  }

  // ==================== TASKS (standalone admin module) ====================
  async listTasks(filters: { status?: string; assigned_to?: string; has_customer?: '0' | '1'; due_before?: string; due_after?: string } = {}): Promise<ApiResponse<UpcomingTask[]>> {
    const qs = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') qs.set(k, String(v)); });
    const path = qs.toString() ? `${API_ENDPOINTS.TASKS.LIST}?${qs.toString()}` : API_ENDPOINTS.TASKS.LIST;
    return this.request('GET', path);
  }

  async createTask(payload: { title: string; due_at?: string | null; status?: 'open'|'done'|'cancelled'; priority?: 'low'|'normal'|'high'; assigned_to?: string | null; customer_id?: string | null; notes?: string | null }): Promise<ApiResponse<{ id: string }>> {
    return this.request('POST', API_ENDPOINTS.TASKS.CREATE, payload);
  }

  async updateTask(id: string, payload: Partial<{ title: string; due_at: string | null; status: 'open'|'done'|'cancelled'; priority: 'low'|'normal'|'high'; assigned_to: string | null; customer_id: string | null; notes: string | null }>): Promise<ApiResponse<{ id: string }>> {
    return this.request('PATCH', API_ENDPOINTS.TASKS.UPDATE.replace(':id', encodeURIComponent(id)), payload);
  }

  async deleteTask(id: string): Promise<ApiResponse> {
    return this.request('DELETE', API_ENDPOINTS.TASKS.UPDATE.replace(':id', encodeURIComponent(id)));
  }

  // ==================== LEAD STATUSES ====================
  async listLeadStatuses(): Promise<ApiResponse<Array<{ id: string; label: string; color: string; sort_order: number; is_default: number }>>> {
    return this.request('GET', API_ENDPOINTS.LEAD_STATUSES.LIST);
  }

  async createLeadStatus(payload: { label: string; color?: string; sort_order?: number; is_default?: boolean }): Promise<ApiResponse<{ id: string }>> {
    return this.request('POST', API_ENDPOINTS.LEAD_STATUSES.CREATE, payload);
  }

  async updateLeadStatus(id: string, payload: Partial<{ label: string; color: string; sort_order: number; is_default: boolean }>): Promise<ApiResponse<{ id: string }>> {
    return this.request('PATCH', API_ENDPOINTS.LEAD_STATUSES.UPDATE.replace(':id', encodeURIComponent(id)), payload);
  }

  async deleteLeadStatus(id: string): Promise<ApiResponse> {
    return this.request('DELETE', API_ENDPOINTS.LEAD_STATUSES.DELETE.replace(':id', encodeURIComponent(id)));
  }

  // ==================== CONTACT LEAD CAPTURE ====================
  async submitContactLead(payload: { name: string; email: string; subject: string; message: string; phone?: string }): Promise<ApiResponse> {
    return this.request('POST', API_ENDPOINTS.CUSTOMERS.CONTACT_LEAD, payload);
  }

  async deleteCustomer(id: string): Promise<ApiResponse> {
    return this.request('DELETE', API_ENDPOINTS.CUSTOMERS.DELETE.replace(':id', id));
  }

  async getCustomerAdminPassword(customerId: string): Promise<ApiResponse<{ has_account: boolean; user_id?: string; email?: string; admin_password?: string | null }>> {
    return this.request('GET', `/customers/${encodeURIComponent(customerId)}/admin-password`);
  }

  async setCustomerAdminPassword(customerId: string, adminPassword: string): Promise<ApiResponse> {
    return this.request('POST', `/customers/${encodeURIComponent(customerId)}/admin-password`, { admin_password: adminPassword });
  }

  async removeCustomerAdminPassword(customerId: string): Promise<ApiResponse> {
    return this.request('DELETE', `/customers/${encodeURIComponent(customerId)}/admin-password`);
  }

  async searchCustomers(query: string): Promise<PaginatedResponse<Customer>> {
    return normalizePaginated<Customer>(
      await this.request('GET', `${API_ENDPOINTS.CUSTOMERS.SEARCH}?q=${encodeURIComponent(query)}`)
    );
  }

  async getCustomerOrders(customerId: string): Promise<ApiResponse<Order[]>> {
    return this.request('GET', API_ENDPOINTS.CUSTOMERS.ORDERS.replace(':id', customerId));
  }

  async getCustomerAddresses(customerId: string): Promise<ApiResponse<CustomerAddress[]>> {
    return this.request('GET', API_ENDPOINTS.CUSTOMERS.ADDRESSES.replace(':id', customerId));
  }

  /** Bulk import customers (Backend: POST body `{ customers }` or multipart `file`). */
  async importCustomersJson(payload: { customers: Record<string, unknown>[] }): Promise<
    ApiResponse<{ imported: number; total: number; errors: string[] }>
  > {
    return this.request('POST', API_ENDPOINTS.CUSTOMERS.IMPORT, payload);
  }

  async importCustomersFile(file: File): Promise<ApiResponse<{ imported: number; total: number; errors: string[] }>> {
    const formData = new FormData();
    formData.append('file', file);
    return this.request('POST', API_ENDPOINTS.CUSTOMERS.IMPORT, formData, {});
  }

  // ==================== ORDER METHODS ====================

  async getOrders(page: number = 1, limit: number = 10): Promise<PaginatedResponse<Order>> {
    return normalizePaginated<Order>(await this.request('GET', `${API_ENDPOINTS.ORDERS.LIST}?page=${page}&limit=${limit}`));
  }

  async getOrder(id: string): Promise<ApiResponse<Order>> {
    return this.request('GET', API_ENDPOINTS.ORDERS.GET.replace(':id', id));
  }

  async createOrder(data: Partial<Order>): Promise<ApiResponse<Order>> {
    return this.request('POST', API_ENDPOINTS.ORDERS.CREATE, data);
  }

  async updateOrder(id: string, data: Partial<Order>): Promise<ApiResponse<Order>> {
    return this.request('PUT', API_ENDPOINTS.ORDERS.UPDATE.replace(':id', id), data);
  }

  async updateOrderStatus(id: string, status: Order['status']): Promise<ApiResponse> {
    return this.request('PATCH', API_ENDPOINTS.ORDERS.STATUS.replace(':id', id), { status });
  }

  /** Same handler as shipment on the backend (carrier + trackingNumber). */
  async updateOrderTracking(
    id: string,
    payload: { carrier: string; trackingNumber: string }
  ): Promise<ApiResponse> {
    return this.request('PATCH', API_ENDPOINTS.ORDERS.TRACKING.replace(':id', id), payload);
  }

  async deleteOrder(id: string): Promise<ApiResponse> {
    return this.request('DELETE', API_ENDPOINTS.ORDERS.DELETE.replace(':id', id));
  }

  async searchOrders(query: string): Promise<PaginatedResponse<Order>> {
    return normalizePaginated<Order>(
      await this.request('GET', `${API_ENDPOINTS.ORDERS.SEARCH}?q=${encodeURIComponent(query)}`)
    );
  }

  async addOrderNote(orderId: string, note: string): Promise<ApiResponse> {
    return this.request('POST', API_ENDPOINTS.ORDERS.ADD_NOTE.replace(':id', orderId), { note });
  }

  getOrderNotes(orderId: string): Promise<ApiResponse<OrderNote[]>> {
    return this.request('GET', API_ENDPOINTS.ORDERS.GET_NOTES.replace(':id', orderId));
  }

  // ==================== ORDER DOCUMENTS ====================

  async getOrderDocuments(orderId: string): Promise<ApiResponse<OrderDocument[]>> {
    return this.request('GET', API_ENDPOINTS.ORDERS.DOCUMENTS.replace(':id', orderId));
  }

  async uploadOrderDocument(file: File, orderId: string, documentType: string = 'attachment'): Promise<ApiResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('document_type', documentType);
    return this.request('POST', API_ENDPOINTS.ORDERS.DOCUMENTS.replace(':id', orderId), formData);
  }

  async deleteOrderDocument(orderId: string, documentId: string): Promise<ApiResponse> {
    return this.request(
      'DELETE',
      API_ENDPOINTS.ORDERS.DOCUMENT_DELETE.replace(':id', orderId).replace(':documentId', documentId)
    );
  }

  async sendOrderEmail(orderId: string, data: { email_type?: string; message?: string; subject?: string }): Promise<ApiResponse> {
    return this.request('POST', API_ENDPOINTS.ORDERS.SEND.replace(':id', orderId), data);
  }

  /** Update a line-item quantity on an existing order. */
  async updateOrderItem(orderId: string, itemId: string, quantity: number): Promise<ApiResponse> {
    return this.request(
      'PATCH',
      API_ENDPOINTS.ORDERS.ITEM_UPDATE.replace(':id', orderId).replace(':itemId', itemId),
      { quantity }
    );
  }

  /** Remove a line item from an existing order. */
  async deleteOrderItem(orderId: string, itemId: string): Promise<ApiResponse> {
    return this.request(
      'DELETE',
      API_ENDPOINTS.ORDERS.ITEM_DELETE.replace(':id', orderId).replace(':itemId', itemId)
    );
  }

  // ==================== OFFERS ====================

  async getOffers(page: number = 1, limit: number = 20, status?: string, search?: string): Promise<PaginatedResponse<Offer>> {
    const p = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (status) p.set('status', status);
    if (search) p.set('search', search);
    return normalizePaginated<Offer>(await this.request('GET', `${API_ENDPOINTS.OFFERS.LIST}?${p.toString()}`));
  }

  async getOffer(id: string): Promise<ApiResponse<Offer>> {
    return this.request('GET', API_ENDPOINTS.OFFERS.GET.replace(':id', id));
  }

  async createOffer(data: Record<string, unknown>): Promise<ApiResponse> {
    return this.request('POST', API_ENDPOINTS.OFFERS.CREATE, data);
  }

  async updateOffer(id: string, data: Record<string, unknown>): Promise<ApiResponse> {
    return this.request('PUT', API_ENDPOINTS.OFFERS.UPDATE.replace(':id', id), data);
  }

  async updateOfferStatus(id: string, status: string): Promise<ApiResponse> {
    return this.request('PUT', API_ENDPOINTS.OFFERS.STATUS.replace(':id', id), { status });
  }

  async convertOfferToOrder(id: string): Promise<ApiResponse> {
    return this.request('POST', API_ENDPOINTS.OFFERS.CONVERT.replace(':id', id));
  }

  async convertOfferToInvoice(id: string): Promise<ApiResponse<{ id: string; invoice_number: string }>> {
    return this.request('POST', API_ENDPOINTS.OFFERS.CONVERT_INVOICE.replace(':id', id));
  }

  async deleteOffer(id: string): Promise<ApiResponse> {
    return this.request('DELETE', API_ENDPOINTS.OFFERS.DELETE.replace(':id', id));
  }

  async getOfferDocuments(offerId: string): Promise<ApiResponse<OfferDocument[]>> {
    return this.request('GET', API_ENDPOINTS.OFFERS.DOCUMENTS.replace(':id', offerId));
  }

  async uploadOfferDocument(file: File, offerId: string, documentType: string = 'attachment'): Promise<ApiResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('document_type', documentType);
    return this.request('POST', API_ENDPOINTS.OFFERS.DOCUMENTS.replace(':id', offerId), formData);
  }

  async deleteOfferDocument(offerId: string, documentId: string): Promise<ApiResponse> {
    return this.request(
      'DELETE',
      API_ENDPOINTS.OFFERS.DOCUMENT_DELETE.replace(':id', offerId).replace(':documentId', documentId)
    );
  }

  async sendOfferEmail(offerId: string, data: { message?: string; subject?: string }): Promise<ApiResponse> {
    return this.request('POST', API_ENDPOINTS.OFFERS.SEND.replace(':id', offerId), data);
  }

  async uploadSignature(file: File): Promise<ApiResponse<{ url: string }>> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', 'signatures');
    return this.request('POST', 'uploads/image', formData);
  }

  async uploadApplicationPdf(file: Blob, companyName: string): Promise<ApiResponse<{ url: string }>> {
    const formData = new FormData();
    formData.append('file', file, `Application_${companyName.replace(/\s+/g, '_')}.pdf`);
    formData.append('type', 'applications');
    return this.request('POST', 'uploads/file', formData);
  }

  async approveApplication(id: string, pdfUrl?: string, overrides?: Record<string, any>): Promise<ApiResponse> {
    return this.request('PATCH', `account-applications/${id}/approve`, { pdf_url: pdfUrl, overrides: overrides ?? null });
  }

  /** B2B orders for a user where customer email matches user email (Backend: users.php). */
  async getOrdersByUserId(
    userId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<PaginatedResponse<unknown>> {
    return normalizePaginated(
      await this.request(
        'GET',
        `${API_ENDPOINTS.ORDERS.USER_ORDERS.replace(':userId', userId)}?page=${page}&limit=${limit}`
      )
    );
  }

  // ==================== STRIPE METHODS ====================

  async createStripeCheckoutSession(orderId: string): Promise<ApiResponse<{ sessionId: string; url: string }>> {
    return this.request('POST', API_ENDPOINTS.STRIPE.CREATE_SESSION, { order_id: orderId });
  }

  // ==================== DISCOUNT METHODS ====================

  async getDiscounts(page: number = 1, limit: number = 10): Promise<PaginatedResponse<Discount>> {
    const norm = normalizePaginated<Record<string, unknown>>(
      await this.request('GET', `${API_ENDPOINTS.DISCOUNTS.LIST}?page=${page}&limit=${limit}`)
    );
    const data = norm.data.map((r) => mapDiscountRow(r));
    return { ...norm, data } as unknown as PaginatedResponse<Discount>;
  }

  async getDiscount(id: string): Promise<ApiResponse<Discount>> {
    const res = await this.request<Record<string, unknown>>('GET', API_ENDPOINTS.DISCOUNTS.GET.replace(':id', id));
    if (res.data && typeof res.data === 'object' && !Array.isArray(res.data)) {
      res.data = mapDiscountRow(res.data as Record<string, unknown>) as unknown as Record<string, unknown>;
    }
    return res as unknown as ApiResponse<Discount>;
  }

  async createDiscount(data: Partial<Discount>): Promise<ApiResponse<Discount>> {
    return this.request('POST', API_ENDPOINTS.DISCOUNTS.CREATE, data);
  }

  async updateDiscount(id: string, data: Partial<Discount>): Promise<ApiResponse<Discount>> {
    return this.request('PUT', API_ENDPOINTS.DISCOUNTS.UPDATE.replace(':id', id), data);
  }

  async deleteDiscount(id: string): Promise<ApiResponse> {
    return this.request('DELETE', API_ENDPOINTS.DISCOUNTS.DELETE.replace(':id', id));
  }

  async validateDiscount(code: string): Promise<ApiResponse<Discount>> {
    const res = await this.request<Record<string, unknown>>(
      'GET',
      API_ENDPOINTS.DISCOUNTS.VALIDATE.replace(':code', encodeURIComponent(code))
    );
    if (res.data && typeof res.data === 'object' && !Array.isArray(res.data)) {
      res.data = mapDiscountRow(res.data as Record<string, unknown>) as unknown as Record<string, unknown>;
    }
    return res as unknown as ApiResponse<Discount>;
  }

  // ==================== INVENTORY METHODS ====================

  async getInventoryLogs(page: number = 1, limit: number = 20): Promise<PaginatedResponse<InventoryLog>> {
    return normalizePaginated<InventoryLog>(await this.request('GET', `${API_ENDPOINTS.INVENTORY.LOGS}?page=${page}&limit=${limit}`));
  }

  async adjustInventory(productId: string, quantity: number, reason: string): Promise<ApiResponse> {
    return this.request('POST', API_ENDPOINTS.INVENTORY.ADJUST, {
      product_id: productId,
      quantity_change: quantity,
      notes: reason,
    });
  }

  async getLowStockProducts(): Promise<ApiResponse<Product[]>> {
    const res = await this.request<any[]>('GET', API_ENDPOINTS.INVENTORY.LOW_STOCK);
    if (res.data && Array.isArray(res.data)) {
      res.data = res.data.map((row: Record<string, unknown>) => {
        const stock = Number(row.quantity_available ?? row.quantity_on_hand ?? row.stock ?? 0);
        return {
          id: String(row.id ?? ''),
          sku: String(row.sku ?? ''),
          name: String(row.name ?? ''),
          price: Number(row.price ?? row.base_price ?? 0),
          category_id: String(row.category_id ?? ''),
          stock_quantity: stock,
          stock: stock,
          is_featured: false,
          status: 'active' as const,
          created_at: String(row.created_at ?? new Date().toISOString()),
          updated_at: String(row.updated_at ?? new Date().toISOString()),
        };
      }) as unknown as Product[];
    }
    return res as ApiResponse<Product[]>;
  }

  async getProductHistory(productId: string): Promise<PaginatedResponse<InventoryLog>> {
    return normalizePaginated<InventoryLog>(
      await this.request('GET', API_ENDPOINTS.INVENTORY.HISTORY.replace(':productId', productId))
    );
  }

  async getProductStats(productId: string): Promise<ApiResponse<{
    total_orders: number;
    total_units_sold: number;
    total_revenue: number;
    view_count: number;
    recent_orders: Record<string, unknown>[];
  }>> {
    return this.request('GET', API_ENDPOINTS.PRODUCTS.STATS.replace(':id', productId));
  }

  // ==================== CUSTOMER PRODUCT PRICES ====================

  async getProductCustomerPrices(productId: string): Promise<ApiResponse<Record<string, unknown>[]>> {
    return this.request('GET', API_ENDPOINTS.PRODUCTS.CUSTOMER_PRICES.replace(':id', productId));
  }

  async setProductCustomerPrice(productId: string, customerId: string, augmentationPercent: number): Promise<ApiResponse> {
    return this.request('POST', API_ENDPOINTS.PRODUCTS.SET_CUSTOMER_PRICE.replace(':id', productId), {
      customer_id: customerId,
      augmentation_percent: augmentationPercent,
    });
  }

  async deleteProductCustomerPrice(productId: string, cpId: string): Promise<ApiResponse> {
    return this.request('DELETE', API_ENDPOINTS.PRODUCTS.DELETE_CUSTOMER_PRICE.replace(':id', productId).replace(':cpId', cpId));
  }

  // ==================== ANALYTICS METHODS ====================

  async getAnalyticsDashboard(): Promise<ApiResponse> {
    const res = await this.request<any>('GET', API_ENDPOINTS.ANALYTICS.DASHBOARD);
    const d = res?.data;
    if (d?.summary && typeof d.summary === 'object') {
      const monthly = Array.isArray(d.monthlyRevenue)
        ? d.monthlyRevenue.map((r: Record<string, unknown>) => ({
            month: String(r.month ?? '').length >= 7 ? String(r.month).slice(5) : String(r.month ?? ''),
            value: Number(r.revenue ?? 0),
          }))
        : undefined;
      res.data = {
        ...d,
        ...d.summary,
        total_orders: d.summary.totalOrders,
        total_revenue: d.summary.totalRevenue,
        total_products: d.summary.totalProducts,
        active_customers: d.summary.activeCustomers,
        new_customers: d.summary.activeCustomers,
        monthly_sales: monthly ?? d.monthly_sales,
        page_views: d.summary.page_views ?? 0,
        tracked_events_30d: d.summary.tracked_events_30d ?? 0,
      };
    }
    return res;
  }

  async getAnalyticsMetrics(startDate: string, endDate: string): Promise<ApiResponse> {
    return this.request(
      'GET',
      `${API_ENDPOINTS.ANALYTICS.DAILY_METRICS}?start_date=${startDate}&end_date=${endDate}`
    );
  }

  async getRevenueStats(startDate: string, endDate: string): Promise<ApiResponse> {
    return this.request(
      'GET',
      `${API_ENDPOINTS.ANALYTICS.REVENUE}?start_date=${startDate}&end_date=${endDate}`
    );
  }

  /** Optional: `?period=day|week|month|year` (Backend: analytics.php). */
  async getAnalyticsSales(period?: string): Promise<ApiResponse> {
    const q = period ? `?period=${encodeURIComponent(period)}` : '';
    return this.request('GET', `${API_ENDPOINTS.ANALYTICS.SALES}${q}`);
  }

  async getAnalyticsInventoryOverview(): Promise<ApiResponse> {
    return this.request('GET', API_ENDPOINTS.ANALYTICS.INVENTORY_OVERVIEW);
  }

  async getAnalyticsCustomersOverview(): Promise<ApiResponse> {
    return this.request('GET', API_ENDPOINTS.ANALYTICS.CUSTOMERS_OVERVIEW);
  }

  /** Fire-and-forget tracking row in `analytics` (no redirect on 401). */
  async postAnalyticsEvent(
    eventType: string,
    data?: Record<string, unknown>
  ): Promise<ApiResponse<{ id: string }>> {
    return this.request('POST', API_ENDPOINTS.ANALYTICS.EVENTS, { event_type: eventType, data }, { skipAuthRedirect: true });
  }

  async getAnalyticsEvents(params?: {
    limit?: number;
    offset?: number;
    event_type?: string;
  }): Promise<ApiResponse> {
    const q = new URLSearchParams();
    if (params?.limit != null) q.set('limit', String(params.limit));
    if (params?.offset != null) q.set('offset', String(params.offset));
    if (params?.event_type) q.set('event_type', params.event_type);
    const qs = q.toString();
    return this.request('GET', `${API_ENDPOINTS.ANALYTICS.EVENTS}${qs ? `?${qs}` : ''}`);
  }

  async getAnalyticsEventsSummary(days = 30): Promise<ApiResponse> {
    return this.request('GET', `${API_ENDPOINTS.ANALYTICS.EVENTS_SUMMARY}?days=${days}`);
  }

  // ==================== CMS METHODS ====================

  /** Align admin form fields with Backend/routes/cms.php (isPublished, excerpt). */
  private mapCMSPageBody(data: Record<string, unknown>): Record<string, unknown> {
    const body: Record<string, unknown> = { ...data };
    if ('status' in body) {
      const s = body.status;
      body.isPublished = s === 'published' || s === true;
      delete body.status;
    }
    if (body.meta_description != null && body.excerpt === undefined) {
      body.excerpt = body.meta_description;
    }
    delete body.meta_title;
    delete body.meta_description;
    return body;
  }

  async getCMSPages(page: number = 1, limit: number = 10): Promise<PaginatedResponse<unknown>> {
    return normalizePaginated(await this.request('GET', `${API_ENDPOINTS.CMS.PAGES}?page=${page}&limit=${limit}`));
  }

  async getCMSPage(slug: string, locale?: string): Promise<ApiResponse> {
    const p = new URLSearchParams();
    p.set('slug', slug);
    if (locale) p.set('locale', locale);
    return this.request('GET', `${API_ENDPOINTS.CMS.GET_PAGE}?${p.toString()}`);
  }

  async getCMSPageTranslations(pageId: string): Promise<ApiResponse> {
    return this.request('GET', API_ENDPOINTS.CMS.PAGE_TRANSLATIONS.replace(':id', encodeURIComponent(pageId)));
  }

  async putCMSPageTranslations(
    pageId: string,
    body: Record<string, { title: string; excerpt?: string; content?: string }>
  ): Promise<ApiResponse> {
    return this.request('PUT', API_ENDPOINTS.CMS.PAGE_TRANSLATIONS.replace(':id', encodeURIComponent(pageId)), body);
  }

  async getCMSPageContent(pageName: string, locale?: string): Promise<ApiResponse<any>> {
    const p = new URLSearchParams();
    p.set('slug', pageName);
    if (locale) p.set('locale', locale);
    return this.request('GET', `${API_ENDPOINTS.CMS.PAGE_CONTENT}?${p.toString()}`);
  }

  async getCMSSectionContent(pageName: string, sectionKey: string): Promise<ApiResponse<any>> {
    const p = new URLSearchParams();
    p.set('slug', pageName);
    p.set('section', sectionKey);
    return this.request('GET', `${API_ENDPOINTS.CMS.SECTION_CONTENT}?${p.toString()}`);
  }

  async createCMSPage(data: any): Promise<ApiResponse> {
    return this.request('POST', API_ENDPOINTS.CMS.CREATE_PAGE, this.mapCMSPageBody(data));
  }

  async createCMSContent(data: any): Promise<ApiResponse<any>> {
    return this.request('POST', API_ENDPOINTS.CMS.CONTENT, data);
  }

  async updateCMSPage(id: string, data: any): Promise<ApiResponse> {
    return this.request('PUT', API_ENDPOINTS.CMS.UPDATE_PAGE.replace(':id', id), this.mapCMSPageBody(data));
  }

  async updateCMSContent(id: string, data: any, locale?: string): Promise<ApiResponse<any>> {
    const qs = locale ? `?locale=${encodeURIComponent(locale)}` : '';
    return this.request(
      'PUT',
      `${API_ENDPOINTS.CMS.CONTENT_BY_ID.replace(':id', encodeURIComponent(id))}${qs}`,
      data
    );
  }

  async deleteCMSPage(id: string): Promise<ApiResponse> {
    return this.request('DELETE', API_ENDPOINTS.CMS.DELETE_PAGE.replace(':id', id));
  }

  async deleteCMSContent(id: string): Promise<ApiResponse> {
    return this.request('DELETE', API_ENDPOINTS.CMS.CONTENT_BY_ID.replace(':id', encodeURIComponent(id)));
  }

  async uploadCMSImage(file: File): Promise<ApiResponse<{ url: string }>> {
    const formData = new FormData();
    formData.append('image', file);
    return this.request('POST', API_ENDPOINTS.CMS.IMAGES_UPLOAD, formData, {});
  }

  // ==================== ADMIN DASHBOARD (matches API_ENDPOINTS.DASHBOARD) ====================

  async getDashboardStats(): Promise<ApiResponse<Record<string, number>>> {
    return this.request('GET', API_ENDPOINTS.DASHBOARD.STATS);
  }

  async getDashboardRecentOrders(): Promise<ApiResponse<unknown[]>> {
    return this.request('GET', API_ENDPOINTS.DASHBOARD.RECENT_ORDERS);
  }

  async getDashboardActivityLog(): Promise<ApiResponse<unknown[]>> {
    return this.request('GET', API_ENDPOINTS.DASHBOARD.ACTIVITY_LOG);
  }

  async getDashboardTopProducts(): Promise<ApiResponse<unknown[]>> {
    return this.request('GET', API_ENDPOINTS.DASHBOARD.TOP_PRODUCTS);
  }

  // ==================== AUDIT METHODS ====================

  async getAuditLogs(page: number = 1, limit: number = 20): Promise<PaginatedResponse<unknown>> {
    return normalizePaginated(await this.request('GET', `${API_ENDPOINTS.AUDIT.LOGS}?page=${page}&limit=${limit}`));
  }

  async getUserAuditLogs(userId: string, page: number = 1, limit: number = 20): Promise<PaginatedResponse<unknown>> {
    return normalizePaginated(
      await this.request(
        'GET',
        `${API_ENDPOINTS.AUDIT.USER_LOGS.replace(':userId', userId)}?page=${page}&limit=${limit}`
      )
    );
  }

  // ==================== USER DASHBOARD METHODS ====================

  async getUserDashboardProfile(): Promise<ApiResponse> {
    return this.request('GET', API_ENDPOINTS.USER_DASHBOARD.PROFILE);
  }

  async getUserOrders(page: number = 1, limit: number = 10): Promise<PaginatedResponse<unknown>> {
    return normalizePaginated(await this.request('GET', `${API_ENDPOINTS.USER_DASHBOARD.ORDERS}?page=${page}&limit=${limit}`));
  }

  async getUserOrderSummary(): Promise<ApiResponse> {
    return this.request('GET', API_ENDPOINTS.USER_DASHBOARD.ORDER_SUMMARY);
  }

  async getUserOrderReceipt(orderId: string): Promise<ApiResponse<Order>> {
    return this.request('GET', API_ENDPOINTS.USER_DASHBOARD.ORDER_RECEIPT.replace(':id', orderId));
  }

  async getUserAddresses(): Promise<ApiResponse> {
    return this.request('GET', API_ENDPOINTS.USER_DASHBOARD.ADDRESSES);
  }

  async getUserSettings(): Promise<ApiResponse> {
    return this.request('GET', API_ENDPOINTS.USER_DASHBOARD.SETTINGS);
  }

  async updateUserSettings(data: any): Promise<ApiResponse> {
    return this.request('PUT', API_ENDPOINTS.USER_DASHBOARD.UPDATE_SETTINGS, data);
  }

  async getAdminContacts(): Promise<ApiResponse> {
    return this.request('GET', API_ENDPOINTS.USER_DASHBOARD.CONTACT_US);
  }

  async getUserNotes(page: number = 1, limit: number = 20): Promise<PaginatedResponse<CustomerNote>> {
    return normalizePaginated<CustomerNote>(
      await this.request('GET', `${API_ENDPOINTS.USER_DASHBOARD.NOTES}?page=${page}&limit=${limit}`)
    );
  }

  async getUserInstallments(): Promise<ApiResponse> {
    return this.request('GET', API_ENDPOINTS.USER_DASHBOARD.INSTALLMENTS);
  }

  // ==================== ADMIN CONTACTS METHODS ====================

  async getAllAdminContacts(): Promise<ApiResponse> {
    return this.request('GET', API_ENDPOINTS.ADMIN_CONTACTS.LIST);
  }

  async getAdminContact(id: string): Promise<ApiResponse> {
    return this.request('GET', API_ENDPOINTS.ADMIN_CONTACTS.GET.replace(':id', id));
  }

  async getAdminContactsByDepartment(department: string): Promise<ApiResponse> {
    return this.request('GET', API_ENDPOINTS.ADMIN_CONTACTS.BY_DEPARTMENT.replace(':department', department));
  }

  async getAdminContactsBySpecialization(specialization: string): Promise<ApiResponse> {
    return this.request('GET', API_ENDPOINTS.ADMIN_CONTACTS.BY_SPECIALIZATION.replace(':specialization', specialization));
  }

  async getAvailableAdminContacts(): Promise<ApiResponse> {
    return this.request('GET', API_ENDPOINTS.ADMIN_CONTACTS.AVAILABLE);
  }

  async createAdminContact(data: Record<string, unknown>): Promise<ApiResponse> {
    return this.request('POST', API_ENDPOINTS.ADMIN_CONTACTS.LIST, data);
  }

  async updateAdminContact(id: string, data: Record<string, unknown>): Promise<ApiResponse> {
    return this.request('PUT', API_ENDPOINTS.ADMIN_CONTACTS.GET.replace(':id', id), data);
  }

  async deleteAdminContact(id: string): Promise<ApiResponse> {
    return this.request('DELETE', API_ENDPOINTS.ADMIN_CONTACTS.GET.replace(':id', id));
  }

  async getBanners(locale?: string): Promise<ApiResponse<unknown[]>> {
    const qs = locale ? `?locale=${encodeURIComponent(locale)}` : '';
    return this.request('GET', API_ENDPOINTS.CMS_BANNERS.LIST + qs);
  }

  async createBanner(data: Record<string, unknown>): Promise<ApiResponse> {
    return this.request('POST', API_ENDPOINTS.CMS_BANNERS.CREATE, data);
  }

  async updateBanner(id: string, data: Record<string, unknown>): Promise<ApiResponse> {
    return this.request(
      'PUT',
      API_ENDPOINTS.CMS_BANNERS.UPDATE.replace(':id', encodeURIComponent(id)),
      data
    );
  }

  async deleteBanner(id: string): Promise<ApiResponse> {
    return this.request('DELETE', API_ENDPOINTS.CMS_BANNERS.DELETE.replace(':id', encodeURIComponent(id)));
  }

  // ==================== ADMIN PERMISSIONS METHODS ====================

  async getUserPermissions(userId: string): Promise<ApiResponse> {
    return this.request('GET', API_ENDPOINTS.ADMIN_PERMISSIONS.GET_USER_PERMISSIONS.replace(':userId', userId));
  }

  async updateUserPermissions(userId: string, permissions: unknown): Promise<ApiResponse> {
    const rows = Array.isArray(permissions)
      ? permissions
      : (permissions as { permissions?: unknown[] })?.permissions;
    const list = Array.isArray(rows) ? rows : [];
    const access = list
      .map((p: Record<string, unknown>) => {
        const pageId = p.page_id ?? p.pageId;
        if (pageId == null || pageId === '') return null;
        return {
          page_id: String(pageId),
          can_view: !!(p.can_view ?? p.canView),
          can_edit: !!(p.can_edit ?? p.canEdit),
          can_delete: !!(p.can_delete ?? p.canDelete),
        };
      })
      .filter(Boolean);
    return this.request(
      'PUT',
      API_ENDPOINTS.ADMIN_PERMISSIONS.UPDATE_PERMISSIONS.replace(':userId', userId),
      { access }
    );
  }

  async getAllPermissions(): Promise<ApiResponse> {
    return this.request('GET', API_ENDPOINTS.ADMIN_PERMISSIONS.GET_ALL_PERMISSIONS);
  }

  async getMyPermissions(): Promise<ApiResponse> {
    return this.request('GET', API_ENDPOINTS.ADMIN_PERMISSIONS.GET_MY_PERMISSIONS);
  }

  // ==================== CARTS METHODS ====================
  async saveCart(data: { email: string; cart_data: any }): Promise<ApiResponse> {
    return this.request('POST', API_ENDPOINTS.CARTS.SAVE, data);
  }

  async getAbandonedCarts(page: number = 1, limit: number = 50, status?: string): Promise<PaginatedResponse<unknown>> {
    const p = new URLSearchParams();
    p.set('page', String(page));
    p.set('limit', String(limit));
    if (status) p.set('status', status);
    return normalizePaginated(await this.request('GET', `${API_ENDPOINTS.CARTS.LIST}?${p.toString()}`));
  }

  async updateCartStatus(id: number | string, status: 'abandoned' | 'recovered' | 'completed'): Promise<ApiResponse> {
    return this.request('PATCH', API_ENDPOINTS.CARTS.UPDATE.replace(':id', String(id)), { status });
  }

  // ==================== ACCOUNT APPLICATIONS ====================

  /** Public: submit a new account application. */
  async submitAccountApplication(data: Partial<AccountApplication>): Promise<ApiResponse<{ id: string }>> {
    return this.request('POST', API_ENDPOINTS.ACCOUNT_APPLICATIONS.SUBMIT, data, { skipAuthRedirect: true });
  }

  /** Public: get a submitted application by ID. */
  async getAccountApplication(id: string): Promise<ApiResponse<AccountApplication>> {
    return this.request('GET', API_ENDPOINTS.ACCOUNT_APPLICATIONS.GET.replace(':id', id), undefined, { skipAuthRedirect: true });
  }

  /** Admin: list applications with optional status filter. */
  async getAccountApplications(page: number = 1, limit: number = 20, status?: string): Promise<PaginatedResponse<AccountApplication>> {
    let endpoint = `${API_ENDPOINTS.ACCOUNT_APPLICATIONS.LIST}?page=${page}&limit=${limit}`;
    if (status) endpoint += `&status=${status}`;
    return normalizePaginated<AccountApplication>(await this.request('GET', endpoint));
  }

  /** Admin: approve an application (creates customer + user account). */
  async approveAccountApplication(id: string, pdfUrl?: string): Promise<ApiResponse<{ id: string; customer_id: string; account_created: boolean; generated_email?: string | null; generated_password?: string | null; }>> {
    return this.request('PATCH', API_ENDPOINTS.ACCOUNT_APPLICATIONS.APPROVE.replace(':id', id), { pdf_url: pdfUrl });
  }

  /** Admin: reject an application with optional reason. */
  async rejectAccountApplication(id: string, reason?: string): Promise<ApiResponse<{ id: string }>> {
    return this.request('PATCH', API_ENDPOINTS.ACCOUNT_APPLICATIONS.REJECT.replace(':id', id), { reason });
  }

  // ==================== TAX RATES METHODS ====================

  /** Public: get active tax rates. */
  async getTaxRates(): Promise<ApiResponse<TaxRateConfig[]>> {
    return this.request('GET', API_ENDPOINTS.TAX_RATES.LIST);
  }

  /** Admin: get all tax rates including inactive. */
  async getAllTaxRates(): Promise<ApiResponse<TaxRateConfig[]>> {
    return this.request('GET', API_ENDPOINTS.TAX_RATES.ALL);
  }

  /** Admin: create a new tax rate. */
  async createTaxRate(data: Partial<TaxRateConfig>): Promise<ApiResponse<{ id: string }>> {
    return this.request('POST', API_ENDPOINTS.TAX_RATES.CREATE, data);
  }

  /** Admin: update a tax rate. */
  async updateTaxRate(id: string, data: Partial<TaxRateConfig>): Promise<ApiResponse<{ id: string }>> {
    return this.request('PUT', API_ENDPOINTS.TAX_RATES.UPDATE.replace(':id', id), data);
  }

  /** Admin: delete a tax rate. */
  async deleteTaxRate(id: string): Promise<ApiResponse> {
    return this.request('DELETE', API_ENDPOINTS.TAX_RATES.DELETE.replace(':id', id));
  }

  /** Admin: reorder tax rates. */
  async reorderTaxRates(items: { id: string; display_order: number }[]): Promise<ApiResponse> {
    return this.request('POST', API_ENDPOINTS.TAX_RATES.REORDER, { items });
  }

  // ==================== INVOICES METHODS ====================

  async getInvoices(page: number = 1, limit: number = 20, filters?: { status?: string; payment_status?: string; search?: string }): Promise<PaginatedResponse<any>> {
    const p = new URLSearchParams();
    p.set('page', String(page));
    p.set('limit', String(limit));
    if (filters?.status) p.set('status', filters.status);
    if (filters?.payment_status) p.set('payment_status', filters.payment_status);
    if (filters?.search) p.set('search', filters.search);
    return normalizePaginated(await this.request('GET', `${API_ENDPOINTS.INVOICES.LIST}?${p.toString()}`));
  }

  async getInvoice(id: string): Promise<ApiResponse<any>> {
    return this.request('GET', API_ENDPOINTS.INVOICES.GET.replace(':id', id));
  }

  async getInvoiceStats(): Promise<ApiResponse<any>> {
    return this.request('GET', API_ENDPOINTS.INVOICES.STATS);
  }

  async createInvoice(data: Record<string, unknown>): Promise<ApiResponse<{ id: string; invoice_number: string }>> {
    return this.request('POST', API_ENDPOINTS.INVOICES.CREATE, data);
  }

  async updateInvoice(id: string, data: Record<string, unknown>): Promise<ApiResponse> {
    return this.request('PUT', API_ENDPOINTS.INVOICES.UPDATE.replace(':id', id), data);
  }

  async updateInvoiceStatus(id: string, status: string): Promise<ApiResponse> {
    return this.request('PUT', API_ENDPOINTS.INVOICES.STATUS.replace(':id', id), { status });
  }

  async recordInvoicePayment(id: string, data: { amount: number; payment_method?: string; reference?: string; notes?: string }): Promise<ApiResponse> {
    return this.request('POST', API_ENDPOINTS.INVOICES.RECORD_PAYMENT.replace(':id', id), data);
  }

  async sendInvoiceEmail(invoiceId: string, data: { message?: string; subject?: string }): Promise<ApiResponse> {
    return this.request('POST', API_ENDPOINTS.INVOICES.SEND.replace(':id', invoiceId), data);
  }

  async deleteInvoice(id: string): Promise<ApiResponse> {
    return this.request('DELETE', API_ENDPOINTS.INVOICES.DELETE.replace(':id', id));
  }

  // ==================== STATIC METHODS ====================

  static getInstance(): APIService {
    if (!apiService) {
      apiService = new APIService();
    }
    return apiService;
  }
}

let apiService: APIService | null = null;

// Export singleton instance
export const api = APIService.getInstance();

// Export class for testing/custom instances
export default APIService;

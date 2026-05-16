export const SITE_NAME = "REMQUIP";
export const SITE_DESCRIPTION = "Canada's Next-Generation Heavy-Duty Parts Distributor";
export const SITE_URL = "https://www.remquip.ca";

export const ORDER_STATUSES = ["pending", "confirmed", "processing", "shipped", "delivered", "completed", "cancelled", "refunded"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const SHIPMENT_STATUSES = ["pending", "label_created", "in_transit", "delivered", "exception"] as const;
export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];

/** Fallbacks when GET /settings/storefront is unavailable (matches seeded DB defaults). */
export const TAX_RATE = 0.14975;
export const FREE_SHIPPING_THRESHOLD = 500;
export const FLAT_SHIPPING_RATE = 25;

/**
 * Backend API origin. Must use **HTTPS** when the app is served over HTTPS (e.g. Vercel), or the browser blocks requests (mixed content).
 * Folder that contains `api.php` and `cms/*.php` (e.g. `.../remquip/backend`). Most API calls use `api.php?path=…`; some use direct `*.php`.
 * Optional: set `VITE_API_BASE_URL` in Vercel / `.env` for a different API host (no trailing slash).
 */
const envApi =
  typeof import.meta.env.VITE_API_BASE_URL === "string" ? import.meta.env.VITE_API_BASE_URL.trim().replace(/\/$/, "") : "";
export const API_BASE_URL = envApi || "https://luccibyey.com.tn/remquip/backend";

export const RATE_LIMITS = {
  auth: { requests: 10, windowMs: 60_000 },
  public: { requests: 100, windowMs: 60_000 },
  admin: { requests: 200, windowMs: 60_000 },
} as const;

// Admin no-auth mode: admin CRUD endpoints do not require Bearer tokens.
// This is set to true to match `Backend/config.php` ADMIN_NO_AUTH.
export const ADMIN_NO_AUTH = true;

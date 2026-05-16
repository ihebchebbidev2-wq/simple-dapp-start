import { API_BASE_URL } from "@/config/constants";

/**
 * Resolves a URL returned by the backend (which may be relative, absolute,
 * or a data:/blob: URI) into a fully-qualified URL the browser can load.
 *
 * Why: backend upload endpoints return relative paths like
 *   "/Backend/uploads/signatures_images/SIG-...png"
 * If we put that straight into <img src>, the browser resolves it against
 * the current origin (e.g. lovableproject.com) instead of the API host
 * (luccibyey.com.tn/remquip), so the image 404s.
 *
 * Also normalizes the legacy capitalized "/Backend/" segment that some
 * older upload responses returned, since the actual directory served is
 * lowercase "/backend/".
 */
export function resolveAssetUrl(url?: string | null): string {
  if (!url) return "";
  const trimmed = String(url).trim();
  if (!trimmed) return "";

  // Already a data URI, blob URI, or absolute URL - use as-is
  if (/^(data:|blob:|https?:\/\/)/i.test(trimmed)) return trimmed;

  // Normalize legacy "/Backend/" -> "/backend/"
  let path = trimmed.replace(/^\/?Backend\//, "/backend/");
  if (!path.startsWith("/")) path = "/" + path;

  // API_BASE_URL points to ".../backend" -- strip its trailing "/backend"
  // so we don't end up with ".../backend/backend/uploads/..."
  const apiOrigin = API_BASE_URL.replace(/\/backend\/?$/i, "");

  // If the relative path already starts with "/backend/", prepend just origin
  if (/^\/backend\//i.test(path)) {
    return apiOrigin.replace(/\/$/, "") + path;
  }

  // Otherwise prepend the full API base
  return API_BASE_URL.replace(/\/$/, "") + path;
}

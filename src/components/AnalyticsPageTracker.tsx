import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { api } from "@/lib/api";

/**
 * Sends `page_view` rows to `POST /analytics/events` (optional auth for user attribution).
 */
export default function AnalyticsPageTracker() {
  const location = useLocation();
  const lastPath = useRef<string>("");

  useEffect(() => {
    const path = location.pathname + location.search;
    if (path === lastPath.current) return;
    lastPath.current = path;

    const t = window.setTimeout(() => {
      api.postAnalyticsEvent("page_view", {
        path: location.pathname,
        search: location.search || undefined,
        title: typeof document !== "undefined" ? document.title : undefined,
      }).catch(() => {});
    }, 400);

    return () => window.clearTimeout(t);
  }, [location.pathname, location.search]);

  return null;
}

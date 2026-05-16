import { useEffect, useRef, useState, useCallback } from "react";
import { API_BASE_URL } from "@/config/constants";
import { showSuccessToast } from "@/lib/toast";

const POLL_INTERVAL = 30_000; // 30 seconds

async function fetchUnreadCount(): Promise<number> {
  try {
    const base = API_BASE_URL.replace(/\/+$/, "");
    const token =
      localStorage.getItem("remquip_admin_token") ??
      localStorage.getItem("remquip_auth_token") ??
      "";
    if (!token) return 0;
    const params = new URLSearchParams({ path: "chat/unread-count" });
    params.set("token", token);
    const res = await fetch(`${base}/remquip-api.php?${params}`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-Auth-Token": token,
      },
    });
    const json = await res.json();
    return json?.data?.count ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Poll for unread chat messages.
 * Returns { unreadCount, refresh }.
 * Shows a toast when new unread messages arrive.
 */
export function useChatNotifications(enabled = true) {
  const [unreadCount, setUnreadCount] = useState(0);
  const prevRef = useRef(0);

  const refresh = useCallback(async () => {
    const count = await fetchUnreadCount();
    // Toast only when count increases (new message arrived)
    if (count > prevRef.current && prevRef.current >= 0) {
      const diff = count - prevRef.current;
      showSuccessToast(
        "💬 New Chat Message",
        `You have ${diff} new unread message${diff > 1 ? "s" : ""}`
      );
    }
    prevRef.current = count;
    setUnreadCount(count);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    // Initial fetch (no toast on first load)
    fetchUnreadCount().then((count) => {
      prevRef.current = count;
      setUnreadCount(count);
    });

    const interval = setInterval(refresh, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [enabled, refresh]);

  return { unreadCount, refresh };
}

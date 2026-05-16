import { useEffect, useRef, useState, useCallback } from "react";
import { API_BASE_URL } from "@/config/constants";
import { AUTH_TOKEN_KEY_ADMIN } from "@/contexts/AuthContext";
import { type UpcomingTask } from "@/lib/api";
import { showSuccessToast } from "@/lib/toast";

const POLL_INTERVAL = 60_000; // 60s

/** Read the admin token directly from storage (route-independent). */
function getAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  try { return localStorage.getItem(AUTH_TOKEN_KEY_ADMIN); } catch { return null; }
}

/**
 * Polls /customers/tasks/upcoming for tasks due within 48h or already overdue.
 * Uses the admin token directly so it works on ANY page (storefront or admin).
 */
export function useUpcomingTasks(enabled = true) {
  const [tasks, setTasks] = useState<UpcomingTask[]>([]);
  const [hasAdminToken, setHasAdminToken] = useState<boolean>(!!getAdminToken());
  const prevIdsRef = useRef<Set<string>>(new Set());
  const initialDoneRef = useRef(false);

  const refresh = useCallback(async () => {
    const token = getAdminToken();
    if (!token) {
      setHasAdminToken(false);
      setTasks([]);
      return;
    }
    setHasAdminToken(true);
    try {
      const url = `${API_BASE_URL}/api.php?path=/customers/tasks/upcoming&token=${encodeURIComponent(token)}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      if (!res.ok) return;
      const json = await res.json().catch(() => null);
      const list = (json?.data ?? []) as UpcomingTask[];
      if (initialDoneRef.current) {
        const prev = prevIdsRef.current;
        const fresh = list.filter((t) => !prev.has(t.id));
        if (fresh.length > 0) {
          showSuccessToast(
            "🔔 Task Reminder",
            `${fresh.length} task${fresh.length > 1 ? "s" : ""} due soon`,
          );
        }
      }
      prevIdsRef.current = new Set(list.map((t) => t.id));
      setTasks(list);
      initialDoneRef.current = true;
    } catch {
      /* swallow — sidebar badge stays at last known count */
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    refresh();
    const i = setInterval(refresh, POLL_INTERVAL);
    // Re-detect admin login/logout across tabs
    const onStorage = (e: StorageEvent) => {
      if (e.key === AUTH_TOKEN_KEY_ADMIN) refresh();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      clearInterval(i);
      window.removeEventListener("storage", onStorage);
    };
  }, [enabled, refresh]);

  return { tasks, refresh, count: tasks.length, hasAdminToken };
}

/** Mark a task as done using the admin token directly (route-independent). */
export async function markTaskDoneWithAdminToken(taskId: string): Promise<void> {
  const token = getAdminToken();
  if (!token) throw new Error("Admin session required");
  const url = `${API_BASE_URL}/api.php?path=/customers/tasks/${encodeURIComponent(taskId)}&token=${encodeURIComponent(token)}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status: "done" }),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw new Error(json?.message || `Request failed (${res.status})`);
  }
}

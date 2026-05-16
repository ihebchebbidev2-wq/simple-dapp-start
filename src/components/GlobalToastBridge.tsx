import { useEffect } from "react";
import { toast } from "sonner";
import { subscribeToToasts, subscribeToDismiss } from "@/lib/toast";
import type { Toast as AppToast } from "@/lib/toast";

/**
 * Bridges the custom toast pub/sub system (src/lib/toast.ts) to Sonner UI,
 * and intercepts unhandled errors / promise rejections to show error toasts.
 */
export function GlobalToastBridge() {
  // Bridge custom toast events → Sonner
  useEffect(() => {
    const unsubToasts = subscribeToToasts((t: AppToast) => {
      const opts: Parameters<typeof toast>[1] = {
        id: t.id,
        description: t.message || undefined,
        duration: t.duration ?? 4000,
        action: t.action
          ? { label: t.action.label, onClick: t.action.onClick }
          : undefined,
      };

      switch (t.type) {
        case "success":
          toast.success(t.title, opts);
          break;
        case "error":
          toast.error(t.title, opts);
          break;
        case "warning":
          toast.warning(t.title, opts);
          break;
        case "info":
        default:
          toast.info(t.title, opts);
          break;
      }
    });

    const unsubDismiss = subscribeToDismiss((id: string) => {
      toast.dismiss(id);
    });

    return () => {
      unsubToasts();
      unsubDismiss();
    };
  }, []);

  // Intercept unhandled errors → error toast
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      // Skip chunk load errors (handled by ErrorBoundary)
      const msg = event.message?.toLowerCase() ?? "";
      if (
        msg.includes("dynamically imported module") ||
        msg.includes("loading chunk") ||
        msg.includes("script error")
      ) {
        return;
      }
      toast.error("Unexpected Error", {
        description: event.message || "An unknown error occurred",
        duration: 6000,
      });
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message =
        reason instanceof Error
          ? reason.message
          : typeof reason === "string"
            ? reason
            : "An unhandled promise error occurred";
      toast.error("Error", {
        description: message,
        duration: 6000,
      });
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  return null;
}

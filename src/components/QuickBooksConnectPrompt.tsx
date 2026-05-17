import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import quickbooksLogo from "@/assets/integrations/quickbooks.png";
import { api } from "@/lib/api";
import { SITE_URL } from "@/config/constants";
import { showErrorToast } from "@/lib/toast";

const DISMISS_KEY = "qbo_connect_prompt_dismissed";

function canonicalAppBaseUrl(): string {
  if (SITE_URL) return SITE_URL.replace(/\/+$/, "");
  if (typeof window !== "undefined" && window.location?.origin) return window.location.origin;
  return "";
}

interface Integration {
  provider: string;
  status?: string;
  has_credentials?: boolean;
  credentials?: { redirect_uri?: string };
}

/**
 * Shows a one-time (per session) modal on app entry asking the user to
 * authorize QuickBooks. Clicking "Connect QuickBooks" starts the OAuth
 * flow and redirects the browser to Intuit for authorization.
 */
export function QuickBooksConnectPrompt() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Don't show on admin OAuth callback page or admin login (avoids loops)
    if (window.location.pathname.startsWith("/admin/integrations/oauth/")) return;
    if (sessionStorage.getItem(DISMISS_KEY) === "1") return;

    let cancelled = false;
    (async () => {
      try {
        const res: any = await api.request("GET", "integrations");
        const list: Integration[] = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
        const qbo = list.find((i) => i.provider === "quickbooks");
        if (cancelled) return;
        // Only prompt if QuickBooks is not currently connected
        if (!qbo || qbo.status !== "connected") {
          setOpen(true);
        }
      } catch {
        // If we can't read integrations (e.g. unauthenticated/public), still prompt
        if (!cancelled) setOpen(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const dismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setOpen(false);
  };

  const handleConnect = async () => {
    try {
      setBusy(true);
      const redirectUri = `${canonicalAppBaseUrl()}/admin/integrations/oauth/quickbooks`;
      const qs = `?redirect_uri=${encodeURIComponent(redirectUri)}`;
      const res: any = await api.request("GET", `integrations/quickbooks/oauth/start${qs}`);
      const authorizeUrl: string | undefined = res?.data?.authorize_url || res?.authorize_url;
      if (!authorizeUrl) throw new Error("QuickBooks did not return an authorization URL.");
      sessionStorage.setItem(DISMISS_KEY, "1");
      window.location.assign(authorizeUrl);
    } catch (e: any) {
      showErrorToast(e?.message || "Failed to start QuickBooks authorization");
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : dismiss())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex justify-center mb-2">
            <img src={quickbooksLogo} alt="QuickBooks" className="h-12 w-auto" />
          </div>
          <DialogTitle className="text-center">Connect QuickBooks</DialogTitle>
          <DialogDescription className="text-center">
            Authorize QuickBooks Online so Remquip can sync customers, invoices and payments automatically.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:justify-center">
          <Button variant="ghost" onClick={dismiss} disabled={busy}>
            Not now
          </Button>
          <Button onClick={handleConnect} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Connect QuickBooks
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default QuickBooksConnectPrompt;
import { useState } from "react";
import { Copy, Check, Info, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SITE_URL } from "@/config/constants";
import { showSuccessToast } from "@/lib/toast";

interface IntegrationUrlsDocModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Documentation modal listing every public-facing URL required to submit the
 * REMQUIP app to the QuickBooks / Intuit Developer Portal.
 * Auto-opens on first visit and can be reopened via the "Setup URLs" button.
 */
export function IntegrationUrlsDocModal({ open, onOpenChange }: IntegrationUrlsDocModalProps) {
  const base = (SITE_URL || "https://www.remquip.ca").replace(/\/+$/, "");
  const host = base.replace(/^https?:\/\//, "");

  const rows: Array<{
    label: string;
    value: string;
    note: string;
    badge?: string;
  }> = [
    {
      label: "Host domain",
      value: host,
      note: "Customer-facing domain, no protocol. Intuit uses it for branding & URL validation.",
      badge: "no https://",
    },
    {
      label: "Launch URL",
      value: `${base}/admin/integrations`,
      note: "Where Intuit sends customers after they click 'Launch' on apps.intuit.com.",
    },
    {
      label: "Disconnect URL",
      value: `${base}/admin/integrations?action=disconnect`,
      note: "Opened when a customer clicks 'Disconnect' from inside QuickBooks.",
    },
    {
      label: "Connect / Reconnect URL",
      value: `${base}/admin/integrations?action=connect`,
      note: "Entry point if the connection breaks or the token expires.",
    },
    {
      label: "Redirect URI (OAuth 2.0)",
      value: `${base}/admin/integrations/oauth/quickbooks`,
      note: "Add this exact URL to Keys & OAuth → Redirect URIs (Sandbox AND Production).",
      badge: "required",
    },
    {
      label: "EULA URL",
      value: `${base}/eula`,
      note: "End-User License Agreement page — public, no login required.",
    },
    {
      label: "Privacy Policy URL",
      value: `${base}/privacy`,
      note: "Privacy Policy page — public, no login required.",
    },
    {
      label: "Webhook (Notification) URL",
      value: `${base.replace("www.remquip.ca", "luccibyey.com.tn/remquip/backend")}/router.php?path=integrations/quickbooks/webhook`,
      note: "Optional. Paste in Intuit → Webhooks. Backend endpoint, NOT the frontend domain.",
    },
  ];

  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (key: string, val: string) => {
    try {
      await navigator.clipboard.writeText(val);
      setCopied(key);
      showSuccessToast("Copied to clipboard");
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1800);
    } catch {
      /* ignore */
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Info className="h-5 w-5 text-primary" />
            <DialogTitle>QuickBooks / Intuit App Submission URLs</DialogTitle>
          </div>
          <DialogDescription>
            Copy these values into the corresponding fields in the{" "}
            <a
              href="https://developer.intuit.com/app/developer/dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline"
            >
              Intuit Developer Portal
              <ExternalLink className="h-3 w-3" />
            </a>
            . All URLs are public-facing and tied to your live frontend domain.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          {rows.map((row) => {
            const key = row.label;
            return (
              <div
                key={key}
                className="rounded-lg border bg-card p-3 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{row.label}</span>
                    {row.badge && (
                      <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                        {row.badge}
                      </Badge>
                    )}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2"
                    onClick={() => copy(key, row.value)}
                  >
                    {copied === key ? (
                      <>
                        <Check className="h-3.5 w-3.5 mr-1 text-emerald-500" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5 mr-1" /> Copy
                      </>
                    )}
                  </Button>
                </div>
                <code className="block text-xs font-mono bg-muted/60 rounded px-2 py-1.5 break-all">
                  {row.value}
                </code>
                <p className="text-xs text-muted-foreground mt-1.5">{row.note}</p>
              </div>
            );
          })}
        </div>

        <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-900 dark:text-amber-200">
          <strong>Sandbox vs Production:</strong> Intuit keeps separate URL whitelists for each
          environment. If you're testing with Sandbox keys, paste these URLs under{" "}
          <em>Development settings</em>. When you go live, repeat under <em>Production settings</em>.
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

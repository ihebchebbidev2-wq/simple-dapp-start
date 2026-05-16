import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams, Link } from "react-router-dom";
import { CheckCircle2, XCircle, Loader2, ArrowLeft } from "lucide-react";
import { api } from "@/lib/api";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

type Status = "processing" | "success" | "error";

/**
 * OAuth callback handler for integrations.
 * Route: /admin/integrations/oauth/:provider
 *
 * On mount, captures the query params returned by the provider:
 *   - QuickBooks: ?code=...&state=...&realmId=...
 *   - (eBay / Amazon will be added the same way once their OAuth flows ship)
 *
 * Posts them to the backend, which exchanges the code for access+refresh tokens
 * and flips the integration to status='connected' automatically.
 */
export default function AdminIntegrationsOAuthCallback() {
  const { provider = "" } = useParams<{ provider: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const [status, setStatus] = useState<Status>("processing");
  const [message, setMessage] = useState<string>("Finalising connection…");
  const [details, setDetails] = useState<Record<string, string>>({});
  const ranRef = useRef(false); // guard against React StrictMode double-invoke

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    // 1) Surface provider-side errors immediately
    const oauthError = params.get("error");
    if (oauthError) {
      setStatus("error");
      setMessage(
        params.get("error_description") || `Provider returned error: ${oauthError}`,
      );
      return;
    }

    // 2) Extract the parameters we expect for each provider
    const code    = params.get("code")    || "";
    const state   = params.get("state")   || "";
    const realmId = params.get("realmId") || params.get("realm_id") || "";

    if (provider === "quickbooks") {
      if (!code || !state || !realmId) {
        setStatus("error");
        setMessage("Missing code, state or realmId in callback URL.");
        setDetails({ code, state, realmId });
        return;
      }

      api
        .request("POST", "integrations/quickbooks/oauth/callback", {
          code,
          state,
          realmId,
        })
        .then((res) => {
          setStatus("success");
          setMessage(res?.message || "QuickBooks connected successfully.");
          const data = (res?.data ?? {}) as Record<string, unknown>;
          setDetails({
            realm_id: String(data.realm_id ?? realmId),
            token_expires_at: String(data.token_expires_at ?? ""),
          });
          // Auto-redirect after 2.5s
          setTimeout(() => navigate("/admin/integrations", { replace: true }), 2500);
        })
        .catch((e: unknown) => {
          setStatus("error");
          const msg =
            (e as { message?: string })?.message ||
            "Failed to exchange OAuth code with backend.";
          setMessage(msg);
        });
      return;
    }

    // Amazon / eBay placeholders — will be implemented when their flows go live
    setStatus("error");
    setMessage(`OAuth callback for "${provider}" is not implemented yet.`);
  }, [params, provider, navigate]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Integration Authorisation"
        subtitle={`Provider: ${provider || "unknown"}`}
      />

      <div className="admin-card max-w-2xl mx-auto">
        <div className="flex flex-col items-center text-center gap-4 py-8 px-6">
          {status === "processing" && (
            <Loader2 className="h-12 w-12 text-primary animate-spin" />
          )}
          {status === "success" && (
            <CheckCircle2 className="h-12 w-12 text-success" />
          )}
          {status === "error" && (
            <XCircle className="h-12 w-12 text-destructive" />
          )}

          <div>
            <h2 className="font-display font-black text-xl mb-1 capitalize">
              {status === "processing" && "Connecting…"}
              {status === "success" && "Connected"}
              {status === "error" && "Connection failed"}
            </h2>
            <p className="text-sm text-muted-foreground max-w-md">{message}</p>
          </div>

          {Object.keys(details).length > 0 && (
            <div className="w-full bg-muted/40 rounded-lg p-4 text-left text-xs font-mono space-y-1">
              {Object.entries(details).map(([k, v]) =>
                v ? (
                  <div key={k} className="flex gap-2">
                    <span className="text-muted-foreground min-w-[120px]">{k}:</span>
                    <span className="break-all">{v}</span>
                  </div>
                ) : null,
              )}
            </div>
          )}

          <Link
            to="/admin/integrations"
            className="admin-btn--secondary text-sm inline-flex items-center gap-2 mt-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Integrations
          </Link>
        </div>
      </div>
    </div>
  );
}

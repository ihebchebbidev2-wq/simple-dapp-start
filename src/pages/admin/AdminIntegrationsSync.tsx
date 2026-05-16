import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, CheckCircle2, XCircle, Users, Package, FileText, Play, RefreshCw, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { api } from "@/lib/api";
import { showErrorToast, showSuccessToast } from "@/lib/toast";

type GroupKey = "customers" | "inventory" | "accounting";
type EntityKey = "customers" | "products" | "inventory" | "invoices" | "estimates" | "payments";

interface SubStep {
  entity: EntityKey;
  label: string;
  status: "idle" | "running" | "done" | "error";
  processed: number;
  failed: number;
  durationMs?: number;
  error?: string;
}

interface Group {
  key: GroupKey;
  title: string;
  description: string;
  icon: typeof Users;
  steps: SubStep[];
}

interface Integration {
  status: string;
  last_sync_at: string | null;
  environment: string;
}

const GROUPS_DEF: Group[] = [
  {
    key: "customers",
    title: "Clients",
    description: "Bi-directional sync of active Customers (Leads & Contractors stay local).",
    icon: Users,
    steps: [{ entity: "customers", label: "Customers", status: "idle", processed: 0, failed: 0 }],
  },
  {
    key: "inventory",
    title: "Inventory",
    description: "Sync products, stock levels, prices and SKUs with QuickBooks Items.",
    icon: Package,
    steps: [
      { entity: "products", label: "Products (push)", status: "idle", processed: 0, failed: 0 },
      { entity: "inventory", label: "Stock & prices (pull)", status: "idle", processed: 0, failed: 0 },
    ],
  },
  {
    key: "accounting",
    title: "Accounting (view-only)",
    description: "Mirror invoices, quotes/estimates, and payments for the customer financial overview.",
    icon: FileText,
    steps: [
      { entity: "invoices", label: "Invoices", status: "idle", processed: 0, failed: 0 },
      { entity: "estimates", label: "Quotes / Estimates", status: "idle", processed: 0, failed: 0 },
      { entity: "payments", label: "Payments", status: "idle", processed: 0, failed: 0 },
    ],
  },
];

function fmtDate(s: string | null): string {
  if (!s) return "Never";
  try {
    return new Date(s).toLocaleString();
  } catch {
    return s;
  }
}

export default function AdminIntegrationsSync() {
  const [integration, setIntegration] = useState<Integration | null>(null);
  const [groups, setGroups] = useState<Group[]>(() => GROUPS_DEF.map((g) => ({ ...g, steps: g.steps.map((s) => ({ ...s })) })));
  const [running, setRunning] = useState<GroupKey | "all" | null>(null);

  async function loadIntegration() {
    try {
      const res = await api.request<{ data: Integration }>("GET", "integrations/quickbooks");
      setIntegration(res.data ?? (res as any));
    } catch (e: any) {
      showErrorToast(e?.message || "Failed to load integration");
    }
  }

  useEffect(() => {
    loadIntegration();
  }, []);

  const isConnected = integration?.status === "connected";

  function updateStep(groupKey: GroupKey, entity: EntityKey, patch: Partial<SubStep>) {
    setGroups((prev) =>
      prev.map((g) =>
        g.key !== groupKey
          ? g
          : { ...g, steps: g.steps.map((s) => (s.entity === entity ? { ...s, ...patch } : s)) },
      ),
    );
  }

  async function runStep(groupKey: GroupKey, step: SubStep) {
    const t0 = performance.now();
    updateStep(groupKey, step.entity, { status: "running", processed: 0, failed: 0, error: undefined });
    try {
      const res = await api.request<any>("POST", "integrations/quickbooks/sync", { entity: step.entity });
      const data = res?.data ?? res ?? {};
      const processed = Number(data.processed ?? data?.result?.processed ?? 0);
      const failed = Number(data.failed ?? data?.result?.failed ?? 0);
      updateStep(groupKey, step.entity, {
        status: failed > 0 ? "error" : "done",
        processed,
        failed,
        durationMs: Math.round(performance.now() - t0),
      });
    } catch (e: any) {
      updateStep(groupKey, step.entity, {
        status: "error",
        error: e?.message || "Sync failed",
        durationMs: Math.round(performance.now() - t0),
      });
      throw e;
    }
  }

  async function runGroup(groupKey: GroupKey) {
    if (!isConnected) {
      showErrorToast("Connect QuickBooks first from /admin/integrations");
      return;
    }
    setRunning(groupKey);
    const group = groups.find((g) => g.key === groupKey)!;
    let ok = true;
    for (const step of group.steps) {
      try {
        await runStep(groupKey, step);
      } catch {
        ok = false;
      }
    }
    setRunning(null);
    await loadIntegration();
    if (ok) showSuccessToast(`${group.title} sync complete`);
    else showErrorToast(`${group.title} sync finished with errors`);
  }

  async function runAll() {
    if (!isConnected) {
      showErrorToast("Connect QuickBooks first from /admin/integrations");
      return;
    }
    setRunning("all");
    for (const g of groups) {
      for (const step of g.steps) {
        try {
          await runStep(g.key, step);
        } catch {
          /* keep going */
        }
      }
    }
    setRunning(null);
    await loadIntegration();
    showSuccessToast("Full sync finished");
  }

  const overallProgress = useMemo(() => {
    const allSteps = groups.flatMap((g) => g.steps);
    const done = allSteps.filter((s) => s.status === "done" || s.status === "error").length;
    return Math.round((done / Math.max(1, allSteps.length)) * 100);
  }, [groups]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Run Sync Now"
        subtitle="Manually trigger QuickBooks bi-directional synchronization for clients, inventory, and accounting."
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/admin/integrations">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to integrations
              </Link>
            </Button>
            <Button onClick={runAll} disabled={!isConnected || running !== null} size="sm">
              {running === "all" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
              Sync everything
            </Button>
          </div>
        }
      />

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">QuickBooks Online</CardTitle>
              <CardDescription>
                Status:{" "}
                <Badge variant={isConnected ? "default" : "destructive"}>{integration?.status ?? "loading…"}</Badge>{" "}
                · Environment: {integration?.environment ?? "—"} · Last sync: {fmtDate(integration?.last_sync_at ?? null)}
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={loadIntegration}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Overall progress</span>
              <span>{overallProgress}%</span>
            </div>
            <Progress value={overallProgress} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {groups.map((group) => {
          const Icon = group.icon;
          const totalProcessed = group.steps.reduce((acc, s) => acc + s.processed, 0);
          const totalFailed = group.steps.reduce((acc, s) => acc + s.failed, 0);
          const isRunningHere = running === group.key || running === "all";
          return (
            <Card key={group.key} className="flex flex-col">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Icon className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">{group.title}</CardTitle>
                </div>
                <CardDescription>{group.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-4">
                <div className="space-y-3">
                  {group.steps.map((step) => (
                    <div key={step.entity} className="rounded-md border p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          {step.status === "running" && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                          {step.status === "done" && <CheckCircle2 className="h-4 w-4 text-primary" />}
                          {step.status === "error" && <XCircle className="h-4 w-4 text-destructive" />}
                          {step.status === "idle" && <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />}
                          {step.label}
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {step.status}
                        </Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>Processed: <strong className="text-foreground">{step.processed}</strong></span>
                        <span>Failed: <strong className={step.failed ? "text-destructive" : "text-foreground"}>{step.failed}</strong></span>
                        {step.durationMs !== undefined && <span>{step.durationMs} ms</span>}
                      </div>
                      {step.error && <p className="mt-2 text-xs text-destructive break-words">{step.error}</p>}
                    </div>
                  ))}
                </div>

                <Separator />

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Total processed: <strong className="text-foreground">{totalProcessed}</strong></span>
                  <span>Total failed: <strong className={totalFailed ? "text-destructive" : "text-foreground"}>{totalFailed}</strong></span>
                </div>

                <Button
                  className="w-full mt-auto"
                  onClick={() => runGroup(group.key)}
                  disabled={!isConnected || running !== null}
                >
                  {isRunningHere ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                  Run {group.title} sync
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {!isConnected && (
        <Card className="border-destructive/40">
          <CardContent className="py-4 text-sm text-muted-foreground">
            QuickBooks is not connected. Open{" "}
            <Link to="/admin/integrations" className="text-primary underline">
              /admin/integrations
            </Link>{" "}
            and click <strong>Connect</strong> to complete the OAuth flow before running a sync.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

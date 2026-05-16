import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, FileText, Receipt, Wallet, ExternalLink, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface QboInvoice {
  id: string; qbo_id: string; qbo_doc_number: string | null;
  txn_date: string | null; due_date: string | null; currency: string | null;
  total_amt: string | number | null; balance: string | number | null; status: string | null;
}
interface QboEstimate {
  id: string; qbo_id: string; qbo_doc_number: string | null;
  txn_date: string | null; expiration_date: string | null; currency: string | null;
  total_amt: string | number | null; status: string | null; accepted_date: string | null;
}
interface QboPayment {
  id: string; qbo_id: string; txn_date: string | null; currency: string | null;
  total_amt: string | number | null; payment_method: string | null;
  payment_ref_num: string | null; linked_invoice_ids: string | null;
}
interface QboTotals {
  total_invoiced: string | number;
  total_paid: string | number;
  total_outstanding: string | number;
  invoice_count: string | number;
}
interface QboOverview {
  customer: { id: string; qbo_id: string | null; qbo_synced_at: string | null };
  invoices: QboInvoice[];
  estimates: QboEstimate[];
  payments: QboPayment[];
  totals: QboTotals;
}

const num = (v: unknown) => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
};
const money = (v: unknown, cur?: string | null) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: cur || "USD" }).format(num(v));
const fmtDate = (v: string | null) => (v ? new Date(v).toLocaleDateString() : "—");

function statusVariant(s: string | null): "default" | "secondary" | "destructive" | "outline" {
  if (!s) return "outline";
  if (/paid/i.test(s) && !/partial/i.test(s)) return "default";
  if (/overdue/i.test(s)) return "destructive";
  if (/partial/i.test(s)) return "secondary";
  return "outline";
}

export function CustomerQboPanel({ customerId }: { customerId: string }) {
  const [data, setData] = useState<QboOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api.request<QboOverview>("GET", `integrations/quickbooks/customer/${customerId}`)
      .then(r => { if (alive) { setData(r.data as QboOverview); setError(null); } })
      .catch(e => { if (alive) setError(e?.message || "Failed to load QuickBooks data"); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [customerId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (error) {
    return (
      <Card>
        <CardContent className="flex items-start gap-3 py-6">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium">QuickBooks data unavailable</p>
            <p className="text-xs text-muted-foreground mt-1">{error}</p>
            <p className="text-xs text-muted-foreground mt-2">
              Connect QuickBooks at <a href="/admin/integrations" className="text-foreground underline">/admin/integrations</a>{" "}
              and run a sync to populate data here.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }
  if (!data) return null;

  const cur =
    data.invoices[0]?.currency || data.estimates[0]?.currency || data.payments[0]?.currency || "USD";
  const notLinked = !data.customer.qbo_id;

  return (
    <div className="space-y-4">
      {notLinked && (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="flex items-start gap-3 py-4 text-sm">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              This customer is not linked to a QuickBooks customer yet (<code>qbo_id</code> is empty).
              Run <strong>Sync customers</strong> from <a className="underline" href="/admin/integrations">/admin/integrations</a>{" "}
              after connecting QuickBooks. Once matched, invoices/estimates/payments below will populate automatically.
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile label="Total invoiced" value={money(data.totals.total_invoiced, cur)} />
        <KpiTile label="Total paid"     value={money(data.totals.total_paid,     cur)} accent="success" />
        <KpiTile label="Outstanding"    value={money(data.totals.total_outstanding, cur)}
                 accent={num(data.totals.total_outstanding) > 0 ? "danger" : undefined} />
        <KpiTile label="Invoices"       value={String(num(data.totals.invoice_count))} />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Receipt className="h-4 w-4" /> Invoices</CardTitle>
          <CardDescription>Synced from QuickBooks · {data.invoices.length} record(s)</CardDescription>
        </CardHeader>
        <CardContent>
          {data.invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No invoices.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.invoices.map(inv => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono text-xs">{inv.qbo_doc_number ?? inv.qbo_id}</TableCell>
                    <TableCell>{fmtDate(inv.txn_date)}</TableCell>
                    <TableCell>{fmtDate(inv.due_date)}</TableCell>
                    <TableCell className="text-right font-medium">{money(inv.total_amt, inv.currency || cur)}</TableCell>
                    <TableCell className="text-right">{money(inv.balance, inv.currency || cur)}</TableCell>
                    <TableCell><Badge variant={statusVariant(inv.status)}>{inv.status ?? "—"}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><FileText className="h-4 w-4" /> Quotes / Estimates</CardTitle>
          <CardDescription>{data.estimates.length} record(s)</CardDescription>
        </CardHeader>
        <CardContent>
          {data.estimates.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No estimates.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.estimates.map(est => (
                  <TableRow key={est.id}>
                    <TableCell className="font-mono text-xs">{est.qbo_doc_number ?? est.qbo_id}</TableCell>
                    <TableCell>{fmtDate(est.txn_date)}</TableCell>
                    <TableCell>{fmtDate(est.expiration_date)}</TableCell>
                    <TableCell className="text-right font-medium">{money(est.total_amt, est.currency || cur)}</TableCell>
                    <TableCell><Badge variant={statusVariant(est.status)}>{est.status ?? "—"}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Wallet className="h-4 w-4" /> Payments</CardTitle>
          <CardDescription>{data.payments.length} record(s)</CardDescription>
        </CardHeader>
        <CardContent>
          {data.payments.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No payments.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Ref</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Applied to</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.payments.map(p => {
                  let linked: string[] = [];
                  try { linked = p.linked_invoice_ids ? JSON.parse(p.linked_invoice_ids) : []; } catch {}
                  return (
                    <TableRow key={p.id}>
                      <TableCell>{fmtDate(p.txn_date)}</TableCell>
                      <TableCell>{p.payment_method ?? "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{p.payment_ref_num ?? "—"}</TableCell>
                      <TableCell className="text-right font-medium">{money(p.total_amt, p.currency || cur)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {linked.length ? `${linked.length} invoice(s)` : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Last sync: {data.customer.qbo_synced_at ? new Date(data.customer.qbo_synced_at).toLocaleString() : "never"}</span>
        <Button variant="ghost" size="sm" asChild>
          <a href="/admin/integrations" className="inline-flex items-center gap-1">
            Manage QuickBooks <ExternalLink className="h-3 w-3" />
          </a>
        </Button>
      </div>
    </div>
  );
}

function KpiTile({ label, value, accent }: { label: string; value: string; accent?: "success" | "danger" }) {
  const color =
    accent === "success" ? "text-success" :
    accent === "danger"  ? "text-destructive" :
    "text-foreground";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-xl font-semibold mt-1 ${color}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

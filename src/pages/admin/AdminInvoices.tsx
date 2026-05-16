import React, { useState, useMemo, lazy, Suspense } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Search, Plus, FileText, Clock, X, Trash2, ArrowLeft, Loader2, Send,
  CheckCircle2, XCircle, DollarSign, Building2,
  Phone, MailIcon, StickyNote, CreditCard, Calendar,
  AlertTriangle, TrendingUp, Receipt, Banknote, Download, Mail, ExternalLink,
} from "lucide-react";
import {
  useInvoices, useInvoice, useCreateInvoice,
  useUpdateInvoiceStatus, useRecordInvoicePayment, useDeleteInvoice,
  useInvoiceStats, useCustomers, useSendInvoiceEmail,
} from "@/hooks/useApi";
import { unwrapApiList } from "@/lib/api";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminPageError, AdminPageLoading } from "@/components/admin/AdminPageState";
import { showSuccessToast, showErrorToast } from "@/lib/toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { useConfirm } from "@/components/ConfirmDialog";
import type { ReportModalSource } from "@/components/reports/ReportPreviewModal";

const ReportPreviewModal = lazy(() => import("@/components/reports/ReportPreviewModal"));

/* ── Status config (translation keys for labels) ── */
const STATUS_CONFIG: Record<string, { tKey: string; icon: React.ElementType; color: string; bg: string; border: string }> = {
  draft:          { tKey: "admin.invoices.draft",          icon: FileText,       color: "text-muted-foreground", bg: "bg-muted",            border: "border-border" },
  sent:           { tKey: "admin.invoices.sent",           icon: Send,           color: "text-blue-700",         bg: "bg-blue-50",          border: "border-blue-200" },
  paid:           { tKey: "admin.invoices.paid",           icon: CheckCircle2,   color: "text-emerald-700",      bg: "bg-emerald-50",       border: "border-emerald-200" },
  partially_paid: { tKey: "admin.invoices.partially_paid", icon: DollarSign,     color: "text-amber-700",        bg: "bg-amber-50",         border: "border-amber-200" },
  overdue:        { tKey: "admin.invoices.overdue",        icon: AlertTriangle,  color: "text-red-700",          bg: "bg-red-50",           border: "border-red-200" },
  cancelled:      { tKey: "admin.invoices.cancelled",      icon: XCircle,        color: "text-muted-foreground", bg: "bg-muted",            border: "border-border" },
  refunded:       { tKey: "admin.invoices.refunded",       icon: Banknote,       color: "text-purple-700",       bg: "bg-purple-50",        border: "border-purple-200" },
};

const PAYMENT_STATUS_CONFIG: Record<string, { tKey: string; color: string; bg: string }> = {
  unpaid:   { tKey: "admin.invoices.unpaid",   color: "text-red-700",     bg: "bg-red-50" },
  partial:  { tKey: "admin.invoices.partially_paid", color: "text-amber-700",   bg: "bg-amber-50" },
  paid:     { tKey: "admin.invoices.paid",     color: "text-emerald-700", bg: "bg-emerald-50" },
  refunded: { tKey: "admin.invoices.refunded", color: "text-purple-700",  bg: "bg-purple-50" },
};

function StatusBadge({ status }: { status: string }) {
  const { t } = useLanguage();
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${cfg.color} ${cfg.bg} ${cfg.border} border`}>
      <Icon className="w-3 h-3" />
      {t(cfg.tKey).toUpperCase()}
    </span>
  );
}

function PaymentBadge({ status }: { status: string }) {
  const { t } = useLanguage();
  const cfg = PAYMENT_STATUS_CONFIG[status] || PAYMENT_STATUS_CONFIG.unpaid;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${cfg.color} ${cfg.bg}`}>
      {t(cfg.tKey)}
    </span>
  );
}

function fmtCurrency(n: number | string | null | undefined): string {
  const v = Number(n ?? 0);
  return `C$${v.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
}

/* ───── Main Component ───── */
export default function AdminInvoices() {
  const { invoiceId } = useParams<{ invoiceId?: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const confirm = useConfirm();

  // List view state
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(new Set());

  // Debounce search
  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  // Payment modal
  const [payInvoiceId, setPayInvoiceId] = useState<string | null>(null);

  const filters = useMemo(() => ({
    status: statusFilter || undefined,
    payment_status: paymentFilter || undefined,
    search: debouncedSearch || undefined,
  }), [statusFilter, paymentFilter, debouncedSearch]);

  const { data: listData, isLoading: listLoading, error: listError } = useInvoices(page, 20, filters);
  const { data: statsData } = useInvoiceStats();

  const invoices = unwrapApiList<any>(listData, []);
  const pagination = (listData as any)?.pagination ?? (listData as any)?.data?.pagination;
  const stats = statsData?.data;

  // If invoiceId in URL, show detail
  if (invoiceId) {
    return <InvoiceDetail invoiceId={invoiceId} onBack={() => navigate("/admin/invoices")} />;
  }

  function toggleSelectInvoice(id: string) {
    setSelectedInvoiceIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleSelectAllInvoices() {
    setSelectedInvoiceIds(prev => prev.size === invoices.length ? new Set() : new Set(invoices.map((i: any) => i.id)));
  }
  function handleInvoiceExportCSV() {
    import("@/lib/admin-export").then(({ exportCSV: doExport }) => {
      const target = selectedInvoiceIds.size > 0 ? invoices.filter((i: any) => selectedInvoiceIds.has(i.id)) : invoices;
      doExport("invoices", ["Invoice #", "Customer", "Email", "Issue Date", "Due Date", "Total", "Balance", "Status", "Payment"],
        target.map((i: any) => [i.invoice_number || "", i.customer_name || "", i.customer_email || "", i.issue_date || "", i.due_date || "", String(Number(i.total ?? 0).toFixed(2)), String(Number(i.balance_due ?? 0).toFixed(2)), i.status || "", i.payment_status || ""]));
    });
  }
  function handleInvoiceExportPDF() {
    import("@/lib/admin-export").then(({ exportPDF: doExport }) => {
      const target = selectedInvoiceIds.size > 0 ? invoices.filter((i: any) => selectedInvoiceIds.has(i.id)) : invoices;
      doExport("invoices", "Invoices", ["Invoice #", "Customer", "Issue Date", "Due Date", "Total", "Balance", "Status"],
        target.map((i: any) => [i.invoice_number || "", i.customer_name || "", fmtDate(i.issue_date), fmtDate(i.due_date), fmtCurrency(i.total), fmtCurrency(i.balance_due), i.status || ""]),
        { subtitle: `${target.length} invoice(s) — Exported ${new Date().toLocaleDateString()}` });
    });
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={t("admin.invoices.title")}
        subtitle={t("admin.invoices.subtitle")}
        actions={
          <div className="flex gap-2">
            <button onClick={handleInvoiceExportCSV} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-sm font-medium hover:bg-secondary transition-colors">
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
            <button onClick={handleInvoiceExportPDF} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-sm font-medium hover:bg-secondary transition-colors">
              <FileText className="w-3.5 h-3.5" /> PDF
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              {t("admin.invoices.new")}
            </button>
          </div>
        }
      />

      {/* Bulk actions bar */}
      {selectedInvoiceIds.size > 0 && (
        <div className="dashboard-card flex flex-wrap items-center gap-3 bg-accent/5 border-accent/30 animate-in slide-in-from-top-2 duration-200">
          <span className="text-sm font-semibold tabular-nums">{selectedInvoiceIds.size} selected</span>
          <div className="h-4 w-px bg-border" />
          <button onClick={handleInvoiceExportCSV} className="px-3 py-1.5 border border-border rounded-lg text-xs font-medium hover:bg-secondary flex items-center gap-1">
            <Download className="h-3 w-3" /> Export CSV
          </button>
          <button onClick={handleInvoiceExportPDF} className="px-3 py-1.5 border border-border rounded-lg text-xs font-medium hover:bg-secondary flex items-center gap-1">
            <FileText className="h-3 w-3" /> Export PDF
          </button>
          <button onClick={() => setSelectedInvoiceIds(new Set())} className="ml-auto text-xs text-muted-foreground hover:text-foreground">Clear</button>
        </div>
      )}

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={Receipt} label={t("admin.invoices.stats.total_invoiced")} value={fmtCurrency(stats.total_invoiced)} color="text-primary" />
          <StatCard icon={CheckCircle2} label={t("admin.invoices.stats.collected")} value={fmtCurrency(stats.total_collected)} color="text-emerald-600" />
          <StatCard icon={TrendingUp} label={t("admin.invoices.stats.outstanding")} value={fmtCurrency(stats.total_outstanding)} color="text-amber-600" />
          <StatCard icon={AlertTriangle} label={t("admin.invoices.stats.overdue")} value={String(stats.overdue_count ?? 0)} color="text-red-600" />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder={t("admin.invoices.search_placeholder")}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="px-3 py-2.5 rounded-xl border border-border bg-card text-sm focus:outline-none">
          <option value="">{t("admin.invoices.all")} — {t("admin.invoices.status")}</option>
          {["draft", "sent", "paid", "partially_paid", "overdue", "cancelled", "refunded"].map((s) => (
            <option key={s} value={s}>{t(STATUS_CONFIG[s]?.tKey || s)}</option>
          ))}
        </select>
        <select value={paymentFilter} onChange={(e) => { setPaymentFilter(e.target.value); setPage(1); }} className="px-3 py-2.5 rounded-xl border border-border bg-card text-sm focus:outline-none">
          <option value="">{t("admin.invoices.all")} — {t("admin.invoices.payment_status")}</option>
          {["unpaid", "partial", "paid", "refunded"].map((s) => (
            <option key={s} value={s}>{t(PAYMENT_STATUS_CONFIG[s]?.tKey || s)}</option>
          ))}
        </select>
      </div>

      {/* List */}
      {listLoading ? (
        <AdminPageLoading message="Loading invoices" />
      ) : listError ? (
        <AdminPageError message="Failed to load invoices" />
      ) : invoices.length === 0 ? (
        <div className="text-center py-20">
          <Receipt className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-bold text-foreground mb-1">{t("admin.invoices.no_invoices")}</h3>
          <p className="text-sm text-muted-foreground">{t("admin.invoices.no_invoices_desc")}</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 w-8">
                    <input type="checkbox" checked={selectedInvoiceIds.size === invoices.length && invoices.length > 0} onChange={toggleSelectAllInvoices} className="rounded-sm border-border accent-accent" />
                  </th>
                  <th className="text-left px-4 py-3 font-bold text-muted-foreground text-xs uppercase">{t("admin.invoices.number")}</th>
                  <th className="text-left px-4 py-3 font-bold text-muted-foreground text-xs uppercase">{t("admin.invoices.customer")}</th>
                  <th className="text-left px-4 py-3 font-bold text-muted-foreground text-xs uppercase">{t("admin.invoices.issue_date")}</th>
                  <th className="text-left px-4 py-3 font-bold text-muted-foreground text-xs uppercase">{t("admin.invoices.due_date")}</th>
                  <th className="text-right px-4 py-3 font-bold text-muted-foreground text-xs uppercase">{t("admin.invoices.total")}</th>
                  <th className="text-right px-4 py-3 font-bold text-muted-foreground text-xs uppercase">{t("admin.invoices.balance")}</th>
                  <th className="text-center px-4 py-3 font-bold text-muted-foreground text-xs uppercase">{t("admin.invoices.status")}</th>
                  <th className="text-center px-4 py-3 font-bold text-muted-foreground text-xs uppercase">{t("admin.invoices.payment_status")}</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv: any) => {
                  const isSelected = selectedInvoiceIds.has(inv.id);
                  return (
                    <tr key={inv.id} className={`border-b border-border/50 hover:bg-muted/20 transition-colors cursor-pointer ${isSelected ? "bg-accent/5" : ""}`} onClick={() => navigate(`/admin/invoices/${inv.id}`)}>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={isSelected} onChange={() => toggleSelectInvoice(inv.id)} className="rounded-sm border-border accent-accent" />
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-primary text-xs">{inv.invoice_number}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{inv.customer_name || "—"}</div>
                        <div className="text-xs text-muted-foreground">{inv.customer_email}</div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{fmtDate(inv.issue_date)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{fmtDate(inv.due_date)}</td>
                      <td className="px-4 py-3 text-right font-bold">{fmtCurrency(inv.total)}</td>
                      <td className="px-4 py-3 text-right font-bold">{fmtCurrency(inv.balance_due)}</td>
                      <td className="px-4 py-3 text-center"><StatusBadge status={inv.status} /></td>
                      <td className="px-4 py-3 text-center"><PaymentBadge status={inv.payment_status} /></td>
                      <td className="px-4 py-3">
                        <button
                          onClick={(e) => { e.stopPropagation(); setPayInvoiceId(inv.id); }}
                          className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
                          title={t("admin.invoices.record_payment")}
                        >
                          <CreditCard className="w-4 h-4 text-muted-foreground" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          {pagination && pagination.pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <span className="text-xs text-muted-foreground">
                {pagination.total} invoice{pagination.total !== 1 ? "s" : ""}
              </span>
              <div className="flex gap-1">
                {Array.from({ length: Math.min(pagination.pages, 10) }, (_, i) => (
                  <button
                    key={i + 1}
                    onClick={() => setPage(i + 1)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${page === i + 1 ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create modal */}
      {showCreate && <CreateInvoiceModal onClose={() => setShowCreate(false)} />}

      {/* Payment modal */}
      {payInvoiceId && <RecordPaymentModal invoiceId={payInvoiceId} onClose={() => setPayInvoiceId(null)} />}
    </div>
  );
}

/* ── Stat Card ── */
function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string; color: string }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-xl bg-muted ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground font-medium">{label}</p>
          <p className="text-lg font-black text-foreground">{value}</p>
        </div>
      </div>
    </div>
  );
}

/* ── Invoice Detail ── */
function InvoiceDetail({ invoiceId, onBack }: { invoiceId: string; onBack: () => void }) {
  const { t } = useLanguage();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useInvoice(invoiceId);
  const statusMutation = useUpdateInvoiceStatus(invoiceId);
  const deleteMutation = useDeleteInvoice(invoiceId);
  const sendEmailMutation = useSendInvoiceEmail();
  const [showPayment, setShowPayment] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const invoice = data?.data;

  if (isLoading) return <AdminPageLoading message="Loading invoice" />;
  if (error || !invoice) return <AdminPageError message="Invoice not found" />;

  const handleStatus = async (status: string) => {
    try {
      await statusMutation.mutateAsync(status);
      showSuccessToast("Status updated");
    } catch { showErrorToast("Failed to update status"); }
  };

  const handleDelete = async () => {
    const ok = await confirm({ message: "This invoice will be permanently deleted. Continue?", variant: "danger", confirmLabel: "Delete" });
    if (!ok) return;
    try {
      await deleteMutation.mutateAsync(undefined as any);
      showSuccessToast("Invoice deleted");
      onBack();
    } catch { showErrorToast("Failed to delete"); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-secondary transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-black text-foreground">{invoice.invoice_number}</h2>
          <p className="text-sm text-muted-foreground">{invoice.company_name || invoice.customer_email}</p>
        </div>
        <StatusBadge status={invoice.status} />
        <PaymentBadge status={invoice.payment_status} />
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {invoice.status === "draft" && (
          <button onClick={() => handleStatus("sent")} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-50 text-blue-700 text-xs font-bold hover:bg-blue-100 transition-colors border border-blue-200">
            <Send className="w-3.5 h-3.5" /> {t("admin.invoices.mark_sent")}
          </button>
        )}
        {invoice.payment_status !== "paid" && (
          <>
            <button onClick={() => handleStatus("paid")} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold hover:bg-emerald-100 transition-colors border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5" /> {t("admin.invoices.mark_paid")}
            </button>
            <button onClick={() => setShowPayment(true)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 transition-colors border border-primary/20">
              <CreditCard className="w-3.5 h-3.5" /> {t("admin.invoices.record_payment")}
            </button>
          </>
        )}
        {invoice.status !== "cancelled" && (
          <button onClick={() => handleStatus("cancelled")} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-muted text-muted-foreground text-xs font-bold hover:bg-muted/80 transition-colors border border-border">
            <XCircle className="w-3.5 h-3.5" /> {t("admin.invoices.cancelled")}
          </button>
        )}
        <button onClick={() => setShowReport(true)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 transition-colors border border-primary/20">
          <Download className="w-3.5 h-3.5" /> PDF
        </button>
        <button onClick={() => setShowEmailModal(true)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-50 text-blue-700 text-xs font-bold hover:bg-blue-100 transition-colors border border-blue-200">
          <Mail className="w-3.5 h-3.5" /> {t("admin.invoices.send_email")}
        </button>
        <button onClick={handleDelete} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-destructive/10 text-destructive text-xs font-bold hover:bg-destructive/20 transition-colors border border-destructive/20 ml-auto">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Offer back-reference */}
      {invoice.offer_id && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 flex items-center gap-3">
          <FileText className="w-4 h-4 text-primary shrink-0" />
          <span className="text-sm text-foreground">
            {t("admin.invoices.created_from_offer")}
          </span>
          <button
            onClick={() => navigate(`/admin/offers/${invoice.offer_id}`)}
            className="inline-flex items-center gap-1 text-sm font-bold text-primary hover:underline"
          >
            {t("admin.invoices.view_offer")} <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Summary grid */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
          <h3 className="font-bold text-sm text-foreground">{t("admin.invoices.customer")}</h3>
          <div className="space-y-1.5 text-sm">
            <div className="flex items-center gap-2"><Building2 className="w-4 h-4 text-muted-foreground" />{invoice.company_name || "—"}</div>
            <div className="flex items-center gap-2"><MailIcon className="w-4 h-4 text-muted-foreground" />{invoice.customer_email || "—"}</div>
            <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-muted-foreground" />{invoice.customer_phone || "—"}</div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
          <h3 className="font-bold text-sm text-foreground">{t("admin.invoices.total")}</h3>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{fmtCurrency(invoice.subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span>{fmtCurrency(invoice.tax)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Shipping</span><span>{fmtCurrency(invoice.shipping)}</span></div>
            {Number(invoice.discount) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span className="text-destructive">-{fmtCurrency(invoice.discount)}</span></div>}
            <div className="border-t border-border pt-2 flex justify-between font-black text-lg"><span>{t("admin.invoices.total")}</span><span>{fmtCurrency(invoice.total)}</span></div>
            <div className="flex justify-between text-emerald-600"><span>{t("admin.invoices.paid")}</span><span>{fmtCurrency(invoice.amount_paid)}</span></div>
            <div className="flex justify-between text-amber-600 font-bold"><span>{t("admin.invoices.balance")}</span><span>{fmtCurrency(invoice.balance_due)}</span></div>
          </div>
        </div>
      </div>

      {/* Dates & metadata */}
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
          <Calendar className="w-5 h-5 text-muted-foreground" />
          <div>
            <p className="text-[10px] text-muted-foreground font-bold uppercase">{t("admin.invoices.issue_date")}</p>
            <p className="text-sm font-medium">{fmtDate(invoice.issue_date)}</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
          <Clock className="w-5 h-5 text-muted-foreground" />
          <div>
            <p className="text-[10px] text-muted-foreground font-bold uppercase">{t("admin.invoices.due_date")}</p>
            <p className="text-sm font-medium">{fmtDate(invoice.due_date)}</p>
          </div>
        </div>
        {invoice.payment_method && (
          <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <CreditCard className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="text-[10px] text-muted-foreground font-bold uppercase">{t("admin.invoices.payment_method")}</p>
              <p className="text-sm font-medium capitalize">{invoice.payment_method}</p>
            </div>
          </div>
        )}
      </div>

      {/* Items */}
      {invoice.items?.length > 0 && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border">
            <h3 className="font-bold text-sm">{t("admin.invoices.items")} ({invoice.items.length})</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/30 border-b border-border">
                <th className="text-left px-5 py-2 text-xs font-bold text-muted-foreground">Product</th>
                <th className="text-left px-3 py-2 text-xs font-bold text-muted-foreground">SKU</th>
                <th className="text-right px-3 py-2 text-xs font-bold text-muted-foreground">Qty</th>
                <th className="text-right px-3 py-2 text-xs font-bold text-muted-foreground">Unit Price</th>
                <th className="text-right px-5 py-2 text-xs font-bold text-muted-foreground">Total</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item: any) => (
                <tr key={item.id} className="border-b border-border/50">
                  <td className="px-5 py-2.5 font-medium">{item.product_name_live || item.product_name}</td>
                  <td className="px-3 py-2.5 text-muted-foreground font-mono text-xs">{item.product_sku_live || item.sku}</td>
                  <td className="px-3 py-2.5 text-right">{item.quantity}</td>
                  <td className="px-3 py-2.5 text-right">{fmtCurrency(item.unit_price)}</td>
                  <td className="px-5 py-2.5 text-right font-bold">{fmtCurrency(item.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Payments history */}
      {invoice.payments?.length > 0 && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border">
            <h3 className="font-bold text-sm">{t("admin.invoices.payment_history")} ({invoice.payments.length})</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/30 border-b border-border">
                <th className="text-left px-5 py-2 text-xs font-bold text-muted-foreground">Date</th>
                <th className="text-right px-3 py-2 text-xs font-bold text-muted-foreground">{t("admin.invoices.amount")}</th>
                <th className="text-left px-3 py-2 text-xs font-bold text-muted-foreground">{t("admin.invoices.payment_method")}</th>
                <th className="text-left px-5 py-2 text-xs font-bold text-muted-foreground">{t("admin.invoices.reference")}</th>
              </tr>
            </thead>
            <tbody>
              {invoice.payments.map((p: any) => (
                <tr key={p.id} className="border-b border-border/50">
                  <td className="px-5 py-2.5">{fmtDate(p.paid_at)}</td>
                  <td className="px-3 py-2.5 text-right font-bold text-emerald-600">{fmtCurrency(p.amount)}</td>
                  <td className="px-3 py-2.5 capitalize">{p.payment_method || "—"}</td>
                  <td className="px-5 py-2.5 text-muted-foreground">{p.reference || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Notes */}
      {(invoice.notes || invoice.internal_notes) && (
        <div className="grid md:grid-cols-2 gap-4">
          {invoice.notes && (
            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="font-bold text-sm mb-2 flex items-center gap-2"><StickyNote className="w-4 h-4" /> {t("admin.invoices.notes")}</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{invoice.notes}</p>
            </div>
          )}
          {invoice.internal_notes && (
            <div className="bg-card border border-amber-200 rounded-2xl p-5">
              <h3 className="font-bold text-sm mb-2 flex items-center gap-2"><StickyNote className="w-4 h-4 text-amber-600" /> {t("admin.invoices.internal_notes")}</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{invoice.internal_notes}</p>
            </div>
          )}
        </div>
      )}

      {showPayment && <RecordPaymentModal invoiceId={invoiceId} onClose={() => setShowPayment(false)} />}

      {showReport && (
        <Suspense fallback={null}>
          <ReportPreviewModal
            onClose={() => setShowReport(false)}
            defaultType="invoice"
            source={{
              documentNumber: invoice.invoice_number,
              issueDate: invoice.issue_date || invoice.created_at,
              dueDate: invoice.due_date || undefined,
              customer: {
                name: invoice.contact_person || invoice.company_name || "",
                company: invoice.company_name || undefined,
                email: invoice.customer_email || "",
                phone: invoice.customer_phone || undefined,
              },
              items: (invoice.items || []).map((it: any) => ({
                description: it.product_name_live || it.product_name || "",
                sku: it.product_sku_live || it.sku || "",
                qty: Number(it.quantity) || 1,
                unitPrice: Number(it.unit_price) || 0,
                lineTotal: Number(it.line_total) || 0,
                notes: it.notes || undefined,
              })),
              subtotal: Number(invoice.subtotal) || 0,
              discount: Number(invoice.discount) || 0,
              shipping: Number(invoice.shipping) || 0,
              total: Number(invoice.total) || 0,
              notes: invoice.notes || undefined,
              paymentTerms: invoice.payment_method
                ? `${t("admin.invoices.payment_method")}: ${invoice.payment_method}`
                : undefined,
            }}
          />
        </Suspense>
      )}

      {showEmailModal && (
        <InvoiceEmailModal
          invoice={invoice}
          isPending={sendEmailMutation.isPending}
          onClose={() => setShowEmailModal(false)}
          onSend={async ({ subject, message }) => {
            try {
              await sendEmailMutation.mutateAsync({ invoiceId, subject, message });
              showSuccessToast(t("admin.invoices.email_sent"), `${invoice.invoice_number} → ${invoice.customer_email}`);
              setShowEmailModal(false);
              refetch();
            } catch { showErrorToast(t("admin.invoices.email_error")); }
          }}
        />
      )}
    </div>
  );
}

/* ── Record Payment Modal ── */
function RecordPaymentModal({ invoiceId, onClose }: { invoiceId: string; onClose: () => void }) {
  const { t } = useLanguage();
  const mutation = useRecordInvoicePayment(invoiceId);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { showErrorToast("Enter a valid amount"); return; }
    try {
      await mutation.mutateAsync({ amount: amt, payment_method: method || undefined, reference: reference || undefined, notes: notes || undefined });
      showSuccessToast("Payment recorded");
      onClose();
    } catch { showErrorToast("Failed to record payment"); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black">{t("admin.invoices.record_payment")}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase mb-1 block">{t("admin.invoices.amount")} *</label>
            <input type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required className="w-full px-3 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase mb-1 block">{t("admin.invoices.payment_method")}</label>
            <select value={method} onChange={(e) => setMethod(e.target.value)} className="w-full px-3 py-2.5 border border-border rounded-xl text-sm focus:outline-none">
              <option value="">—</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="credit_card">Credit Card</option>
              <option value="cheque">Cheque</option>
              <option value="cash">Cash</option>
              <option value="stripe">Stripe</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase mb-1 block">{t("admin.invoices.reference")}</label>
            <input type="text" value={reference} onChange={(e) => setReference(e.target.value)} className="w-full px-3 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase mb-1 block">{t("admin.invoices.notes")}</label>
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full px-3 py-2.5 border border-border rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
          <button type="submit" disabled={mutation.isPending} className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50">
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : t("admin.invoices.record_payment")}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ── Invoice Email Modal ── */
function InvoiceEmailModal({
  invoice, isPending, onClose, onSend,
}: {
  invoice: any; isPending: boolean; onClose: () => void;
  onSend: (data: { subject: string; message: string }) => void;
}) {
  const { t } = useLanguage();
  const [subject, setSubject] = useState(`REMQUIP: ${t("admin.invoices.invoice")} ${invoice.invoice_number}`);
  const [message, setMessage] = useState("");
  const customerLabel = [(invoice as any).contact_person, (invoice as any).company_name].filter(Boolean).join(" — ") || invoice.customer_email;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg border border-border overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-100"><Send className="w-4 h-4 text-blue-600" /></div>
            <h2 className="text-sm font-bold text-foreground">{t("admin.invoices.send_invoice_to_customer")}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="p-3 bg-muted rounded-xl text-xs text-muted-foreground flex items-start gap-2.5">
            <Mail className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <span className="font-bold text-foreground">To:</span> {invoice.customer_email}
              {customerLabel !== invoice.customer_email && <span className="ml-1 opacity-60">({customerLabel})</span>}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">{t("admin.invoices.email_subject")}</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
              {t("admin.invoices.email_message")} <span className="font-normal normal-case">({t("admin.invoices.optional")})</span>
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              placeholder={`Dear ${(invoice as any).contact_person || "Customer"},\n\nPlease find enclosed your invoice…`}
              className="w-full px-3.5 py-2.5 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors resize-none"
            />
          </div>

          <div className="p-3 bg-primary/5 rounded-xl text-xs text-primary border border-primary/10">
            {t("admin.invoices.email_includes_details")}
            {invoice.status === "draft" && ` ${t("admin.invoices.status_advance_sent")}`}
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-border bg-muted/20">
          <button onClick={onClose} disabled={isPending} className="px-4 py-2.5 text-xs font-bold text-muted-foreground hover:bg-muted rounded-lg transition-colors">
            {t("admin.invoices.cancel")}
          </button>
          <button
            onClick={() => onSend({ subject, message })}
            disabled={isPending || !subject.trim()}
            className="btn-accent flex items-center gap-2 px-5 py-2.5 text-xs font-bold disabled:opacity-50"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {isPending ? t("admin.invoices.sending") : t("admin.invoices.send_invoice")}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Create Invoice Modal ── */
function CreateInvoiceModal({ onClose }: { onClose: () => void }) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const createMutation = useCreateInvoice();
  const { data: custData } = useCustomers(1, 200);
  const customers = unwrapApiList<any>(custData, []);

  const [customerId, setCustomerId] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualEmail, setManualEmail] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [payMethod, setPayMethod] = useState("");

  // Simple items
  const [items, setItems] = useState([{ product_name: "", sku: "", quantity: 1, unit_price: 0 }]);

  const addItem = () => setItems([...items, { product_name: "", sku: "", quantity: 1, unit_price: 0 }]);
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: string, value: any) => {
    const copy = [...items];
    (copy[i] as any)[field] = value;
    setItems(copy);
  };

  const subtotal = items.reduce((s, it) => s + it.quantity * it.unit_price, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId && !manualName.trim() && !manualEmail.trim()) { showErrorToast("Select a customer or enter manual details"); return; }
    if (items.every((it) => !it.product_name.trim())) { showErrorToast("Add at least one item"); return; }
    if (items.every((it) => !it.product_name.trim())) { showErrorToast("Add at least one item"); return; }
    try {
      const payload: Record<string, unknown> = {
        customer_id: customerId || undefined,
        customer_name: !customerId ? manualName.trim() || undefined : undefined,
        customer_email: !customerId ? manualEmail.trim() || undefined : undefined,
        customer_phone: !customerId ? manualPhone.trim() || undefined : undefined,
        issue_date: issueDate,
        due_date: dueDate || undefined,
        notes: notes || undefined,
        payment_method: payMethod || undefined,
        items: items.filter((it) => it.product_name.trim()).map((it) => ({
          product_name: it.product_name,
          sku: it.sku,
          quantity: it.quantity,
          unit_price: it.unit_price,
        })),
      };
      const res = await createMutation.mutateAsync(payload);
      showSuccessToast(`Invoice ${res.data?.invoice_number} created`);
      onClose();
      if (res.data?.id) navigate(`/admin/invoices/${res.data.id}`);
    } catch { showErrorToast("Failed to create invoice"); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 bg-foreground/50 backdrop-blur-sm overflow-y-auto" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl p-6 space-y-5 mb-12" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black">{t("admin.invoices.new")}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Customer */}
           <div>
            <label className="text-xs font-bold text-muted-foreground uppercase mb-1 block">{t("admin.invoices.customer")}</label>
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="w-full px-3 py-2.5 border border-border rounded-xl text-sm focus:outline-none">
              <option value="">— No customer (manual entry) —</option>
              {customers.map((c: any) => (
                <option key={c.id} value={c.id}>{c.company_name || c.full_name} ({c.email})</option>
              ))}
            </select>
          </div>

          {/* Manual customer fields when no customer selected */}
          {!customerId && (
            <div className="grid sm:grid-cols-3 gap-4 p-3 border border-dashed border-border rounded-xl bg-secondary/30">
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase mb-1 block">Name</label>
                <input type="text" value={manualName} onChange={(e) => setManualName(e.target.value)} placeholder="Company or person" className="w-full px-3 py-2.5 border border-border rounded-xl text-sm focus:outline-none" />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase mb-1 block">Email</label>
                <input type="email" value={manualEmail} onChange={(e) => setManualEmail(e.target.value)} placeholder="email@example.com" className="w-full px-3 py-2.5 border border-border rounded-xl text-sm focus:outline-none" />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase mb-1 block">Phone</label>
                <input type="tel" value={manualPhone} onChange={(e) => setManualPhone(e.target.value)} placeholder="+1-555-0100" className="w-full px-3 py-2.5 border border-border rounded-xl text-sm focus:outline-none" />
              </div>
            </div>
          )}

          {/* Dates */}
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase mb-1 block">{t("admin.invoices.issue_date")}</label>
              <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className="w-full px-3 py-2.5 border border-border rounded-xl text-sm focus:outline-none" />
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase mb-1 block">{t("admin.invoices.due_date")}</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full px-3 py-2.5 border border-border rounded-xl text-sm focus:outline-none" />
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase mb-1 block">{t("admin.invoices.payment_method")}</label>
              <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className="w-full px-3 py-2.5 border border-border rounded-xl text-sm focus:outline-none">
                <option value="">—</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="credit_card">Credit Card</option>
                <option value="cheque">Cheque</option>
                <option value="cash">Cash</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-muted-foreground uppercase">{t("admin.invoices.items")}</label>
              <button type="button" onClick={addItem} className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
                <Plus className="w-3 h-3" /> Add Item
              </button>
            </div>
            <div className="space-y-2">
              {items.map((item, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <input type="text" placeholder="Product name" value={item.product_name} onChange={(e) => updateItem(i, "product_name", e.target.value)} className="flex-1 px-3 py-2 border border-border rounded-xl text-sm" />
                  <input type="text" placeholder="SKU" value={item.sku} onChange={(e) => updateItem(i, "sku", e.target.value)} className="w-24 px-3 py-2 border border-border rounded-xl text-sm" />
                  <input type="number" min={1} value={item.quantity} onChange={(e) => updateItem(i, "quantity", parseInt(e.target.value) || 1)} className="w-16 px-2 py-2 border border-border rounded-xl text-sm text-center" />
                  <input type="number" step="0.01" min={0} value={item.unit_price} onChange={(e) => updateItem(i, "unit_price", parseFloat(e.target.value) || 0)} className="w-24 px-2 py-2 border border-border rounded-xl text-sm text-right" />
                  <span className="w-20 py-2 text-right text-sm font-bold">{fmtCurrency(item.quantity * item.unit_price)}</span>
                  {items.length > 1 && (
                    <button type="button" onClick={() => removeItem(i)} className="p-2 rounded-lg hover:bg-destructive/10 text-destructive"><X className="w-3.5 h-3.5" /></button>
                  )}
                </div>
              ))}
            </div>
            <div className="text-right mt-2 text-sm font-bold">Subtotal: {fmtCurrency(subtotal)}</div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase mb-1 block">{t("admin.invoices.notes")}</label>
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full px-3 py-2.5 border border-border rounded-xl text-sm resize-none focus:outline-none" />
          </div>

          <button type="submit" disabled={createMutation.isPending} className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50">
            {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : t("admin.invoices.new")}
          </button>
        </form>
      </div>
    </div>
  );
}

import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Search, Plus, FileText, Clock, Upload, X, Download, AlertCircle,
  Trash2, ArrowRight, ArrowLeft, Printer, Mail, Loader2, Send, CheckCircle2,
  XCircle, Package, User, Calendar, DollarSign, Hash, ChevronRight,
  Building2, Phone, MailIcon, StickyNote, Truck, Tag,
  MoreHorizontal, Eye,
} from "lucide-react";
import {
  useOffers, useOffer, useCreateOffer, useUpdateOffer, useUpdateOfferStatus,
  useConvertOfferToOrder, useConvertOfferToInvoice, useDeleteOffer, useOfferDocuments, useUploadOfferDocument,
  useDeleteOfferDocument, useSearchProducts, useCustomers, useSearchCustomers, useSendOfferEmail,
  useAdminCategoriesList, useApiQuery,
} from "@/hooks/useApi";
import { api, Product, resolveUploadImageUrl } from "@/lib/api";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminPageError, AdminPageLoading } from "@/components/admin/AdminPageState";
import { showSuccessToast, showErrorToast } from "@/lib/toast";
import ReportPreviewModal from "@/components/reports/ReportPreviewModal";
import { useLanguage } from "@/contexts/LanguageContext";
import { useConfirm } from "@/components/ConfirmDialog";

/* ── Status config ── */
const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bg: string; border: string }> = {
  draft:     { label: "Draft",     icon: FileText,     color: "text-muted-foreground", bg: "bg-muted",            border: "border-border" },
  sent:      { label: "Sent",      icon: Send,         color: "text-blue-700",         bg: "bg-blue-50",          border: "border-blue-200" },
  accepted:  { label: "Accepted",  icon: CheckCircle2, color: "text-emerald-700",      bg: "bg-emerald-50",       border: "border-emerald-200" },
  rejected:  { label: "Rejected",  icon: XCircle,      color: "text-destructive",      bg: "bg-destructive/10",   border: "border-destructive/20" },
  expired:   { label: "Expired",   icon: Clock,        color: "text-amber-700",        bg: "bg-amber-50",         border: "border-amber-200" },
  converted: { label: "Converted", icon: ArrowRight,   color: "text-primary",          bg: "bg-primary/10",       border: "border-primary/20" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${cfg.color} ${cfg.bg} ${cfg.border} border`}>
      <Icon className="w-3 h-3" />
      {cfg.label.toUpperCase()}
    </span>
  );
}

/* ── Status Timeline ── */
const TIMELINE_STEPS = ["draft", "sent", "accepted", "converted"];
function StatusTimeline({ current }: { current: string }) {
  const currentIdx = TIMELINE_STEPS.indexOf(current);
  const isTerminal = current === "rejected" || current === "expired";

  return (
    <div className="flex items-center gap-1">
      {TIMELINE_STEPS.map((step, i) => {
        const cfg = STATUS_CONFIG[step];
        const done = !isTerminal && i <= currentIdx;
        const isCurrent = step === current;
        return (
          <React.Fragment key={step}>
            <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all ${
              isCurrent ? `${cfg.bg} ${cfg.color} ${cfg.border} border shadow-sm` :
              done ? "text-emerald-600 bg-emerald-50/50" : "text-muted-foreground/50 bg-muted/30"
            }`}>
              {done && !isCurrent && <CheckCircle2 className="w-3 h-3" />}
              <span className="hidden sm:inline">{cfg.label}</span>
            </div>
            {i < TIMELINE_STEPS.length - 1 && (
              <ChevronRight className={`w-3.5 h-3.5 shrink-0 ${done && i < currentIdx ? "text-emerald-400" : "text-muted-foreground/20"}`} />
            )}
          </React.Fragment>
        );
      })}
      {isTerminal && (
        <>
          <ChevronRight className="w-3.5 h-3.5 shrink-0 text-muted-foreground/20" />
          <StatusBadge status={current} />
        </>
      )}
    </div>
  );
}

/* ── Stat Card ── */
function StatCard({ icon: Icon, label, value, sub, accent }: { icon: React.ElementType; label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${accent ? "bg-primary/5 border-primary/20" : "bg-card border-border"}`}>
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg ${accent ? "bg-primary/10" : "bg-muted"}`}>
          <Icon className={`w-4 h-4 ${accent ? "text-primary" : "text-muted-foreground"}`} />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">{label}</p>
          <p className={`text-sm font-bold truncate ${accent ? "text-primary" : "text-foreground"}`}>{value}</p>
          {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   OFFERS LIST PAGE
   ============================================================ */

export default function AdminOffers() {
  const { offerId } = useParams();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const confirmAction = useConfirm();
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 20;
  const convertMutation = useConvertOfferToOrder();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: offersData, isLoading, isError, refetch } = useOffers(
    page, limit,
    activeTab !== "all" ? activeTab : undefined,
    searchQuery,
  );

  const offers = Array.isArray(offersData?.data) ? offersData.data : (offersData?.data as any)?.items || [];
  const totalItems = (offersData?.data as any)?.total || 0;
  const totalPages = Math.ceil(totalItems / limit);

  useEffect(() => { setPage(1); }, [activeTab, searchQuery]);

  if (offerId) {
    return <AdminOfferDetail offerId={offerId} onBack={() => navigate("/admin/offers")} />;
  }

  const tabs = ["all", "draft", "sent", "accepted", "rejected", "expired", "converted"];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={t("admin.nav.offers")}
        subtitle={t("admin.offers.subtitle") !== "admin.offers.subtitle" ? t("admin.offers.subtitle") : "Create and manage quotes, proposals, and convert them to orders."}
        icon={FileText}
        actions={
          <button onClick={() => setIsCreateModalOpen(true)} className="btn-accent flex items-center justify-center gap-2">
            <Plus className="w-4 h-4" />
            <span>New Offer</span>
          </button>
        }
      />

      {/* Filters row */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="flex gap-1 bg-muted p-1 rounded-xl w-full sm:w-auto overflow-x-auto scrollbar-none">
          {tabs.map((tab) => {
            const cfg = STATUS_CONFIG[tab];
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3.5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all ${
                  activeTab === tab
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab === "all" ? "All" : cfg?.label || tab}
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-64">
          <input
            type="text"
            placeholder="Search offers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
          />
          <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-3" />
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <AdminPageLoading message="Loading offers..." />
      ) : isError ? (
        <AdminPageError message="Failed to load offers" onRetry={() => refetch()} />
      ) : offers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card py-16 text-center">
          <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-foreground">No offers found</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
            {searchQuery ? "We couldn't find any offers matching your search." : "Create your first sales offer to get started."}
          </p>
          {!searchQuery && (
            <button onClick={() => setIsCreateModalOpen(true)} className="mt-6 btn-accent inline-flex items-center gap-2">
              <Plus className="w-4 h-4" /> Create First Offer
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="p-4 font-bold text-[11px] uppercase tracking-wider text-muted-foreground">Offer #</th>
                  <th className="p-4 font-bold text-[11px] uppercase tracking-wider text-muted-foreground">Customer</th>
                  <th className="p-4 font-bold text-[11px] uppercase tracking-wider text-muted-foreground">Date</th>
                  <th className="p-4 font-bold text-[11px] uppercase tracking-wider text-muted-foreground text-right">Total</th>
                  <th className="p-4 font-bold text-[11px] uppercase tracking-wider text-muted-foreground">Status</th>
                  <th className="p-4 font-bold text-[11px] uppercase tracking-wider text-muted-foreground text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {offers.map((offer: any) => (
                  <tr
                    key={offer.id}
                    onClick={() => navigate(`/admin/offers/${offer.id}`)}
                    className="hover:bg-muted/30 transition-colors cursor-pointer group"
                  >
                    <td className="p-4">
                      <div className="font-bold text-sm text-foreground">{offer.offer_number}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">{offer.item_count || 0} items</div>
                    </td>
                    <td className="p-4">
                      <div className="font-medium text-sm text-foreground">{offer.customer_name || "Unknown"}</div>
                      <div className="text-xs text-muted-foreground">{offer.customer_email}</div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm text-foreground">{new Date(offer.created_at).toLocaleDateString()}</div>
                      {offer.valid_until && (
                        <div className="text-[11px] text-amber-600 mt-0.5 whitespace-nowrap flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Valid til {new Date(offer.valid_until).toLocaleDateString()}
                        </div>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <span className="font-bold text-sm text-foreground">${Number(offer.total || 0).toFixed(2)}</span>
                    </td>
                    <td className="p-4">
                      <StatusBadge status={offer.status || "draft"} />
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => navigate(`/admin/offers/${offer.id}`)}
                          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          title="View details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {(offer.status === "draft" || offer.status === "accepted" || offer.status === "sent") && (
                          <button
                            onClick={async () => {
                              const ok = await confirmAction({ title: t("confirm.title"), message: t("confirm.convert_offer"), variant: "warning" });
                              if (!ok) return;
                              try {
                                await convertMutation.mutateAsync(offer.id);
                                showSuccessToast("Offer converted to order");
                                refetch();
                              } catch { showErrorToast("Failed to convert offer"); }
                            }}
                            className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600 hover:text-emerald-700 transition-colors dark:hover:bg-emerald-950"
                            title="Convert to order"
                          >
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={async () => {
                            const ok = await confirmAction({ title: t("confirm.delete_title"), message: t("confirm.delete_offer"), variant: "danger" });
                            if (!ok) return;
                            setDeletingId(offer.id);
                            try {
                              await api.deleteOffer(offer.id);
                              showSuccessToast("Offer deleted");
                              refetch();
                            } catch { showErrorToast("Failed to delete"); }
                            finally { setDeletingId(null); }
                          }}
                          disabled={deletingId === offer.id}
                          className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                          title="Delete offer"
                        >
                          {deletingId === offer.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="p-4 border-t border-border flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Page {page} of {totalPages} · {totalItems} total
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 border border-border rounded-lg disabled:opacity-40 hover:bg-muted text-xs font-bold transition-colors"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 border border-border rounded-lg disabled:opacity-40 hover:bg-muted text-xs font-bold transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {isCreateModalOpen && (
        <CreateOfferModal
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={() => { setIsCreateModalOpen(false); refetch(); }}
        />
      )}
    </div>
  );
}


/* ============================================================
   OFFER DETAIL
   ============================================================ */

function AdminOfferDetail({ offerId, onBack }: { offerId: string; onBack: () => void }) {
  const { data, isLoading, isError, refetch } = useOffer(offerId);
  const statusMutation = useUpdateOfferStatus(offerId);
  const convertMutation = useConvertOfferToOrder();
  const convertInvoiceMutation = useConvertOfferToInvoice();
  const deleteMutation = useDeleteOffer(offerId);
  const sendEmailMutation = useSendOfferEmail();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const confirmAction = useConfirm();
  const [showReport, setShowReport] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);

  const offer = data?.data;

  const handleStatusChange = async (newStatus: string) => {
    try {
      await statusMutation.mutateAsync(newStatus);
      showSuccessToast("Success", `Offer status updated to ${newStatus}`);
      refetch();
    } catch { showErrorToast("Error", "Failed to update status"); }
  };

  const handleConvert = async () => {
    const ok = await confirmAction({
      title: "Convert to Order",
      message: "This will create a new order from this offer, copy all line items and documents, and mark the offer as converted. Continue?",
      confirmLabel: "Yes, Convert",
      variant: "warning",
    });
    if (!ok) return;
    try {
      const res = await convertMutation.mutateAsync(offerId);
      showSuccessToast("Success", "Offer converted to order!");
      if (res.data?.id) navigate(`/admin/orders/${res.data.id}`);
      else refetch();
    } catch { showErrorToast("Error", "Failed to convert offer"); }
  };

  const handleConvertToInvoice = async () => {
    const ok = await confirmAction({
      title: t("admin.offers.convert_to_invoice") !== "admin.offers.convert_to_invoice" ? t("admin.offers.convert_to_invoice") : "Convert to Invoice",
      message: t("admin.offers.convert_invoice_confirm") !== "admin.offers.convert_invoice_confirm" ? t("admin.offers.convert_invoice_confirm") : "This will create a new invoice from this offer with all line items and customer info pre-filled. Continue?",
      confirmLabel: t("confirm.yes") !== "confirm.yes" ? t("confirm.yes") : "Yes, Convert",
      variant: "warning",
    });
    if (!ok) return;
    try {
      const res = await convertInvoiceMutation.mutateAsync(offerId);
      showSuccessToast("Success", t("admin.offers.converted_to_invoice") !== "admin.offers.converted_to_invoice" ? t("admin.offers.converted_to_invoice") : "Offer converted to invoice!");
      if (res.data?.id) navigate(`/admin/invoices/${res.data.id}`);
      else refetch();
    } catch { showErrorToast("Error", t("admin.offers.convert_invoice_error") !== "admin.offers.convert_invoice_error" ? t("admin.offers.convert_invoice_error") : "Failed to convert offer to invoice"); }
  };

  const handleDelete = async () => {
    const ok = await confirmAction({ title: t("confirm.delete_title"), message: t("confirm.delete_offer"), variant: "danger" });
    if (!ok) return;
    try {
      await deleteMutation.mutateAsync(undefined as any);
      showSuccessToast("Success", "Offer deleted");
      onBack();
    } catch { showErrorToast("Error", "Failed to delete offer"); }
  };

  if (isLoading) return <AdminPageLoading message="Loading offer details..." />;
  if (isError || !offer) return <AdminPageError message="Failed to load offer details" onRetry={() => refetch()} />;

  const itemCount = offer.items?.length || 0;

  return (
    <>
      <div className="space-y-6">
        {/* Back + title + actions */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <button onClick={onBack} className="mt-1 p-2 hover:bg-muted rounded-lg text-muted-foreground transition-colors shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
                  Offer {offer.offer_number}
                </h1>
                <StatusBadge status={offer.status || "draft"} />
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Created {new Date(offer.created_at).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
                {offer.valid_until && (
                  <span className="ml-2 text-amber-600">
                    · Valid until {new Date(offer.valid_until).toLocaleDateString()}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <button
              onClick={() => setShowReport(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold border border-border text-foreground hover:bg-muted transition-colors"
            >
              <Printer className="w-4 h-4" /> Report
            </button>
            {offer.status !== "converted" && (
              <button
                onClick={() => setShowEmailModal(true)}
                className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold border border-blue-200 text-blue-700 hover:bg-blue-50 transition-colors"
              >
                <Mail className="w-4 h-4" />
                {offer.status === "draft" ? "Send" : "Resend"}
              </button>
            )}
            {offer.status !== "converted" && offer.status !== "rejected" && offer.status !== "expired" && (
              <>
                <button
                  onClick={handleConvertToInvoice}
                  disabled={convertInvoiceMutation.isPending}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold border border-emerald-200 text-emerald-700 hover:bg-emerald-50 transition-colors dark:border-emerald-800 dark:hover:bg-emerald-950"
                >
                  {convertInvoiceMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                  Convert to Invoice
                </button>
                <button
                  onClick={handleConvert}
                  disabled={convertMutation.isPending}
                  className="btn-accent flex items-center gap-2 text-xs font-bold"
                >
                  {convertMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                  Convert to Order
                </button>
              </>
            )}
          </div>
        </div>

        {/* Status timeline */}
        <div className="rounded-xl border border-border bg-card p-4">
          <StatusTimeline current={offer.status || "draft"} />
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard icon={Package} label="Items" value={`${itemCount} product${itemCount !== 1 ? "s" : ""}`} />
          <StatCard icon={DollarSign} label="Subtotal" value={`$${Number(offer.subtotal || 0).toFixed(2)}`} />
          <StatCard icon={Tag} label="Discount" value={`-$${Number(offer.discount || 0).toFixed(2)}`} />
          <StatCard icon={DollarSign} label="Total" value={`$${Number(offer.total || 0).toFixed(2)}`} accent />
        </div>

        {/* Main content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left — line items + docs */}
          <div className="lg:col-span-2 space-y-6">
            {/* Line items */}
            <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b border-border bg-muted/30 flex items-center gap-2">
                <Package className="w-4 h-4 text-muted-foreground" />
                <h2 className="text-sm font-bold text-foreground">Line Items</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[500px]">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Product</th>
                      <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right">Qty</th>
                      <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right">Price</th>
                      <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {offer.items?.map((item: any, idx: number) => (
                      <tr key={item.id || idx} className="hover:bg-muted/20 transition-colors">
                        <td className="px-5 py-4">
                          <div className="font-medium text-sm text-foreground">{item.product_name}</div>
                          {(item.sku || item.product_sku_live) && (
                            <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                              <Hash className="w-3 h-3" /> {item.sku || item.product_sku_live}
                            </div>
                          )}
                          {item.notes && (
                            <div className="text-[11px] text-muted-foreground mt-1 italic flex items-start gap-1">
                              <StickyNote className="w-3 h-3 mt-0.5 shrink-0" /> {item.notes}
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-4 text-right text-sm font-medium text-foreground">{item.quantity}</td>
                        <td className="px-5 py-4 text-right text-sm text-foreground">${Number(item.unit_price).toFixed(2)}</td>
                        <td className="px-5 py-4 text-right text-sm font-bold text-foreground">${Number(item.line_total).toFixed(2)}</td>
                      </tr>
                    ))}
                    {!offer.items?.length && (
                      <tr><td colSpan={4} className="px-5 py-8 text-center text-muted-foreground text-sm">No items</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Totals footer */}
              <div className="border-t border-border bg-muted/20 px-5 py-4">
                <div className="max-w-xs ml-auto space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-medium text-foreground">${Number(offer.subtotal || 0).toFixed(2)}</span>
                  </div>
                  {Number(offer.discount) > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Discount</span>
                      <span className="text-destructive font-medium">-${Number(offer.discount).toFixed(2)}</span>
                    </div>
                  )}
                  {Number(offer.shipping) > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Shipping</span>
                      <span className="font-medium text-foreground">${Number(offer.shipping).toFixed(2)}</span>
                    </div>
                  )}
                  {Number(offer.tax) > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Tax</span>
                      <span className="font-medium text-foreground">${Number(offer.tax).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-black pt-2 border-t border-border">
                    <span className="text-foreground">Total</span>
                    <span className="text-primary">${Number(offer.total || 0).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Notes */}
            {offer.notes && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-800 mb-2 flex items-center gap-2">
                  <StickyNote className="w-4 h-4" /> Notes & Terms
                </h4>
                <p className="text-sm text-amber-900 whitespace-pre-wrap leading-relaxed">{offer.notes}</p>
              </div>
            )}

            {/* Documents */}
            <OfferDocuments offer={offer} />
          </div>

          {/* Right sidebar */}
          <div className="space-y-5">
            {/* Customer card */}
            <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
              <div className="px-5 py-3.5 border-b border-border bg-muted/30 flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Customer</h2>
              </div>
              <div className="p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Building2 className="w-5 h-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-foreground truncate">{(offer as any).company_name || offer.customer_name || "Unknown"}</p>
                    {(offer as any).contact_person && (
                      <p className="text-xs text-muted-foreground truncate">{(offer as any).contact_person}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2.5 pt-2 border-t border-border">
                  <div className="flex items-center gap-2.5 text-sm">
                    <MailIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <a href={`mailto:${offer.customer_email}`} className="text-primary hover:underline truncate text-xs">
                      {offer.customer_email}
                    </a>
                  </div>
                  <div className="flex items-center gap-2.5 text-sm">
                    <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs text-foreground">{offer.customer_phone || "Not provided"}</span>
                  </div>
                </div>

                <button
                  onClick={() => navigate(`/admin/customers/${offer.customer_id}`)}
                  className="w-full mt-2 px-3 py-2 text-xs font-bold text-primary hover:bg-primary/5 rounded-lg transition-colors flex items-center justify-between group border border-primary/10"
                >
                  View Customer Profile
                  <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              </div>
            </div>

            {/* Actions card */}
            <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
              <div className="px-5 py-3.5 border-b border-border bg-muted/30">
                <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Actions</h2>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Update Status</label>
                  <select
                    value={offer.status}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    className="w-full px-3 py-2.5 bg-card border border-border rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors disabled:opacity-50"
                    disabled={offer.status === "converted" || statusMutation.isPending}
                  >
                    <option value="draft">Draft</option>
                    <option value="sent">Sent to Customer</option>
                    <option value="accepted">Accepted</option>
                    <option value="rejected">Rejected</option>
                    <option value="expired">Expired</option>
                    <option value="converted" disabled>Converted to Order</option>
                  </select>
                </div>

                <div className="pt-3 border-t border-border">
                  <button
                    onClick={handleDelete}
                    className="w-full px-4 py-2.5 border border-destructive/20 text-destructive hover:bg-destructive/5 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete Offer
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showReport && (
        <ReportPreviewModal
          onClose={() => setShowReport(false)}
          defaultType="quote"
          source={{
            documentNumber: offer.offer_number,
            issueDate: offer.created_at,
            validUntil: offer.valid_until,
            customer: {
              name: (offer as any).contact_person || offer.customer_name || "N/A",
              company: (offer as any).company_name || offer.customer_name,
              phone: offer.customer_phone,
              email: offer.customer_email,
            },
            items: (offer.items ?? []).map((it: any) => ({
              description: it.product_name || it.product_name_live || "Item",
              sku: it.sku || it.product_sku_live,
              qty: Number(it.quantity),
              unitPrice: Number(it.unit_price),
              lineTotal: Number(it.line_total),
              notes: it.notes,
            })),
            subtotal: Number(offer.subtotal || 0),
            discount: Number(offer.discount || 0),
            shipping: Number(offer.shipping || 0),
            total: Number(offer.total || 0),
            notes: offer.notes,
          }}
        />
      )}
      {showEmailModal && (
        <OfferEmailModal
          offer={offer}
          isPending={sendEmailMutation.isPending}
          onClose={() => setShowEmailModal(false)}
          onSend={async ({ subject, message }) => {
            try {
              await sendEmailMutation.mutateAsync({ offerId, subject, message });
              showSuccessToast("Email Sent", `Offer ${offer.offer_number} sent to ${offer.customer_email}`);
              setShowEmailModal(false);
              refetch();
            } catch { showErrorToast("Error", "Failed to send email — check SMTP settings"); }
          }}
        />
      )}
    </>
  );
}


/* ============================================================
   EMAIL MODAL
   ============================================================ */

function OfferEmailModal({
  offer, isPending, onClose, onSend,
}: {
  offer: any; isPending: boolean; onClose: () => void;
  onSend: (data: { subject: string; message: string }) => void;
}) {
  const [subject, setSubject] = useState(`REMQUIP: Your Quote ${offer.offer_number}`);
  const [message, setMessage] = useState("");
  const customerLabel = [(offer as any).contact_person, (offer as any).company_name].filter(Boolean).join(" — ") || offer.customer_email;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg border border-border overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-100"><Send className="w-4 h-4 text-blue-600" /></div>
            <h2 className="text-sm font-bold text-foreground">Send Offer to Customer</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="p-3 bg-muted rounded-xl text-xs text-muted-foreground flex items-start gap-2.5">
            <Mail className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <span className="font-bold text-foreground">To:</span> {offer.customer_email}
              {customerLabel !== offer.customer_email && <span className="ml-1 opacity-60">({customerLabel})</span>}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Subject</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
              Personalised Message <span className="font-normal normal-case">(optional)</span>
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              placeholder={`Dear ${(offer as any).contact_person || "Customer"},\n\nPlease find enclosed your quote…`}
              className="w-full px-3.5 py-2.5 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors resize-none"
            />
          </div>

          <div className="p-3 bg-primary/5 rounded-xl text-xs text-primary border border-primary/10">
            The email will include the full quote details (items, pricing, totals).
            {offer.status === "draft" && " Status will advance to Sent."}
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-border bg-muted/20">
          <button onClick={onClose} disabled={isPending} className="px-4 py-2.5 text-xs font-bold text-muted-foreground hover:bg-muted rounded-lg transition-colors">
            Cancel
          </button>
          <button
            onClick={() => onSend({ subject, message })}
            disabled={isPending || !subject.trim()}
            className="btn-accent flex items-center gap-2 px-5 py-2.5 text-xs font-bold disabled:opacity-50"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {isPending ? "Sending…" : "Send Offer"}
          </button>
        </div>
      </div>
    </div>
  );
}


/* ============================================================
   DOCUMENTS
   ============================================================ */

function OfferDocuments({ offer }: { offer: any }) {
  const { data: docsData, refetch } = useOfferDocuments(offer.id);
  const uploadMutation = useUploadOfferDocument();
  const deleteMutation = useDeleteOfferDocument();
  const [isUploading, setIsUploading] = useState(false);
  const documents = docsData?.data || offer.documents || [];

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { showErrorToast("Error", "File too large (max 10MB)"); return; }
    setIsUploading(true);
    try {
      await uploadMutation.mutateAsync({ file, offerId: offer.id, documentType: "attachment" });
      showSuccessToast("Success", "Document uploaded");
      refetch();
    } catch { showErrorToast("Error", "Failed to upload"); }
    finally { setIsUploading(false); e.target.value = ""; }
  };

  const handleDelete = async (docId: string) => {
    if (!confirm("Delete this document?")) return;
    try {
      await deleteMutation.mutateAsync({ offerId: offer.id, documentId: docId });
      showSuccessToast("Success", "Document removed");
      refetch();
    } catch { showErrorToast("Error", "Failed to remove document"); }
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
      <div className="px-5 py-4 border-b border-border bg-muted/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-bold text-foreground">Attachments</h2>
          <span className="text-[10px] font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">{documents.length}</span>
        </div>
        <label className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-lg border border-border text-foreground hover:bg-muted transition-colors cursor-pointer ${isUploading ? "opacity-60 pointer-events-none" : ""}`}>
          <Upload className="w-3.5 h-3.5" /> {isUploading ? "Uploading..." : "Upload"}
          <input type="file" onChange={handleUpload} className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.jpg,.jpeg,.png" />
        </label>
      </div>

      <div className="p-4 space-y-2">
        {documents.map((doc: any) => (
          <div key={doc.id} className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-muted/30 transition-colors group">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 bg-muted rounded-lg shrink-0"><FileText className="w-4 h-4 text-muted-foreground" /></div>
              <div className="min-w-0">
                <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-foreground hover:text-primary hover:underline truncate block">
                  {doc.file_name}
                </a>
                <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                  <span>{new Date(doc.created_at).toLocaleString()}</span>
                  <span>·</span>
                  <span>{doc.uploaded_by || "Admin"}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <a href={doc.file_url} download className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-lg transition-colors">
                <Download className="w-4 h-4" />
              </a>
              <button onClick={() => handleDelete(doc.id)} className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded-lg transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}

        {documents.length === 0 && (
          <div className="text-center py-8 border-2 border-dashed border-border rounded-xl bg-muted/20">
            <FileText className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">No attachments yet</p>
          </div>
        )}
      </div>
    </div>
  );
}


/* ============================================================
   CREATE OFFER MODAL
   ============================================================ */

function CreateOfferModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const createMutation = useCreateOffer();
  const [step, setStep] = useState(1);

  // State
  const [customerId, setCustomerId] = useState("");
  const [items, setItems] = useState<any[]>([]);
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [discount, setDiscount] = useState(0);
  const [shipping, setShipping] = useState(0);
  const [prodPage, setProdPage] = useState(1);
  const PROD_PER_PAGE = 12;

  // Search
  const [customerSearch, setCustomerSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [showProductDropdown, setShowProductDropdown] = useState(false);

  const { data: allCustData } = useCustomers(1, 100);
  const { data: searchCustData } = useSearchCustomers(customerSearch);
  const filteredCustomers = useMemo(() => {
    if (customerSearch) {
      return Array.isArray(searchCustData?.data) ? searchCustData.data : (searchCustData?.data as any)?.items || [];
    }
    return Array.isArray(allCustData?.data) ? allCustData.data : (allCustData?.data as any)?.items || [];
  }, [allCustData, searchCustData, customerSearch]);

  // Fetch all products when search is empty, or search results when typing
  const { data: allProdData } = useApiQuery(
    ['products', 'all-for-offer'],
    () => api.getProducts(1, 100),
    { staleTime: 1000 * 60 * 5 }
  );
  const { data: searchProdData } = useSearchProducts(productSearch);

  const productResults = useMemo(() => {
    const source = productSearch.trim()
      ? searchProdData
      : allProdData;
    if (!source?.data) return [];
    return Array.isArray(source.data) ? source.data : (source.data as any)?.items || [];
  }, [productSearch, searchProdData, allProdData]);

  const allCustomers = Array.isArray(allCustData?.data) ? allCustData.data : (allCustData?.data as any)?.items || [];
  const selectedCustomer = allCustomers.find((c: any) => c.id === customerId)
    ?? filteredCustomers.find((c: any) => c.id === customerId);

  const handleAddProduct = (product: any) => {
    setItems([...items, {
      product_id: product.id, name: product.name, sku: product.sku,
      quantity: 1, unit_price: product.price || 0, notes: "",
    }]);
    setProductSearch("");
    setShowProductDropdown(false);
    setProdPage(1);
  };

  // Reset product page when search changes
  useEffect(() => { setProdPage(1); }, [productSearch]);

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const removeItem = (index: number) => setItems(items.filter((_, i) => i !== index));

  const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  const total = subtotal - Number(discount) + Number(shipping);

  const handleSubmit = async () => {
    if (!customerId) return showErrorToast("Error", "Please select a customer");
    if (items.length === 0) return showErrorToast("Error", "Add at least one product");
    const unnamed = items.find(i => !i.product_id && !i.name.trim());
    if (unnamed) return showErrorToast("Error", "All custom items must have a name");
    try {
      await createMutation.mutateAsync({
        customer_id: customerId, valid_until: validUntil || null, notes, discount, shipping,
        items: items.map(i => ({
          product_id: i.product_id, name: i.name, sku: i.sku,
          quantity: Number(i.quantity), unit_price: Number(i.unit_price), notes: i.notes,
        })),
      });
      showSuccessToast("Success", "Offer created successfully");
      onSuccess();
    } catch { showErrorToast("Error", "Failed to create offer"); }
  };

  const canProceed = step === 1 ? !!customerId : step === 2 ? items.length > 0 : true;

  const steps = [
    { num: 1, label: "Customer", icon: User },
    { num: 2, label: "Products", icon: Package },
    { num: 3, label: "Review", icon: CheckCircle2 },
  ];

  return (
    <div className="fixed inset-0 bg-foreground/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col border border-border">
        {/* Header with steps */}
        <div className="border-b border-border">
          <div className="flex items-center justify-between px-6 py-4">
            <h2 className="text-base font-black text-foreground">Create New Offer</h2>
            <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg text-muted-foreground transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-0 px-6 pb-0">
            {steps.map((s, i) => {
              const Icon = s.icon;
              const active = step === s.num;
              const done = step > s.num;
              return (
                <React.Fragment key={s.num}>
                  <button
                    type="button"
                    onClick={() => s.num < step && setStep(s.num)}
                    className={`flex items-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${
                      active ? "border-primary text-primary" :
                      done ? "border-primary/30 text-primary/60 cursor-pointer hover:text-primary" :
                      "border-transparent text-muted-foreground"
                    }`}
                  >
                    {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
                    <span className="hidden sm:inline">{s.label}</span>
                  </button>
                  {i < steps.length - 1 && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30 mx-1" />}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Step content */}
        <div className="p-6 overflow-y-auto flex-1 bg-muted/20">
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Search Customer</label>
                <div className="relative">
                  <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-3" />
                  <input
                    type="text"
                    placeholder="Search by name, company, or email..."
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1.5 max-h-[340px] overflow-y-auto rounded-xl border border-border bg-card">
                {filteredCustomers.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">No customers found</p>
                )}
                {filteredCustomers.map((c: any) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCustomerId(c.id)}
                    className={`w-full text-left px-4 py-3.5 flex items-center gap-3 transition-colors border-b border-border last:border-0 ${
                      customerId === c.id ? "bg-primary/5 ring-1 ring-primary/20" : "hover:bg-muted/50"
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                      customerId === c.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}>
                      {(c.company_name || c.full_name || "?").slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-sm text-foreground truncate">{c.company_name || c.full_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{c.email}</p>
                    </div>
                    {customerId === c.id && <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />}
                  </button>
                ))}
              </div>

              {selectedCustomer && (
                <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-foreground">{selectedCustomer.company_name || selectedCustomer.full_name}</p>
                    <p className="text-xs text-muted-foreground">{selectedCustomer.email}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Add Products</label>
                <div className="relative mb-3">
                  <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-3" />
                  <input
                    type="text"
                    placeholder="Search products by name or SKU..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                  />
                </div>
                {/* Product grid always visible with pagination */}
                {(() => {
                  const totalProds = productResults.length;
                  const totalProdPages = Math.ceil(totalProds / PROD_PER_PAGE);
                  const pagedProducts = productResults.slice((prodPage - 1) * PROD_PER_PAGE, prodPage * PROD_PER_PAGE);
                  return totalProds > 0 ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 max-h-[340px] overflow-y-auto rounded-xl border border-border bg-card p-2.5">
                        {pagedProducts.map((p: any) => {
                          const imgSrc = p.image
                            ? resolveUploadImageUrl(String(p.image))
                            : p.images?.[0]?.image_url
                              ? resolveUploadImageUrl(String(p.images[0].image_url))
                              : "";
                          const alreadyAdded = items.some((it: any) => it.product_id === String(p.id));
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => !alreadyAdded && handleAddProduct(p)}
                              disabled={alreadyAdded}
                              className={`relative text-left rounded-lg border p-2 transition-all ${
                                alreadyAdded
                                  ? "border-primary/30 bg-primary/5 opacity-60 cursor-not-allowed"
                                  : "border-border hover:border-primary/40 hover:shadow-sm hover:bg-muted/30 cursor-pointer"
                              }`}
                            >
                              <div className="aspect-square rounded-md bg-muted/40 overflow-hidden mb-2 flex items-center justify-center">
                                {imgSrc ? (
                                  <img src={imgSrc} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
                                ) : (
                                  <Package className="w-6 h-6 text-muted-foreground/40" />
                                )}
                              </div>
                              <p className="text-xs font-semibold text-foreground truncate leading-tight">{p.name}</p>
                              <p className="text-[10px] text-muted-foreground truncate">{p.sku || "—"}</p>
                              <div className="flex items-center justify-between mt-1">
                                <p className="text-xs font-bold text-primary">${Number(p.price || 0).toFixed(2)}</p>
                                {p.stock !== undefined && (
                                  <span className={`text-[9px] font-bold ${Number(p.stock) > 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                                    {Number(p.stock) > 0 ? `${p.stock} in stock` : 'Out'}
                                  </span>
                                )}
                              </div>
                              {alreadyAdded && (
                                <div className="absolute top-1.5 right-1.5">
                                  <CheckCircle2 className="w-4 h-4 text-primary" />
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                      {totalProdPages > 1 && (
                        <div className="flex items-center justify-between px-1">
                          <span className="text-[11px] text-muted-foreground font-medium">{totalProds} products · Page {prodPage}/{totalProdPages}</span>
                          <div className="flex gap-1.5">
                            <button type="button" onClick={() => setProdPage(p => Math.max(1, p - 1))} disabled={prodPage === 1}
                              className="px-2.5 py-1 text-[11px] font-bold border border-border rounded-lg disabled:opacity-30 hover:bg-muted transition-colors">Prev</button>
                            <button type="button" onClick={() => setProdPage(p => Math.min(totalProdPages, p + 1))} disabled={prodPage === totalProdPages}
                              className="px-2.5 py-1 text-[11px] font-bold border border-border rounded-lg disabled:opacity-30 hover:bg-muted transition-colors">Next</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-sm text-muted-foreground border border-dashed border-border rounded-xl">
                      <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      No products found
                    </div>
                  );
                })()}
              </div>

              {items.length > 0 && (
                <div className="rounded-xl border border-border bg-card overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-muted/50 border-b border-border">
                      <tr>
                        <th className="p-3.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Product</th>
                        <th className="p-3.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground w-20 text-center">Qty</th>
                        <th className="p-3.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground w-28">Unit Price</th>
                        <th className="p-3.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right w-24">Total</th>
                        <th className="p-3.5 w-10" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {items.map((item, idx) => (
                        <tr key={idx} className="hover:bg-muted/20 transition-colors">
                          <td className="p-3.5">
                            {item.product_id ? (
                              <>
                                <div className="font-medium text-sm text-foreground">{item.name}</div>
                                <div className="text-[11px] text-muted-foreground">SKU: {item.sku}</div>
                              </>
                            ) : (
                              <div className="space-y-1">
                                <input
                                  type="text"
                                  value={item.name}
                                  onChange={(e) => updateItem(idx, "name", e.target.value)}
                                  placeholder="Item name *"
                                  className="w-full text-sm px-2 py-1.5 border border-border rounded-md bg-card focus:outline-none focus:ring-1 focus:ring-primary/30"
                                />
                                <input
                                  type="text"
                                  value={item.sku}
                                  onChange={(e) => updateItem(idx, "sku", e.target.value)}
                                  placeholder="SKU (optional)"
                                  className="w-full text-[11px] px-2 py-1 border border-border rounded-md bg-muted/30 focus:outline-none focus:ring-1 focus:ring-primary/30"
                                />
                              </div>
                            )}
                            <input
                              type="text"
                              value={item.notes}
                              onChange={(e) => updateItem(idx, "notes", e.target.value)}
                              placeholder="Line note (optional)"
                              className="mt-1.5 w-full text-[11px] px-2 py-1 border border-border rounded-md bg-muted/30 focus:outline-none focus:ring-1 focus:ring-primary/30"
                            />
                          </td>
                          <td className="p-3.5">
                            <input
                              type="number" min="1" value={item.quantity}
                              onChange={(e) => updateItem(idx, "quantity", parseInt(e.target.value) || 1)}
                              className="w-full px-2 py-1.5 border border-border rounded-lg text-center text-sm bg-card focus:outline-none focus:ring-1 focus:ring-primary/30"
                            />
                          </td>
                          <td className="p-3.5">
                            <div className="relative">
                              <span className="absolute left-2.5 top-2 text-muted-foreground text-sm">$</span>
                              <input
                                type="number" min="0" step="0.01" value={item.unit_price}
                                onChange={(e) => updateItem(idx, "unit_price", parseFloat(e.target.value) || 0)}
                                className="w-full pl-6 pr-2 py-1.5 border border-border rounded-lg text-sm bg-card focus:outline-none focus:ring-1 focus:ring-primary/30"
                              />
                            </div>
                          </td>
                          <td className="p-3.5 text-right font-bold text-sm text-foreground">
                            ${(item.quantity * item.unit_price).toFixed(2)}
                          </td>
                          <td className="p-3.5 text-center">
                            <button type="button" onClick={() => removeItem(idx)} className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors">
                              <X className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <button
                type="button"
                onClick={() => setItems([...items, { product_id: null, name: "", sku: "", quantity: 1, unit_price: 0, notes: "" }])}
                className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground border border-dashed border-border rounded-xl px-4 py-2.5 w-full hover:bg-muted/30 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add Custom Item
              </button>

              {items.length === 0 && (
                <div className="text-center py-12 border-2 border-dashed border-border rounded-xl bg-muted/10">
                  <Package className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Search and add products above, or add a custom item</p>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Valid Until</label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 text-muted-foreground absolute left-3.5 top-3" />
                    <input
                      type="date" value={validUntil}
                      onChange={(e) => setValidUntil(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Notes to Customer</label>
                  <textarea
                    rows={5} value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Payment terms, conditions, special notes..."
                    className="w-full px-3.5 py-2.5 bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors resize-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Summary</label>
                <div className="bg-card border border-border rounded-xl p-5 space-y-3">
                  {selectedCustomer && (
                    <div className="flex items-center gap-2 pb-3 border-b border-border">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground truncate">{selectedCustomer.company_name || selectedCustomer.full_name}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{items.length} item{items.length !== 1 ? "s" : ""}</span>
                    <span className="font-medium text-foreground">${subtotal.toFixed(2)}</span>
                  </div>

                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Discount</span>
                    <div className="relative w-24">
                      <span className="absolute left-2 top-1.5 text-muted-foreground text-xs">$</span>
                      <input
                        type="number" min="0" step="0.01" value={discount}
                        onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                        className="w-full pl-5 pr-2 py-1 border border-border rounded-lg bg-card text-sm text-right focus:outline-none focus:ring-1 focus:ring-primary/30"
                      />
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-sm pb-3 border-b border-border">
                    <span className="text-muted-foreground">Shipping</span>
                    <div className="relative w-24">
                      <span className="absolute left-2 top-1.5 text-muted-foreground text-xs">$</span>
                      <input
                        type="number" min="0" step="0.01" value={shipping}
                        onChange={(e) => setShipping(parseFloat(e.target.value) || 0)}
                        className="w-full pl-5 pr-2 py-1 border border-border rounded-lg bg-card text-sm text-right focus:outline-none focus:ring-1 focus:ring-primary/30"
                      />
                    </div>
                  </div>

                  <div className="flex justify-between text-lg font-black pt-1">
                    <span className="text-foreground">Total</span>
                    <span className="text-primary">${total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-card flex items-center justify-between shrink-0">
          <div>
            {step > 1 && (
              <button type="button" onClick={() => setStep(step - 1)} className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors">
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2.5 text-xs font-bold text-muted-foreground hover:bg-muted rounded-lg transition-colors">
              Cancel
            </button>
            {step < 3 ? (
              <button
                type="button"
                onClick={() => setStep(step + 1)}
                disabled={!canProceed}
                className="btn-accent px-5 py-2.5 text-xs font-bold flex items-center gap-2 disabled:opacity-40"
              >
                Next <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={createMutation.isPending || !canProceed}
                className="btn-accent px-6 py-2.5 text-xs font-bold flex items-center gap-2 disabled:opacity-50"
              >
                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {createMutation.isPending ? "Creating…" : "Create Offer"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

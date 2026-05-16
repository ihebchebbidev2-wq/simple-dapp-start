import React, { useState, useEffect } from "react";
import { Link, Navigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useAuth } from "@/contexts/AuthContext";
import { api, unwrapApiList, type Order } from "@/lib/api";
import {
  Package, User, Clock, Truck, CheckCircle, Eye, ArrowLeft,
  Shield, ChevronDown, ChevronUp, Loader2, AlertCircle,
  LogOut, Phone, Mail, MessageSquareText, ShoppingBag,
  Download, Printer, Settings, CreditCard, MapPin,
  ShieldCheck, FileText, Box, X, CalendarClock, Banknote,
} from "lucide-react";
import { showSuccessToast, showErrorToast } from "@/lib/toast";

type Tab = "orders" | "payments" | "profile" | "security" | "contacts" | "notes" | "addresses";

const statusStyles: Record<string, string> = {
  pending: "badge-warning",
  confirmed: "badge-info",
  processing: "badge-info",
  shipped: "badge-info",
  delivered: "badge-success",
  completed: "badge-success",
  cancelled: "badge-destructive",
};

const statusFlow = ["pending", "confirmed", "processing", "shipped", "delivered"];
const statusIcons: Record<string, React.ElementType> = {
  pending: Clock,
  confirmed: CheckCircle,
  processing: Package,
  shipped: Truck,
  delivered: CheckCircle,
};

interface UserOrder {
  id: string;
  order_number: string;
  total: number;
  status: string;
  created_at: string;
  items_count: number;
  tracking_number?: string;
  estimated_delivery_date?: string;
}


interface CustomerNoteRow {
  id: string;
  note: string;
  is_internal: boolean;
  created_at: string;
}

function toNumber(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export default function CustomerDashboardPage() {
  const { t } = useLanguage();
  const { formatPrice } = useCurrency();
  const { user, isAuthenticated, isLoading: authLoading, updateProfile, logout } = useAuth();

  const [tab, setTab] = useState<Tab>("orders");
  const [orders, setOrders] = useState<UserOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<UserOrder | null>(null);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);




  // Notes
  const [notes, setNotes] = useState<CustomerNoteRow[]>([]);
  const [notesLoading, setNotesLoading] = useState(true);

  // Addresses
  const [addresses, setAddresses] = useState<{ type: string; address: string; address_2: string; city: string; province: string; postal_code: string; country: string }[]>([]);
  const [addressesLoading, setAddressesLoading] = useState(true);

  // Installments
  const [installments, setInstallments] = useState<any[]>([]);
  const [installmentsLoading, setInstallmentsLoading] = useState(true);

  // Profile form
  const [profileData, setProfileData] = useState({ full_name: "", phone: "" });
  const [profileSaving, setProfileSaving] = useState(false);

  // Password form
  const [passwords, setPasswords] = useState({ current: "", next: "", confirm: "" });
  const [passwordSaving, setPasswordSaving] = useState(false);

  // Receipt modal
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Order | null>(null);

  // Sync profile form with auth user
  useEffect(() => {
    if (user) {
      setProfileData({
        full_name: user.full_name || "",
        phone: (user as any).phone || "",
      });
    }
  }, [user?.id]);

  // Load orders
  useEffect(() => {
    if (!isAuthenticated) return;
    (async () => {
      try {
        setOrdersLoading(true);
        setOrdersError(null);
        const res = await api.getUserOrders(1, 50);
        const rows = unwrapApiList<Record<string, unknown>>(res as any, []);
        setOrders(rows.map((o) => ({
          id: String(o.id ?? ""),
          order_number: String(o.order_number ?? o.id ?? ""),
          total: Number(o.total ?? 0),
          status: String(o.status ?? "pending"),
          created_at: String(o.created_at ?? ""),
          items_count: Number(o.items_count ?? 0),
          tracking_number: o.tracking_number != null ? String(o.tracking_number) : undefined,
          estimated_delivery_date: o.estimated_delivery_date != null ? String(o.estimated_delivery_date) : undefined,
        })));
      } catch {
        setOrdersError(t("customer.orders_error") || "Failed to load orders.");
      } finally {
        setOrdersLoading(false);
      }
    })();
  }, [isAuthenticated]);




  // Load notes
  useEffect(() => {
    if (!isAuthenticated) return;
    (async () => {
      try {
        setNotesLoading(true);
        const res = await api.getUserNotes(1, 50);
        const items = unwrapApiList<CustomerNoteRow>(res as any, []);
        setNotes(items.map((n) => ({
          id: String(n.id ?? ""),
          note: String(n.note ?? ""),
          is_internal: Boolean(n.is_internal ?? false),
          created_at: String(n.created_at ?? ""),
        })));
      } catch { /* ignore */ } finally { setNotesLoading(false); }
    })();
  }, [isAuthenticated]);
  // Load addresses
  useEffect(() => {
    if (!isAuthenticated) return;
    (async () => {
      try {
        setAddressesLoading(true);
        const res = await api.getUserAddresses();
        const items = Array.isArray((res as any)?.data) ? (res as any).data : [];
        setAddresses(items);
      } catch { /* ignore */ } finally { setAddressesLoading(false); }
    })();
  }, [isAuthenticated]);

  // Load installments
  useEffect(() => {
    if (!isAuthenticated) return;
    (async () => {
      try {
        setInstallmentsLoading(true);
        const res = await api.getUserInstallments();
        const items = Array.isArray((res as any)?.data) ? (res as any).data : [];
        setInstallments(items);
      } catch { /* ignore */ } finally { setInstallmentsLoading(false); }
    })();
  }, [isAuthenticated]);

  // Redirect unauthenticated (after all hooks)
  if (!authLoading && (!isAuthenticated || !user)) {
    return <Navigate to="/login" replace />;
  }

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    try {
      await updateProfile({ full_name: profileData.full_name, phone: profileData.phone });
      showSuccessToast(t("customer.profile_updated"));
    } catch {
      showErrorToast(t("customer.profile_update_error"));
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePasswordSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwords.next !== passwords.confirm) {
      showErrorToast(t("validation.password_mismatch"));
      return;
    }
    if (passwords.next.length < 8) {
      showErrorToast(t("validation.min_password"));
      return;
    }
    setPasswordSaving(true);
    try {
      await api.updatePassword(user!.id, passwords.current, passwords.next);
      showSuccessToast(t("customer.password_updated"));
      setPasswords({ current: "", next: "", confirm: "" });
    } catch (err: any) {
      showErrorToast(err?.message || t("customer.password_update_error"));
    } finally {
      setPasswordSaving(false);
    }
  };

  async function openReceipt(orderId: string) {
    setReceiptOpen(true);
    setReceiptLoading(true);
    setReceiptError(null);
    setReceipt(null);
    try {
      const res = await api.getUserOrderReceipt(orderId);
      setReceipt(res.data as Order);
    } catch (e) {
      setReceiptError(e instanceof Error ? e.message : t("customer.receipt_error"));
    } finally {
      setReceiptLoading(false);
    }
  }

  function printReceipt() {
    if (!receipt) return;
    const items = (receipt.items ?? []).map((it: any) => ({
      name: it.product_name ?? it.name ?? "Item",
      sku: it.product_sku ?? it.sku ?? "",
      qty: toNumber(it.quantity),
      price: toNumber(it.unit_price ?? it.unitPrice),
      total: toNumber(it.subtotal ?? it.line_total ?? (toNumber(it.quantity) * toNumber(it.unit_price))),
    }));
    const sub = toNumber((receipt as any).subtotal);
    const tax = toNumber((receipt as any).tax_amount);
    const ship = toNumber((receipt as any).shipping_amount);
    const total = toNumber((receipt as any).total_amount);
    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Receipt #${receipt.order_number}</title>
      <style>body{font-family:system-ui,sans-serif;padding:40px;color:#111}h1{font-size:20px;margin:0}
      table{width:100%;border-collapse:collapse;margin:20px 0}th{text-align:left;border-bottom:2px solid #111;padding:8px;font-size:11px;text-transform:uppercase}
      td{padding:10px 8px;border-bottom:1px solid #eee;font-size:13px}.right{text-align:right}.bold{font-weight:700}
      .totals{max-width:280px;margin-left:auto}.trow{display:flex;justify-content:space-between;padding:6px 0;font-size:13px}
      .grand{border-top:2px solid #111;margin-top:8px;padding-top:12px;font-size:18px;font-weight:800}</style></head><body>
      <h1>REMQUIP — ${t("customer.order_receipt")}</h1><p style="color:#666;font-size:12px">#${receipt.order_number} · ${receipt.order_date ? new Date(receipt.order_date).toLocaleDateString() : ""}</p>
      <table><thead><tr><th>${t("customer.product")}</th><th class="right">${t("cart.quantity")}</th><th class="right">${t("customer.unit_price")}</th><th class="right">${t("cart.total")}</th></tr></thead><tbody>
      ${items.map(i => `<tr><td><strong>${i.name}</strong>${i.sku ? `<br><span style="color:#999;font-size:11px">${i.sku}</span>` : ""}</td><td class="right bold">${i.qty}</td><td class="right">${i.price.toFixed(2)}</td><td class="right bold">${i.total.toFixed(2)}</td></tr>`).join("")}
      </tbody></table><div class="totals">
      <div class="trow"><span>${t("cart.subtotal")}</span><span>${sub.toFixed(2)}</span></div>
      <div class="trow"><span>${t("cart.tax")}</span><span>${tax.toFixed(2)}</span></div>
      <div class="trow"><span>${t("cart.shipping")}</span><span>${ship.toFixed(2)}</span></div>
      <div class="trow grand"><span>${t("cart.total")}</span><span>${total.toFixed(2)} CAD</span></div>
      </div></body></html>`;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  }

  const handleLogout = async () => { await logout(); };

  const tabs: { key: Tab; labelKey: string; icon: React.ElementType }[] = [
    { key: "orders",    labelKey: "customer.my_orders",      icon: Package },
    { key: "payments",  labelKey: "customer.payments_tab",   icon: CalendarClock },
    { key: "addresses", labelKey: "customer.addresses_tab",  icon: MapPin },
    { key: "contacts",  labelKey: "customer.support",        icon: Phone },
    { key: "notes",     labelKey: "customer.notes_tab",      icon: MessageSquareText },
    { key: "profile",   labelKey: "customer.profile",        icon: User },
    { key: "security",  labelKey: "customer.security",       icon: Shield },
  ];

  const pendingCount = orders.filter((o) => o.status !== "completed" && o.status !== "delivered" && o.status !== "cancelled").length;
  const completedCount = orders.filter((o) => o.status === "completed" || o.status === "delivered").length;

  // ── Order Detail View ──
  if (selectedOrder) {
    const currentIdx = statusFlow.indexOf(selectedOrder.status);
    return (
      <div className="container mx-auto max-w-5xl px-4 py-8">
        <button onClick={() => setSelectedOrder(null)} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5 mb-6 font-medium">
          <ArrowLeft className="h-4 w-4" /> {t("customer.back_to_orders")}
        </button>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-8">
          <div>
            <h2 className="font-display font-bold text-xl md:text-2xl tracking-tight">
              {t("customer.order")} #{selectedOrder.order_number || selectedOrder.id.slice(0, 8)}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">{t("customer.placed_on")} {selectedOrder.created_at?.split("T")[0]}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={statusStyles[selectedOrder.status] || "badge-warning"}>{t(`order.status.${selectedOrder.status}`) || selectedOrder.status}</span>
            <button onClick={() => openReceipt(selectedOrder.id)} className="btn-accent text-xs py-2 px-4 rounded-sm font-medium flex items-center gap-1.5">
              <Download className="h-3.5 w-3.5" /> {t("customer.download_receipt")}
            </button>
          </div>
        </div>

        {/* Status timeline */}
        <div className="dashboard-card mb-6">
          <h3 className="font-display font-bold text-sm uppercase mb-4 text-muted-foreground">{t("customer.order_progress")}</h3>
          <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto pb-2">
            {statusFlow.map((s, i) => {
              const Icon = statusIcons[s];
              const isActive = i <= currentIdx;
              const isCurrent = s === selectedOrder.status;
              return (
                <React.Fragment key={s}>
                  {i > 0 && <div className={`h-0.5 flex-1 min-w-4 ${i <= currentIdx ? "bg-accent" : "bg-border"}`} />}
                  <div className={`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-sm text-xs font-medium whitespace-nowrap ${
                    isCurrent ? "bg-accent text-accent-foreground" : isActive ? "bg-accent/20 text-accent" : "bg-secondary text-muted-foreground"
                  }`}>
                    <Icon className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{t(`order.status.${s}`)}</span>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
          {selectedOrder.tracking_number && (
            <div className="flex items-center gap-2 text-sm bg-secondary/50 p-3 rounded-sm mt-4">
              <Truck className="h-4 w-4 text-accent flex-shrink-0" />
              <span className="text-muted-foreground">{t("customer.tracking")}:</span>
              <span className="font-mono text-xs">{selectedOrder.tracking_number}</span>
            </div>
          )}
          {selectedOrder.estimated_delivery_date && (
            <p className="text-xs text-muted-foreground mt-3">
              {t("customer.estimated_delivery")}: <strong>{selectedOrder.estimated_delivery_date}</strong>
            </p>
          )}
        </div>

        <div className="dashboard-card">
          <p className="text-sm text-muted-foreground">
            {selectedOrder.items_count} {t("customer.items")} · <span className="font-bold text-foreground">{formatPrice(selectedOrder.total)}</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8 md:py-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">{t("customer.welcome_back")}</p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">{user?.full_name || user?.email}</h1>
          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-accent" /> {user?.email}
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-5 py-2.5 rounded-sm text-sm font-medium border border-border text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors"
        >
          <LogOut className="h-4 w-4" /> {t("auth.logout")}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <div className="dashboard-card flex items-center gap-3">
          <Package className="h-6 w-6 text-accent" strokeWidth={1.5} />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{t("customer.total_orders")}</p>
            <p className="text-xl font-bold font-display">{ordersLoading ? "—" : orders.length}</p>
          </div>
        </div>
        <div className="dashboard-card flex items-center gap-3">
          <Clock className="h-6 w-6 text-accent" strokeWidth={1.5} />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{t("customer.pending_orders")}</p>
            <p className="text-xl font-bold font-display">{ordersLoading ? "—" : pendingCount}</p>
          </div>
        </div>
        <div className="dashboard-card flex items-center gap-3">
          <CheckCircle className="h-6 w-6 text-accent" strokeWidth={1.5} />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{t("customer.completed_orders")}</p>
            <p className="text-xl font-bold font-display">{ordersLoading ? "—" : completedCount}</p>
          </div>
        </div>
        <div className="dashboard-card flex items-center gap-3">
          <CreditCard className="h-6 w-6 text-accent" strokeWidth={1.5} />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{t("customer.total_spent")}</p>
            <p className="text-xl font-bold font-display">{ordersLoading ? "—" : formatPrice(orders.reduce((s, o) => s + o.total, 0))}</p>
          </div>
        </div>
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 border-b border-border mb-8 overflow-x-auto scrollbar-none">
        {tabs.map(({ key, labelKey, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab === key ? "border-accent text-accent" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4" />
            {t(labelKey)}
          </button>
        ))}
      </div>

      {/* ── ORDERS TAB ── */}
      {tab === "orders" && (
        <div className="space-y-3">
          {ordersLoading && (
            <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">{t("customer.loading_orders")}</span>
            </div>
          )}
          {!ordersLoading && ordersError && (
            <div className="flex items-center gap-3 p-4 bg-destructive/10 border border-destructive/20 rounded-sm text-destructive text-sm">
              <AlertCircle className="h-4 w-4 flex-shrink-0" /> {ordersError}
            </div>
          )}
          {!ordersLoading && !ordersError && orders.length === 0 && (
            <div className="text-center py-16 border-2 border-dashed border-border rounded-lg">
              <ShoppingBag className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
              <h3 className="font-display font-bold text-lg mb-2">{t("customer.no_orders_title")}</h3>
              <p className="text-sm text-muted-foreground mb-6">{t("customer.no_orders_desc")}</p>
              <Link to="/products" className="btn-accent text-xs py-2.5 px-6 rounded-sm font-medium inline-flex items-center gap-2">
                <Package className="h-3.5 w-3.5" /> {t("customer.browse_products")}
              </Link>
            </div>
          )}
          {!ordersLoading && !ordersError && orders.map((order) => {
            const isExpanded = expandedOrder === order.id;
            return (
              <div key={order.id} className="dashboard-card hover:border-accent/20 transition-colors">
                <button onClick={() => setExpandedOrder(isExpanded ? null : order.id)} className="w-full flex items-center justify-between text-left">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-medium text-sm">#{order.order_number || order.id.slice(0, 8)}</span>
                        <span className={statusStyles[order.status] || "badge-warning"}>{t(`order.status.${order.status}`) || order.status}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {order.created_at?.split("T")[0]}
                        {order.items_count > 0 && ` · ${order.items_count} ${t("customer.items")}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                    <span className="text-sm font-bold">{formatPrice(order.total)}</span>
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </button>
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-border flex flex-wrap gap-2">
                    {order.tracking_number && (
                      <div className="flex items-center gap-2 text-xs bg-secondary/50 p-2.5 rounded-sm flex-1 min-w-[200px]">
                        <Truck className="h-3.5 w-3.5 text-accent" />
                        <span className="text-muted-foreground">{t("customer.tracking")}:</span>
                        <span className="font-mono">{order.tracking_number}</span>
                      </div>
                    )}
                    <button onClick={() => setSelectedOrder(order)} className="btn-accent text-xs py-2 px-4 rounded-sm font-medium flex items-center gap-1.5">
                      <Eye className="h-3.5 w-3.5" /> {t("customer.view_details")}
                    </button>
                    <button onClick={() => openReceipt(order.id)} className="text-xs py-2 px-4 rounded-sm font-medium flex items-center gap-1.5 border border-border hover:bg-secondary transition-colors">
                      <Download className="h-3.5 w-3.5" /> {t("customer.download_receipt")}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── PAYMENTS / INSTALLMENTS TAB ── */}
      {tab === "payments" && (
        <div className="space-y-6">
          <div>
            <h2 className="font-display font-bold text-lg mb-1">{t("customer.installments_title") || "Payment Schedule"}</h2>
            <p className="text-sm text-muted-foreground">{t("customer.installments_desc") || "View your installment payments and upcoming due dates."}</p>
          </div>
          {installmentsLoading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> <span className="text-sm">{t("admin.loading")}</span>
            </div>
          ) : installments.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-border rounded-lg">
              <CalendarClock className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
              <h3 className="font-display font-bold text-lg mb-2">{t("customer.no_installments_title") || "No Installment Plans"}</h3>
              <p className="text-sm text-muted-foreground">{t("customer.no_installments_desc") || "You don't have any active installment payment plans."}</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Summary cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="dashboard-card flex items-center gap-3">
                  <CalendarClock className="h-5 w-5 text-accent" />
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{t("customer.total_installments") || "Total"}</p>
                    <p className="text-lg font-bold">{installments.length}</p>
                  </div>
                </div>
                <div className="dashboard-card flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-accent" />
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{t("customer.paid_installments") || "Paid"}</p>
                    <p className="text-lg font-bold">{installments.filter(i => i.status === "paid").length}</p>
                  </div>
                </div>
                <div className="dashboard-card flex items-center gap-3">
                  <Clock className="h-5 w-5 text-amber-500" />
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{t("customer.pending_installments") || "Pending"}</p>
                    <p className="text-lg font-bold">{installments.filter(i => i.status === "pending").length}</p>
                  </div>
                </div>
                <div className="dashboard-card flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{t("customer.overdue_installments") || "Overdue"}</p>
                    <p className="text-lg font-bold">{installments.filter(i => i.status === "overdue" || (i.status === "pending" && new Date(i.due_date) < new Date())).length}</p>
                  </div>
                </div>
              </div>

              {/* Upcoming payments */}
              {(() => {
                const upcoming = installments
                  .filter(i => i.status === "pending" || i.status === "overdue")
                  .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
                if (upcoming.length === 0) return null;
                return (
                  <div>
                    <h3 className="font-display font-bold text-sm uppercase tracking-wider text-muted-foreground mb-3">{t("customer.upcoming_payments") || "Upcoming Payments"}</h3>
                    <div className="space-y-2">
                      {upcoming.map(inst => {
                        const isOverdue = new Date(inst.due_date) < new Date();
                        return (
                          <div key={inst.id} className={`dashboard-card flex items-center justify-between ${isOverdue ? "border-destructive/30 bg-destructive/5" : ""}`}>
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isOverdue ? "bg-destructive/10" : "bg-accent/10"}`}>
                                {isOverdue ? <AlertCircle className="h-5 w-5 text-destructive" /> : <CalendarClock className="h-5 w-5 text-accent" />}
                              </div>
                              <div>
                                <p className="text-sm font-bold">
                                  {t("customer.installment_label") || "Installment"} #{inst.installment_number} — {t("customer.order_label") || "Order"} #{inst.order_number}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {t("customer.due_date") || "Due"}: {new Date(inst.due_date).toLocaleDateString()}
                                  {isOverdue && <span className="ml-2 text-destructive font-bold uppercase text-[10px]">{t("customer.overdue") || "OVERDUE"}</span>}
                                </p>
                              </div>
                            </div>
                            <span className="text-sm font-bold">{formatPrice(Number(inst.amount))}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Payment history */}
              <div>
                <h3 className="font-display font-bold text-sm uppercase tracking-wider text-muted-foreground mb-3">{t("customer.payment_history") || "Payment History"}</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">{t("customer.order_label") || "Order"}</th>
                        <th className="text-left py-2 px-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">#</th>
                        <th className="text-left py-2 px-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">{t("customer.due_date") || "Due Date"}</th>
                        <th className="text-right py-2 px-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">{t("customer.amount") || "Amount"}</th>
                        <th className="text-center py-2 px-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">{t("admin.status") || "Status"}</th>
                        <th className="text-left py-2 px-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">{t("customer.paid_on") || "Paid On"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {installments.map(inst => {
                        const isOverdue = inst.status === "pending" && new Date(inst.due_date) < new Date();
                        return (
                          <tr key={inst.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                            <td className="py-3 px-3 font-medium">#{inst.order_number}</td>
                            <td className="py-3 px-3">{inst.installment_number}/{inst.installment_count}</td>
                            <td className="py-3 px-3">{new Date(inst.due_date).toLocaleDateString()}</td>
                            <td className="py-3 px-3 text-right font-bold">{formatPrice(Number(inst.amount))}</td>
                            <td className="py-3 px-3 text-center">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                inst.status === "paid" ? "bg-accent/10 text-accent" :
                                isOverdue ? "bg-destructive/10 text-destructive" :
                                "bg-amber-500/10 text-amber-600"
                              }`}>
                                {isOverdue ? (t("customer.overdue") || "Overdue") : inst.status}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-muted-foreground">{inst.paid_at ? new Date(inst.paid_at).toLocaleDateString() : "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── ADDRESSES TAB ── */}
      {tab === "addresses" && (
        <div className="space-y-6">
          <div>
            <h2 className="font-display font-bold text-lg mb-1">{t("customer.addresses_title")}</h2>
            <p className="text-sm text-muted-foreground">{t("customer.addresses_desc")}</p>
          </div>
          {addressesLoading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> <span className="text-sm">{t("admin.loading")}</span>
            </div>
          ) : addresses.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-border rounded-lg">
              <MapPin className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">{t("customer.no_addresses")}</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {addresses.map((addr, idx) => (
                <div key={idx} className="dashboard-card">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                      <MapPin className="h-5 w-5 text-accent" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm">
                        {addr.type === "shipping" ? t("customer.shipping_address_label") : t("customer.billing_address")}
                      </h3>
                      <span className="text-xs text-accent font-medium uppercase">{addr.type}</span>
                    </div>
                  </div>
                  <div className="space-y-1.5 text-sm text-muted-foreground">
                    {addr.address && <p className="text-foreground font-medium">{addr.address}</p>}
                    {addr.address_2 && <p>{addr.address_2}</p>}
                    <p>{[addr.city, addr.province, addr.postal_code].filter(Boolean).join(", ")}</p>
                    {addr.country && <p>{addr.country}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── CONTACTS TAB ── */}
      {tab === "contacts" && (
        <div className="space-y-6">
          <div>
            <h2 className="font-display font-bold text-lg mb-1">{t("customer.support_title")}</h2>
            <p className="text-sm text-muted-foreground">{t("customer.support_desc")}</p>
          </div>
          <div className="dashboard-card max-w-md">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                <Mail className="h-6 w-6 text-accent" />
              </div>
              <div>
                <h3 className="font-bold text-sm mb-1">{t("customer.support_title")}</h3>
                <p className="text-xs text-muted-foreground">{t("customer.support_desc")}</p>
              </div>
            </div>
            <div className="space-y-2 pt-3 border-t border-border">
              <a href="mailto:info@remquip.ca" className="flex items-center gap-2.5 text-sm hover:text-accent transition-colors p-2 rounded-sm hover:bg-secondary">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" /> info@remquip.ca
              </a>
              <a href="tel:+15143593366" className="flex items-center gap-2.5 text-sm hover:text-accent transition-colors p-2 rounded-sm hover:bg-secondary">
                <Phone className="h-3.5 w-3.5 text-muted-foreground" /> (514) 359-3366
              </a>
              <Link to="/contact" className="flex items-center gap-2.5 text-sm text-accent hover:underline p-2">
                <MessageSquareText className="h-3.5 w-3.5" /> {t("customer.use_contact_page") || "Visit our contact page"}
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ── NOTES TAB ── */}
      {tab === "notes" && (
        <div className="space-y-6">
          <div>
            <h2 className="font-display font-bold text-lg mb-1">{t("customer.notes_title")}</h2>
            <p className="text-sm text-muted-foreground">{t("customer.notes_desc")}</p>
          </div>
          {notesLoading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> <span className="text-sm">{t("admin.loading")}</span>
            </div>
          ) : notes.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-border rounded-lg">
              <MessageSquareText className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">{t("customer.no_notes")}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notes.map((n) => (
                <div key={n.id} className="dashboard-card">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                      <FileText className="h-4 w-4 text-accent" />
                    </div>
                    <span className="text-xs font-medium text-muted-foreground">{new Date(n.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{n.note}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── PROFILE TAB ── */}
      {tab === "profile" && (
        <div className="max-w-xl space-y-6">
          <div>
            <h2 className="font-display font-bold text-lg mb-1">{t("customer.account_info")}</h2>
            <p className="text-sm text-muted-foreground">{t("customer.profile_desc")}</p>
          </div>
          <form onSubmit={handleProfileSave} className="dashboard-card space-y-5">
            <div>
              <label className="block text-sm font-medium mb-1.5">{t("contact.name")}</label>
              <input
                value={profileData.full_name}
                onChange={(e) => setProfileData({ ...profileData, full_name: e.target.value })}
                className="w-full border border-border rounded-sm px-3 py-2.5 text-sm bg-background outline-none focus:ring-2 focus:ring-accent"
                placeholder={t("contact.name")}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">{t("auth.email")}</label>
              <input
                value={user?.email || ""}
                readOnly
                className="w-full border border-border rounded-sm px-3 py-2.5 text-sm bg-secondary/30 text-muted-foreground cursor-not-allowed"
              />
              <p className="text-xs text-muted-foreground mt-1">{t("customer.email_readonly")}</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">{t("checkout.phone")}</label>
              <input
                value={profileData.phone}
                onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                type="tel"
                className="w-full border border-border rounded-sm px-3 py-2.5 text-sm bg-background outline-none focus:ring-2 focus:ring-accent"
                placeholder="+1 (555) 000-0000"
              />
            </div>
            <button
              type="submit"
              disabled={profileSaving}
              className="btn-accent px-6 py-2.5 rounded-sm text-sm font-medium flex items-center gap-2 disabled:opacity-50"
            >
              {profileSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("customer.save_changes")}
            </button>
          </form>
        </div>
      )}

      {/* ── SECURITY TAB ── */}
      {tab === "security" && (
        <div className="max-w-xl space-y-6">
          <div>
            <h2 className="font-display font-bold text-lg mb-1">{t("customer.change_password")}</h2>
            <p className="text-sm text-muted-foreground">{t("customer.security_desc")}</p>
          </div>
          <form onSubmit={handlePasswordSave} className="dashboard-card space-y-5">
            <div>
              <label className="block text-sm font-medium mb-1.5">{t("customer.current_password")}</label>
              <input type="password" required value={passwords.current}
                onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                className="w-full border border-border rounded-sm px-3 py-2.5 text-sm bg-background outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">{t("customer.new_password")}</label>
              <input type="password" required value={passwords.next}
                onChange={(e) => setPasswords({ ...passwords, next: e.target.value })}
                className="w-full border border-border rounded-sm px-3 py-2.5 text-sm bg-background outline-none focus:ring-2 focus:ring-accent"
              />
              <p className="text-xs text-muted-foreground mt-1">{t("validation.password_hint")}</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">{t("auth.confirm_password")}</label>
              <input type="password" required value={passwords.confirm}
                onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                className="w-full border border-border rounded-sm px-3 py-2.5 text-sm bg-background outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <button type="submit" disabled={passwordSaving}
              className="btn-accent px-6 py-2.5 rounded-sm text-sm font-medium flex items-center gap-2 disabled:opacity-50"
            >
              {passwordSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("customer.update_password")}
            </button>
          </form>

          <div className="dashboard-card border-destructive/20">
            <h3 className="font-display font-bold text-sm text-destructive mb-2">{t("customer.danger_zone")}</h3>
            <p className="text-xs text-muted-foreground mb-4">{t("customer.delete_account_desc")}</p>
            <button className="text-xs text-destructive font-medium border border-destructive/30 px-4 py-2 rounded-sm hover:bg-destructive/10 transition-colors">
              {t("customer.delete_account")}
            </button>
          </div>
        </div>
      )}

      {/* ── NEED HELP CARD ── */}
      <div className="mt-8 dashboard-card bg-secondary/30 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
          <Phone className="h-6 w-6 text-accent" />
        </div>
        <div className="flex-1">
          <h3 className="font-display font-bold text-sm">{t("customer.need_help")}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{t("customer.need_help_desc")}</p>
        </div>
        <Link to="/contact" className="btn-accent text-xs py-2 px-5 rounded-sm font-medium flex items-center gap-1.5 shrink-0">
          <Mail className="h-3.5 w-3.5" /> {t("customer.contact_support")}
        </Link>
      </div>

      {/* ── RECEIPT MODAL ── */}
      {receiptOpen && (
        <div className="fixed inset-0 z-[100] bg-foreground/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-3xl bg-card border border-border rounded-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <header className="flex items-center justify-between p-5 border-b border-border">
              <div className="flex items-center gap-3">
                <Box className="h-5 w-5 text-accent" />
                <div>
                  <h3 className="font-display font-bold text-base">{t("customer.order_receipt")}</h3>
                  <p className="text-xs text-muted-foreground">{receipt?.order_number ? `#${receipt.order_number}` : t("admin.loading")}</p>
                </div>
              </div>
              <button onClick={() => setReceiptOpen(false)} className="p-2 hover:bg-secondary rounded-sm transition-colors">
                <X className="h-4 w-4" />
              </button>
            </header>
            <div className="flex-1 overflow-y-auto p-6">
              {receiptLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 text-accent animate-spin" />
                </div>
              ) : receiptError ? (
                <div className="text-center py-12">
                  <AlertCircle className="h-10 w-10 text-destructive mx-auto mb-4" />
                  <p className="text-sm text-muted-foreground mb-4">{receiptError}</p>
                  <button onClick={() => receipt?.id && openReceipt(receipt.id)} className="btn-accent text-xs py-2 px-4 rounded-sm">{t("error.retry")}</button>
                </div>
              ) : receipt ? (
                <div className="space-y-6">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="bg-secondary/30 p-4 rounded-sm">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">{t("customer.order_info")}</p>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between"><span className="text-muted-foreground">{t("admin.date")}</span><span className="font-medium">{receipt.order_date ? new Date(receipt.order_date).toLocaleDateString() : "—"}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">{t("admin.status")}</span><span className="font-medium">{receipt.status}</span></div>
                      </div>
                    </div>
                    <div className="bg-secondary/30 p-4 rounded-sm">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">{t("customer.payment_info")}</p>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between"><span className="text-muted-foreground">{t("admin.orders.payment_status")}</span><span className="font-medium uppercase">{(receipt as any).payment_status ?? "—"}</span></div>
                      </div>
                    </div>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-border">
                        <th className="text-left py-2 text-xs font-bold uppercase text-muted-foreground">{t("customer.product")}</th>
                        <th className="text-right py-2 text-xs font-bold uppercase text-muted-foreground">{t("cart.quantity")}</th>
                        <th className="text-right py-2 text-xs font-bold uppercase text-muted-foreground">{t("customer.unit_price")}</th>
                        <th className="text-right py-2 text-xs font-bold uppercase text-muted-foreground">{t("cart.total")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {(receipt.items ?? []).map((it: any, idx: number) => {
                        const name = it.product_name ?? it.name ?? "Item";
                        const sku = it.product_sku ?? it.sku ?? "";
                        const qty = toNumber(it.quantity);
                        const price = toNumber(it.unit_price ?? it.unitPrice);
                        const lineTotal = toNumber(it.subtotal ?? it.line_total ?? (qty * price));
                        return (
                          <tr key={it.id ?? idx}>
                            <td className="py-3"><div className="font-medium">{name}</div>{sku && <div className="text-xs text-muted-foreground">{sku}</div>}</td>
                            <td className="py-3 text-right font-medium">{qty}</td>
                            <td className="py-3 text-right">{formatPrice(price)}</td>
                            <td className="py-3 text-right font-bold">{formatPrice(lineTotal)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div className="flex justify-end pt-4 border-t border-border">
                    <div className="w-64 space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-muted-foreground">{t("cart.subtotal")}</span><span>{formatPrice(toNumber((receipt as any).subtotal))}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">{t("cart.tax")}</span><span>{formatPrice(toNumber((receipt as any).tax_amount))}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">{t("cart.shipping")}</span><span>{formatPrice(toNumber((receipt as any).shipping_amount))}</span></div>
                      <div className="flex justify-between font-bold text-base pt-2 border-t border-border">
                        <span>{t("cart.total")}</span>
                        <span className="text-accent">{formatPrice(toNumber((receipt as any).total_amount))}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
            <footer className="p-4 border-t border-border flex justify-end gap-3">
              <button onClick={printReceipt} disabled={!receipt} className="btn-accent text-xs py-2 px-4 rounded-sm flex items-center gap-2 disabled:opacity-50">
                <Printer className="h-3.5 w-3.5" /> {t("customer.print_receipt")}
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}

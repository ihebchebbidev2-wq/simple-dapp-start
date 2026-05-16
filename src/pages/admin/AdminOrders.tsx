import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Eye, Search, X, ChevronDown, ChevronUp, Package, Truck, CheckCircle, Clock, Printer, Download, Mail, ArrowLeft, MapPin, CreditCard, FileText, Loader2, AlertCircle, Upload, Trash2 } from "lucide-react";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { useOrders, useOrder, useApiMutation, useOrderDocuments, useUploadOrderDocument, useDeleteOrderDocument, useSendOrderEmail } from "@/hooks/useApi";
import { api, Order, unwrapApiList, unwrapPagination } from "@/lib/api";
import { useDeleteOrder } from "@/hooks/useApi";
import { useQueryClient } from "@tanstack/react-query";
import { RemquipLoadingScreen } from "@/components/RemquipLoadingScreen";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminPageError, AdminPageLoading } from "@/components/admin/AdminPageState";
import { showSuccessToast, showErrorToast } from "@/lib/toast";
import { useConfirm } from "@/components/ConfirmDialog";
import { useLanguage } from "@/contexts/LanguageContext";

const NON_DELETABLE_STATUSES = ["shipped", "delivered"];
import ReportPreviewModal from "@/components/reports/ReportPreviewModal";

const statusStyles: Record<string, string> = {
  pending: "badge-warning",
  confirmed: "badge-info",
  processing: "badge-info",
  shipped: "badge-info",
  delivered: "badge-success",
  completed: "badge-success",
  cancelled: "badge-destructive",
  refunded: "badge-destructive",
};

const statusFlow = ["pending", "confirmed", "processing", "shipped", "delivered"];
const statusIcons: Record<string, React.ElementType> = {
  pending: Clock,
  confirmed: CheckCircle,
  processing: Package,
  shipped: Truck,
  delivered: CheckCircle,
};

const carriers = ["Purolator", "Canada Post", "UPS", "FedEx", "Day & Ross"];

function InstallmentsPanel({ orderId }: { orderId: string }) {
  const [installments, setInstallments] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const queryClient = useQueryClient();

  React.useEffect(() => {
    api.request('GET', `orders/${orderId}/installments`)
      .then((res: any) => {
        const data = res?.data || res || [];
        setInstallments(Array.isArray(data) ? data : []);
      })
      .catch(() => setInstallments([]))
      .finally(() => setLoading(false));
  }, [orderId]);

  const handleMarkPaid = async (instId: string) => {
    try {
      await api.request('PATCH', `orders/${orderId}/installments/${instId}`, { status: 'paid' });
      setInstallments(prev => prev.map(i => i.id === instId ? { ...i, status: 'paid', paid_at: new Date().toISOString() } : i));
      queryClient.invalidateQueries({ queryKey: ['order'] });
    } catch {}
  };

  if (loading) return <div className="text-xs text-muted-foreground">Loading installments...</div>;
  if (!installments.length) return <div className="text-xs text-muted-foreground">No installments found</div>;

  return (
    <div className="space-y-2">
      {installments.map((inst: any) => (
        <div key={inst.id} className={`flex items-center justify-between p-3 rounded-lg border ${inst.status === 'paid' ? 'border-green-200 bg-green-50' : inst.status === 'overdue' ? 'border-red-200 bg-red-50' : 'border-border bg-background'}`}>
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold w-6">#{inst.installment_number}</span>
            <div>
              <span className="text-sm font-medium">C${Number(inst.amount).toFixed(2)}</span>
              <span className="text-xs text-muted-foreground ml-2">Due: {new Date(inst.due_date).toLocaleDateString()}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${inst.status === 'paid' ? 'bg-green-100 text-green-700' : inst.status === 'overdue' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
              {inst.status}
            </span>
            {inst.status !== 'paid' && (
              <button onClick={() => handleMarkPaid(inst.id)} className="text-[10px] font-bold text-accent hover:underline">
                Mark Paid
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AdminOrders() {
  const { orderId } = useParams();
  const navigate = useNavigate();

  // Backend sometimes returns numeric fields as strings.
  // Convert safely so `.toFixed()` never crashes.
  function toNumber(v: unknown): number {
    if (typeof v === "number") return Number.isFinite(v) ? v : 0;
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  function escapeHtml(v: unknown): string {
    return String(v ?? '').replace(/[&<>"']/g, (ch) => {
      switch (ch) {
        case '&':
          return '&amp;';
        case '<':
          return '&lt;';
        case '>':
          return '&gt;';
        case '"':
          return '&quot;';
        case "'":
          return '&#39;';
        default:
          return ch;
      }
    });
  }

  function buildReceiptHtml(order: Order): string {
    const items = (order.items ?? []).map((it: any) => {
      const productName = it.product_name ?? it.name ?? it.productName ?? 'Item';
      const productId = it.product_id ?? it.productId ?? it.sku ?? '';
      const qty = toNumber(it.quantity);
      const unitPrice = toNumber(it.unit_price ?? it.unitPrice);
      const lineSubtotal = toNumber(it.subtotal ?? it.line_total ?? (qty * unitPrice));
      const displayName = escapeHtml(productName);
      const displayId = productId ? `<div style="font-size:12px;color:#6b7280;margin-top:4px;">${escapeHtml(productId)}</div>` : '';
      return {
        displayName,
        displayId,
        qty,
        unitPrice,
        lineSubtotal,
      };
    });

    const subtotal = toNumber((order as any).subtotal ?? (order as any).subtotal_amount);
    const taxAmount = toNumber((order as any).tax_amount ?? (order as any).tax);
    const shippingAmount = toNumber((order as any).shipping_amount ?? (order as any).shipping);
    const discountAmount = toNumber((order as any).discount_amount ?? (order as any).discount);
    const totalAmount = toNumber((order as any).total_amount ?? (order as any).total);
    const notes = (order as any).notes ? escapeHtml((order as any).notes) : '';

    const rowsHtml =
      items.length === 0
        ? `<tr><td colspan="4" style="padding:12px 8px;color:#6b7280;">No items</td></tr>`
        : items
            .map((i) => {
              return `
                <tr>
                  <td style="padding:10px 8px;">
                    <div style="font-weight:600;">${i.displayName}</div>
                    ${i.displayId}
                  </td>
                  <td style="padding:10px 8px;text-align:right;">${i.qty}</td>
                  <td style="padding:10px 8px;text-align:right;">${i.unitPrice.toFixed(2)}</td>
                  <td style="padding:10px 8px;text-align:right;">${i.lineSubtotal.toFixed(2)}</td>
                </tr>
              `;
            })
            .join('');

    return `<!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Order Receipt</title>
          <style>
            body { font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color:#0f172a; padding:24px; }
            .muted { color:#6b7280; }
            h1 { margin:0; font-size:20px; }
            .box { border:1px solid #e5e7eb; border-radius:10px; padding:14px; margin-top:16px; }
            table { width:100%; border-collapse:collapse; margin-top:12px; }
            th { text-align:left; font-size:12px; color:#6b7280; border-bottom:1px solid #e5e7eb; padding:8px; }
            td { border-bottom:1px solid #eef2f7; }
            .totals { margin-top:14px; width:320px; margin-left:auto; }
            .row { display:flex; justify-content:space-between; padding:6px 0; font-size:13px; }
            @media print { body { padding:0.5in; } }
          </style>
        </head>
        <body>
          <h1>Remquip — Order Receipt</h1>
          <div class="muted" style="margin-top:6px;">Order: <strong>${escapeHtml(order.order_number)}</strong></div>
          <div class="muted" style="margin-top:4px;">Date: <strong>${escapeHtml((order as any).order_date ?? '')}</strong></div>
          <div class="muted" style="margin-top:4px;">Status: <strong>${escapeHtml((order as any).status ?? '')}</strong></div>

          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th style="text-align:right;">Qty</th>
                <th style="text-align:right;">Unit</th>
                <th style="text-align:right;">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <div class="totals">
            <div class="row"><span class="muted">Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
            <div class="row"><span class="muted">Tax</span><span>${taxAmount.toFixed(2)}</span></div>
            <div class="row"><span class="muted">Shipping</span><span>${shippingAmount.toFixed(2)}</span></div>
            <div class="row"><span class="muted">Discount</span><span>${discountAmount > 0 ? '-' : ''}${discountAmount.toFixed(2)}</span></div>
            <div class="row" style="font-weight:700;"><span>Total</span><span>${totalAmount.toFixed(2)}</span></div>
          </div>

          ${notes ? `<div class="box"><div style="font-weight:700;">Notes</div><div style="margin-top:6px; white-space:pre-wrap;" class="muted">${notes}</div></div>` : ''}
        </body>
      </html>`;
  }

  function printSelectedReceipt() {
    if (!selectedOrder) return;
    const html = buildReceiptHtml(selectedOrder);
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  }

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(orderId || null);
  const [showReport, setShowReport] = useState(false);

  // Sync state if URL changes (e.g. searching/clicking new result)
  useEffect(() => {
    if (orderId) {
      setSelectedOrderId(orderId);
    }
  }, [orderId]);
  const [newNote, setNewNote] = useState("");
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [showShipment, setShowShipment] = useState<string | null>(null);
  const [shipmentCarrier, setShipmentCarrier] = useState("Purolator");
  const [shipmentTracking, setShipmentTracking] = useState("");
  const [showOrderEmailModal, setShowOrderEmailModal] = useState(false);
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);

  const confirmAction = useConfirm();
  const { t } = useLanguage();
  const sendOrderEmailMutation = useSendOrderEmail();

  const queryClient = useQueryClient();

  // Fetch orders from API
  const { data: ordersResponse, isLoading, isError, error } = useOrders(page, 50);

  // Fetch single order details when selected
  const { data: orderDetailResponse } = useOrder(selectedOrderId || "");

  // Mutations
  const updateOrderStatusMutation = useApiMutation(
    ({ id, status }: { id: string; status: string }) => api.updateOrderStatus(id, status as Order['status']),
    {
      onSuccess: () => {
        showSuccessToast("Orders", "Order status updated");
        queryClient.invalidateQueries({ queryKey: ['orders'] });
        queryClient.invalidateQueries({ queryKey: ['order'] });
      },
      onError: (e: unknown) => {
        showErrorToast("Orders", e instanceof Error ? e.message : "Failed to update status");
      },
    }
  );

  const addOrderNoteMutation = useApiMutation(
    ({ orderId, note }: { orderId: string; note: string }) => api.addOrderNote(orderId, note),
    {
      onSuccess: () => {
        showSuccessToast("Orders", "Note added to order");
        queryClient.invalidateQueries({ queryKey: ['order'] });
        setNewNote("");
      },
      onError: (e: unknown) => {
        showErrorToast("Orders", e instanceof Error ? e.message : "Failed to add note");
      },
    }
  );

  const editItemMutation = useApiMutation(
    ({ orderId, itemId, quantity }: { orderId: string; itemId: string; quantity: number }) =>
      api.updateOrderItem(orderId, itemId, quantity),
    {
      onSuccess: () => {
        showSuccessToast("Orders", "Item quantity updated");
        queryClient.invalidateQueries({ queryKey: ['order'] });
        queryClient.invalidateQueries({ queryKey: ['orders'] });
      },
      onError: (e: unknown) => {
        showErrorToast("Orders", e instanceof Error ? e.message : "Failed to update item");
      },
    }
  );

  const removeItemMutation = useApiMutation(
    ({ orderId, itemId }: { orderId: string; itemId: string }) => api.deleteOrderItem(orderId, itemId),
    {
      onSuccess: () => {
        showSuccessToast("Orders", "Item removed from order");
        queryClient.invalidateQueries({ queryKey: ['order'] });
        queryClient.invalidateQueries({ queryKey: ['orders'] });
      },
      onError: (e: unknown) => {
        showErrorToast("Orders", e instanceof Error ? e.message : "Failed to remove item");
      },
    }
  );

  const orders = unwrapApiList<Order>(ordersResponse as any, []);
  const pagination = unwrapPagination(ordersResponse as any);
  const selectedOrder = orderDetailResponse?.data;

  // Filter orders locally
  const filtered = orders.filter((o: Order) => {
    const matchesSearch = !search || 
      o.order_number?.toLowerCase().includes(search.toLowerCase()) || 
      o.customer_email?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !statusFilter || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Status counts
  const statusCounts = {
    all: orders.length,
    pending: orders.filter((o: Order) => o.status === "pending").length,
    processing: orders.filter((o: Order) => o.status === "processing").length,
    shipped: orders.filter((o: Order) => o.status === "shipped").length,
    delivered: orders.filter((o: Order) => o.status === "delivered").length,
  };

  async function handleStatusChange(orderId: string, newStatus: string) {
    // Find current order status
    const order = orders.find((o: Order) => o.id === orderId) || selectedOrder;
    const currentStatus = order?.status || "";
    if (newStatus === currentStatus) return;

    const currentIdx = statusFlow.indexOf(currentStatus);
    const newIdx = statusFlow.indexOf(newStatus);
    const isBackward = newIdx < currentIdx && currentIdx >= 0 && newIdx >= 0;

    // Confirm for backward transitions or critical status changes
    if (isBackward || newStatus === "shipped" || newStatus === "delivered") {
      const label = isBackward
        ? `Move this order backward from "${currentStatus}" to "${newStatus}"?`
        : `Change order status to "${newStatus}"?`;
      const ok = await confirmAction({
        title: "Change Order Status",
        message: `${label} This may affect stock levels and trigger customer notifications.`,
        confirmLabel: `Yes, set to ${newStatus}`,
        variant: isBackward ? "warning" : "info",
      });
      if (!ok) return;
    }

    updateOrderStatusMutation.mutate({ id: orderId, status: newStatus });
  }

  function toggleSelect(id: string) {
    setSelectedOrders(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedOrders.size === filtered.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(filtered.map((o: Order) => o.id)));
    }
  }

  async function handleBulkStatusChange(status: string) {
    const ids = Array.from(selectedOrders);
    const results = await Promise.allSettled(
      ids.map(id => updateOrderStatusMutation.mutateAsync({ id, status }))
    );
    const failed = results.filter(r => r.status === 'rejected').length;
    if (failed > 0) {
      showErrorToast("Orders", `${failed} of ${ids.length} orders failed to update`);
    }
    setSelectedOrders(new Set());
  }

  function escapeCsvField(value: unknown): string {
    const str = String(value ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  function exportCSV() {
    const rows = filtered.map((o: Order) => 
      [o.order_number, o.customer_email, toNumber(o.total_amount).toFixed(2), o.status, o.order_date]
        .map(escapeCsvField)
        .join(',')
    );
    const csv = `Order,Customer,Total,Status,Date\n${rows.join("\n")}`;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "orders.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  async function handleShipOrder(orderId: string) {
    try {
      // Send carrier + tracking number to backend tracking endpoint
      if (shipmentCarrier && shipmentTracking.trim()) {
        await api.updateOrderTracking(orderId, {
          carrier: shipmentCarrier,
          trackingNumber: shipmentTracking.trim(),
        });
      }
      // Always update status to shipped
      await api.updateOrderStatus(orderId, "shipped");
      showSuccessToast("Orders", shipmentTracking.trim()
        ? `Shipped via ${shipmentCarrier} — ${shipmentTracking}`
        : "Order marked as shipped");
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order'] });
    } catch (e) {
      showErrorToast("Orders", e instanceof Error ? e.message : "Failed to update shipment");
    }
    setShowShipment(null);
    setShipmentTracking("");
  }

  function handleAddNote() {
    if (selectedOrderId && newNote.trim()) {
      addOrderNoteMutation.mutate({ orderId: selectedOrderId, note: newNote });
    }
  }

  async function handleDeleteOrder(orderId: string, orderStatus: string) {
    if (NON_DELETABLE_STATUSES.includes(orderStatus)) {
      showErrorToast("Orders", "Cannot delete an order that has been shipped or delivered");
      return;
    }
    const ok = await confirmAction({
      title: "Delete Order",
      message: "Are you sure you want to delete this order? This action cannot be undone.",
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!ok) return;
    setDeletingOrderId(orderId);
    try {
      await api.deleteOrder(orderId);
      showSuccessToast("Orders", "Order deleted successfully");
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      if (selectedOrderId === orderId) {
        setSelectedOrderId(null);
      }
    } catch (e) {
      showErrorToast("Orders", e instanceof Error ? e.message : "Failed to delete order");
    } finally {
      setDeletingOrderId(null);
    }
  }

  // Loading state
  if (isLoading) {
    return <AdminPageLoading message="Loading orders" />;
  }

  // Error state
  if (isError) {
    return (
      <AdminPageError
        message={error instanceof Error ? error.message : "An error occurred while fetching orders."}
        onRetry={() => queryClient.invalidateQueries({ queryKey: ["orders"] })}
      />
    );
  }

  // ── Order Detail View ──
  if (selectedOrderId && selectedOrder) {
    const currentIdx = statusFlow.indexOf(selectedOrder.status);

    return (
      <>
      <div className="space-y-6">
        <button onClick={() => setSelectedOrderId(null)} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Back to Orders
        </button>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="font-display font-bold text-lg md:text-xl">{selectedOrder.order_number}</h2>
            <p className="text-sm text-muted-foreground">
              Placed on {new Date(((selectedOrder as any).order_date || (selectedOrder as any).created_at || '').replace(' ', 'T')).toLocaleDateString()} · {(selectedOrder as any).payment_method || "Invoice"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowReport(true)}
              className="px-4 py-2 rounded-lg text-sm font-semibold border border-[#48698e] text-[#1f354d] hover:bg-[#e8eef5] transition-colors flex items-center gap-1.5"
            >
              <Printer className="h-3.5 w-3.5" /> Generate Report
            </button>
            <button
              onClick={() => setShowOrderEmailModal(true)}
              className="px-3 py-2 border border-border rounded-sm text-xs font-medium hover:bg-secondary transition-colors flex items-center gap-1.5"
            >
              <Mail className="h-3.5 w-3.5" /> Email Customer
            </button>
            {selectedOrder.status === "processing" && (
              <button onClick={() => setShowShipment(selectedOrder.id)} className="px-3 py-2 btn-accent rounded-sm text-xs font-medium flex items-center gap-1.5">
                <Truck className="h-3.5 w-3.5" /> Ship Order
              </button>
            )}
            {!NON_DELETABLE_STATUSES.includes(selectedOrder.status) && (
              <button
                onClick={() => handleDeleteOrder(selectedOrder.id, selectedOrder.status)}
                disabled={deletingOrderId === selectedOrder.id}
                className="px-3 py-2 rounded-sm text-xs font-medium border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors flex items-center gap-1.5"
              >
                {deletingOrderId === selectedOrder.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Delete
              </button>
            )}
          </div>
        </div>

        {/* Shipment dialog */}
        {showShipment === selectedOrder.id && (
          <div className="dashboard-card border-accent">
            <h3 className="font-display font-bold text-sm uppercase mb-4 flex items-center gap-1.5"><Truck className="h-4 w-4 text-accent" /> Assign Shipping</h3>
            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Carrier</label>
                <select value={shipmentCarrier} onChange={(e) => setShipmentCarrier(e.target.value)} className="w-full px-3 py-2 border border-border rounded-sm text-sm bg-background outline-none">
                  {carriers.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Tracking Number</label>
                <input value={shipmentTracking} onChange={(e) => setShipmentTracking(e.target.value)} placeholder="e.g. 1Z999AA1..." className="w-full px-3 py-2 border border-border rounded-sm text-sm bg-background outline-none focus:ring-2 focus:ring-accent font-mono" />
              </div>
              <div className="flex items-end gap-2">
                <button 
                  onClick={() => handleShipOrder(selectedOrder.id)} 
                  disabled={updateOrderStatusMutation.isPending}
                  className="btn-accent px-4 py-2 rounded-sm text-sm font-medium flex-1 disabled:opacity-50"
                >
                  {updateOrderStatusMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Mark Shipped"}
                </button>
                <button onClick={() => setShowShipment(null)} className="px-3 py-2 border border-border rounded-sm text-sm hover:bg-secondary">Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Status timeline */}
        <div className="dashboard-card">
          <h3 className="font-display font-bold text-sm uppercase mb-4">Order Status</h3>
          <div className="flex items-center gap-1 sm:gap-2 mb-4 overflow-x-auto pb-2">
            {statusFlow.map((s, i) => {
              const Icon = statusIcons[s];
              const isActive = i <= currentIdx;
              const isCurrent = s === selectedOrder.status;
              return (
                <React.Fragment key={s}>
                  {i > 0 && <div className={`h-0.5 flex-1 min-w-4 ${i <= currentIdx ? "bg-accent" : "bg-border"}`} />}
                  <button
                    onClick={() => handleStatusChange(selectedOrder.id, s)}
                    disabled={updateOrderStatusMutation.isPending}
                    className={`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-sm text-xs font-medium whitespace-nowrap transition-colors disabled:opacity-50 ${
                      isCurrent ? "bg-accent text-accent-foreground" : isActive ? "bg-accent/20 text-accent" : "bg-secondary text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline capitalize">{s}</span>
                  </button>
                </React.Fragment>
              );
            })}
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-4 md:gap-6">
          <div className="lg:col-span-2 dashboard-card">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-display font-bold text-sm uppercase">Items</h3>
              {!["shipped", "delivered"].includes(selectedOrder.status) && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-accent/10 text-accent font-medium">
                  Editable — change qty or remove items
                </span>
              )}
            </div>
            {["shipped", "delivered"].includes(selectedOrder.status) && (
              <p className="text-xs text-muted-foreground mb-3">
                Items are locked because the order is {selectedOrder.status}.
              </p>
            )}
            <div className="space-y-3">
              {selectedOrder.items?.map((item: any, i: number) => {
                const itemId = item.id;
                const canEdit = !!itemId && !["shipped", "delivered"].includes(selectedOrder.status);
                return (
                  <div key={itemId || i} className="flex items-center justify-between gap-3 py-2 border-b border-border last:border-0">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{item.name || item.product_name || 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground font-mono truncate">{item.sku || item.product_id || ''}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {canEdit ? (
                        <input
                          type="number"
                          min={1}
                          defaultValue={item.quantity}
                          disabled={editItemMutation.isPending}
                          onBlur={async (e) => {
                            const newQty = parseInt(e.target.value, 10);
                            if (!Number.isFinite(newQty) || newQty < 1 || newQty === toNumber(item.quantity)) {
                              e.target.value = String(item.quantity);
                              return;
                            }
                            editItemMutation.mutate({ orderId: selectedOrder.id, itemId, quantity: newQty });
                          }}
                          className="w-16 px-2 py-1 border border-border rounded-sm text-sm text-center bg-background outline-none focus:ring-2 focus:ring-accent"
                        />
                      ) : (
                        <span className="text-sm font-medium">{item.quantity}</span>
                      )}
                      <span className="text-xs text-muted-foreground">× C${toNumber(item.unit_price).toFixed(2)}</span>
                      <p className="text-sm font-medium w-20 text-right">C${(toNumber(item.quantity) * toNumber(item.unit_price)).toFixed(2)}</p>
                      {canEdit && (
                        <button
                          onClick={async () => {
                            const ok = await confirmAction({
                              title: "Remove item",
                              message: `Remove "${item.name || 'this item'}" from the order? Stock will be restored if it was deducted.`,
                              confirmLabel: "Remove",
                              variant: "danger",
                            });
                            if (!ok) return;
                            removeItemMutation.mutate({ orderId: selectedOrder.id, itemId });
                          }}
                          disabled={removeItemMutation.isPending}
                          title="Remove item"
                          className="p-1.5 rounded-sm border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 pt-4 border-t border-border space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>C${toNumber(selectedOrder.subtotal).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax</span>
                <span>C${toNumber((selectedOrder as any).tax_amount || (selectedOrder as any).tax).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Shipping</span>
                <span>
                  {toNumber((selectedOrder as any).shipping_amount || (selectedOrder as any).shipping) === 0
                    ? "Free"
                    : `C$${toNumber((selectedOrder as any).shipping_amount || (selectedOrder as any).shipping).toFixed(2)}`}
                </span>
              </div>
              {toNumber((selectedOrder as any).discount_amount || (selectedOrder as any).discount) > 0 && (
                <div className="flex justify-between text-success">
                  <span>Discount</span>
                  <span>-C${toNumber((selectedOrder as any).discount_amount || (selectedOrder as any).discount).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base pt-2 border-t border-border">
                <span>Total</span>
                <span>C${toNumber((selectedOrder as any).total_amount || (selectedOrder as any).total).toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="dashboard-card">
              <h3 className="font-display font-bold text-sm uppercase mb-3">Customer</h3>
              {(selectedOrder as any).company_name && (
                <p className="text-sm font-bold mb-1">{(selectedOrder as any).company_name}</p>
              )}
              <p className="text-sm font-medium">{(selectedOrder as any).email || selectedOrder.customer_email}</p>
              {(selectedOrder as any).phone && (
                <p className="text-xs text-muted-foreground mt-1">{(selectedOrder as any).phone}</p>
              )}
            </div>
            <div className="dashboard-card flex flex-col gap-2">
              <h3 className="font-display font-bold text-sm uppercase mb-1 flex items-center gap-1.5">
                <CreditCard className="h-3.5 w-3.5" /> Payment
              </h3>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground w-24">Method:</span>
                <p className="text-sm font-medium uppercase tracking-wider">{selectedOrder.payment_method || "N/A"}</p>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground w-24">Status:</span>
                <span className={statusStyles[selectedOrder.payment_status]}>{selectedOrder.payment_status}</span>
              </div>
              
              {selectedOrder.stripe_payment_intent_id && (
                <div className="flex items-center justify-between mt-2 pt-3 border-t border-border/50">
                  <span className="text-xs text-muted-foreground">Stripe ID:</span>
                  <a href={`https://dashboard.stripe.com/test/payments/${selectedOrder.stripe_payment_intent_id}`}
                     target="_blank" rel="noopener noreferrer" 
                     className="text-[10px] text-accent hover:underline font-mono truncate max-w-[150px]"
                     title={selectedOrder.stripe_payment_intent_id}>
                    {selectedOrder.stripe_payment_intent_id}
                  </a>
                </div>
              )}
              
              {selectedOrder.paid_at && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Paid At:</span>
                  <span className="text-xs font-medium">{new Date(selectedOrder.paid_at).toLocaleString()}</span>
                </div>
              )}

              {/* Mark as Paid button for cash/check/bank/contract orders */}
              {selectedOrder.payment_status !== 'paid' && ['cash', 'check', 'bank', 'contract'].includes(selectedOrder.payment_method || '') && (
                <div className="mt-3 pt-3 border-t border-border/50">
                  <button
                    onClick={async () => {
                      try {
                        await api.request('PATCH', `orders/${selectedOrder.id}/mark-paid`, {});
                        showSuccessToast("Payment", "Order marked as paid");
                        queryClient.invalidateQueries({ queryKey: ['order'] });
                        queryClient.invalidateQueries({ queryKey: ['orders'] });
                      } catch (e: any) {
                        showErrorToast("Payment", e?.message || "Failed to mark as paid");
                      }
                    }}
                    className="w-full btn-accent px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="h-4 w-4" /> Mark as Paid
                  </button>
                </div>
              )}
            </div>
          </div>
            </div>

            {/* Installments Schedule */}
            {(selectedOrder as any).payment_method === 'installments' && (selectedOrder as any).installment_count && (
              <div className="dashboard-card">
                <h3 className="font-display font-bold text-sm uppercase mb-3 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" /> Payment Installments ({(selectedOrder as any).installment_count}x)
                </h3>
                <InstallmentsPanel orderId={selectedOrder.id} />
              </div>
            )}

        {/* Documents Component inserted here */}
        <OrderDocuments order={selectedOrder} />

        {/* Notes */}
        <div className="dashboard-card">
          <h3 className="font-display font-bold text-sm uppercase mb-4 flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" /> Activity & Notes</h3>
          {selectedOrder.notes && (
            <div className="mb-4 p-3 bg-secondary rounded-sm">
              <p className="text-sm">{selectedOrder.notes}</p>
            </div>
          )}
          <div className="flex gap-2">
            <input 
              value={newNote} 
              onChange={(e) => setNewNote(e.target.value)} 
              placeholder="Add a note..." 
              className="flex-1 px-3 py-2 border border-border rounded-sm text-sm bg-background outline-none focus:ring-2 focus:ring-accent" 
            />
            <button 
              onClick={handleAddNote} 
              disabled={addOrderNoteMutation.isPending || !newNote.trim()}
              className="btn-accent px-4 py-2 rounded-sm text-sm font-medium disabled:opacity-50"
            >
              {addOrderNoteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
            </button>
          </div>
        </div>

        {showReport && (
          <ReportPreviewModal
            onClose={() => setShowReport(false)}
            defaultType="invoice"
            source={{
              documentNumber: selectedOrder.order_number,
              issueDate: selectedOrder.order_date,
              customer: {
                name: (selectedOrder as any).customer_name || (selectedOrder.customer_email ? selectedOrder.customer_email.split('@')[0] : 'Customer'),
                email: selectedOrder.customer_email || '',
              },
              items: (selectedOrder.items || []).map((it: any) => ({
                description: it.product_name || it.name || 'Item',
                sku: it.sku || it.product_id,
                qty: Number(it.quantity || 1),
                unitPrice: Number(it.unit_price || 0),
                lineTotal: Number(it.line_total || (it.quantity * it.unit_price) || 0),
              })),
              subtotal: Number((selectedOrder as any).subtotal_amount || (selectedOrder as any).subtotal || 0),
              discount: Number((selectedOrder as any).discount_amount || (selectedOrder as any).discount || 0),
              shipping: Number((selectedOrder as any).shipping_amount || (selectedOrder as any).shipping || 0),
              total: Number((selectedOrder as any).total_amount || (selectedOrder as any).total || 0),
              notes: selectedOrder.notes,
              paymentTerms: (selectedOrder as any).payment_method ? `Via ${(selectedOrder as any).payment_method}` : undefined
            }}
          />
        )}
        {showOrderEmailModal && (
          <OrderEmailModal
            order={selectedOrder}
            isPending={sendOrderEmailMutation.isPending}
            onClose={() => setShowOrderEmailModal(false)}
            onSend={async ({ emailType, subject, message }) => {
              try {
                await sendOrderEmailMutation.mutateAsync({
                  orderId: selectedOrder.id,
                  emailType,
                  subject,
                  message,
                });
                showSuccessToast("Email Sent", `Email sent to ${selectedOrder.customer_email}`);
                setShowOrderEmailModal(false);
              } catch {
                showErrorToast("Error", "Failed to send email — check SMTP settings");
              }
            }}
          />
        )}
      </div>
      </>
    );
  }

  // ── Order List View ──
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Orders"
        subtitle={pagination ? `${pagination.total} total orders` : undefined}
        actions={
          <div className="flex gap-2">
            <button onClick={exportCSV} className="px-3 py-2 border border-border rounded-sm text-xs font-medium hover:bg-secondary transition-colors flex items-center gap-1.5">
              <Download className="h-3.5 w-3.5" /> CSV
            </button>
            <button onClick={() => { import("@/lib/admin-export").then(({ exportPDF }) => { exportPDF("orders", "Orders", ["Order #", "Customer", "Date", "Total", "Status", "Payment"], filtered.map((o: Order) => [o.order_number || "", o.customer_email || "", o.order_date || "", `C$${toNumber(o.total_amount).toFixed(2)}`, o.status, o.payment_status || ""]), { subtitle: `${filtered.length} order(s) — ${new Date().toLocaleDateString()}` }); }); }} className="px-3 py-2 border border-border rounded-sm text-xs font-medium hover:bg-secondary transition-colors flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" /> PDF
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-3 md:grid-cols-5 gap-2 md:gap-4">
        {[
          { key: "", label: "All", count: statusCounts.all },
          { key: "pending", label: "Pending", count: statusCounts.pending },
          { key: "processing", label: "Processing", count: statusCounts.processing },
          { key: "shipped", label: "Shipped", count: statusCounts.shipped },
          { key: "delivered", label: "Delivered", count: statusCounts.delivered },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={`dashboard-card text-center text-xs md:text-sm font-medium transition-colors ${statusFilter === tab.key ? "border-accent text-accent" : "hover:border-muted-foreground"}`}
          >
            <span className="block">{tab.label}</span>
            <span className="block text-lg md:text-xl font-bold font-display mt-0.5">{tab.count}</span>
          </button>
        ))}
      </div>

      {/* Bulk actions */}
      {selectedOrders.size > 0 && (
        <div className="dashboard-card flex flex-wrap items-center gap-3 bg-accent/5 border-accent/30">
          <span className="text-sm font-medium">{selectedOrders.size} selected</span>
          <button 
            onClick={() => handleBulkStatusChange("processing")} 
            disabled={updateOrderStatusMutation.isPending}
            className="px-3 py-1.5 border border-border rounded-sm text-xs font-medium hover:bg-secondary disabled:opacity-50"
          >
            → Processing
          </button>
          <button 
            onClick={() => handleBulkStatusChange("shipped")} 
            disabled={updateOrderStatusMutation.isPending}
            className="px-3 py-1.5 border border-border rounded-sm text-xs font-medium hover:bg-secondary disabled:opacity-50"
          >
            → Shipped
          </button>
          <button 
            onClick={() => handleBulkStatusChange("delivered")} 
            disabled={updateOrderStatusMutation.isPending}
            className="px-3 py-1.5 border border-border rounded-sm text-xs font-medium hover:bg-secondary disabled:opacity-50"
          >
            → Delivered
          </button>
          <button onClick={exportCSV} className="px-3 py-1.5 border border-border rounded-sm text-xs font-medium hover:bg-secondary flex items-center gap-1">
            <Download className="h-3 w-3" /> Export
          </button>
          <button onClick={() => setSelectedOrders(new Set())} className="ml-auto text-xs text-muted-foreground hover:text-foreground">Clear</button>
        </div>
      )}

      {/* Filters */}
      <div className="dashboard-card">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
          <div className="relative flex-1 w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
              placeholder="Search by order # or email..." 
              className="w-full pl-10 pr-4 py-2 border border-border rounded-sm text-sm bg-background outline-none focus:ring-2 focus:ring-accent" 
            />
          </div>
          {search && (
            <button onClick={() => setSearch("")} className="text-xs text-accent hover:underline flex items-center gap-1">
              <X className="h-3 w-3" /> Clear
            </button>
          )}
        </div>

        {/* Orders table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="text-left px-3 py-2 w-8">
                  <input type="checkbox" checked={selectedOrders.size === filtered.length && filtered.length > 0} onChange={toggleSelectAll} className="rounded-sm border-border accent-accent" />
                </th>
                <th className="text-left px-3 py-2">Order</th>
                <th className="text-left px-3 py-2">Customer</th>
                <th className="text-left px-3 py-2">Date</th>
                <th className="text-right px-3 py-2">Total</th>
                <th className="text-left px-3 py-2">Payment</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-right px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((order: Order) => (
                <tr key={order.id} className={`hover:bg-secondary/50 transition-colors ${selectedOrders.has(order.id) ? "bg-accent/5" : ""}`}>
                  <td className="px-3 py-3">
                    <input type="checkbox" checked={selectedOrders.has(order.id)} onChange={() => toggleSelect(order.id)} className="rounded-sm border-border accent-accent" />
                  </td>
                  <td className="px-3 py-3 font-mono text-xs font-medium">{order.order_number}</td>
                  <td className="px-3 py-3">{order.customer_email}</td>
                  <td className="px-3 py-3 text-muted-foreground">{new Date(order.order_date).toLocaleDateString()}</td>
                  <td className="px-3 py-3 text-right font-medium">C${toNumber(order.total_amount).toFixed(2)}</td>
                  <td className="px-3 py-3"><span className={statusStyles[order.payment_status]}>{order.payment_status}</span></td>
                  <td className="px-3 py-3"><span className={statusStyles[order.status]}>{order.status}</span></td>
                  <td className="px-3 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button 
                        onClick={() => setSelectedOrderId(order.id)} 
                        className="p-1.5 hover:bg-secondary rounded-sm transition-colors" 
                        title="View Details"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      {!NON_DELETABLE_STATUSES.includes(order.status) && (
                        <button
                          onClick={() => handleDeleteOrder(order.id, order.status)}
                          disabled={deletingOrderId === order.id}
                          className="p-1.5 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-sm transition-colors"
                          title="Delete order"
                        >
                          {deletingOrderId === order.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile view */}
        <div className="md:hidden space-y-2">
          {filtered.map((order: Order) => (
            <div 
              key={order.id} 
              onClick={() => setSelectedOrderId(order.id)}
              className="border border-border rounded-md p-3 cursor-pointer hover:border-accent transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-sm font-medium">{order.order_number}</span>
                <span className={statusStyles[order.status]}>{order.status}</span>
              </div>
              <p className="text-sm text-muted-foreground">{order.customer_email}</p>
              <div className="flex items-center justify-between mt-2 text-sm">
                <span className="text-muted-foreground">{new Date(order.order_date).toLocaleDateString()}</span>
                <span className="font-medium">C${toNumber(order.total_amount).toFixed(2)}</span>
              </div>
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <AdminEmptyState
            resource="orders"
            title={search || statusFilter ? "No matching orders" : "No orders yet"}
            description={search || statusFilter ? "Try adjusting your search or status filter." : "Orders will appear here once customers start placing them."}
          />
        )}

        {/* Pagination */}
        {pagination && pagination.pages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-4">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 border border-border rounded-lg text-sm hover:bg-secondary disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm text-muted-foreground">Page {page} of {pagination.pages}</span>
            <button
              onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
              disabled={page === pagination.pages}
              className="px-3 py-1.5 border border-border rounded-lg text-sm hover:bg-secondary disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================
// ORDER EMAIL MODAL
// ==========================================

function OrderEmailModal({
  order,
  isPending,
  onClose,
  onSend,
}: {
  order: any;
  isPending: boolean;
  onClose: () => void;
  onSend: (data: { emailType: string; subject: string; message: string }) => void;
}) {
  const [emailType, setEmailType] = useState<"status" | "custom">("status");
  const defaultSubject = `REMQUIP: Order ${order.order_number} — ${order.status}`;
  const [subject, setSubject] = useState(defaultSubject);
  const [message, setMessage] = useState("");

  function handleTypeChange(t: "status" | "custom") {
    setEmailType(t);
    if (t === "status") setSubject(`REMQUIP: Order ${order.order_number} — ${order.status}`);
    else setSubject(`REMQUIP: Regarding Order ${order.order_number}`);
    setMessage("");
  }

  const canSend = subject.trim() && (emailType === "status" || message.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-blue-600" />
            <h2 className="text-base font-semibold text-slate-900">Email Customer</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="p-3 bg-slate-50 rounded-lg text-sm text-slate-600 flex items-start gap-2">
            <Mail className="h-4 w-4 mt-0.5 shrink-0 text-slate-400" />
            <span><span className="font-medium text-slate-800">To:</span> {order.customer_email}</span>
          </div>

          <div className="flex gap-2">
            {(["status", "custom"] as const).map((t) => (
              <button
                key={t}
                onClick={() => handleTypeChange(t)}
                className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-colors ${
                  emailType === t
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-slate-600 border-slate-200 hover:border-blue-300"
                }`}
              >
                {t === "status" ? "Status Update" : "Custom Message"}
              </button>
            ))}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Subject</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {emailType === "status" ? (
            <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
              A status notification email will be sent for order <strong>{order.order_number}</strong> with current status: <strong className="capitalize">{order.status}</strong>.
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Message <span className="text-slate-400 font-normal">(required)</span>
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={6}
                placeholder={`Hi,\n\nRegarding your order ${order.order_number}…`}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 p-5 border-t bg-slate-50 rounded-b-xl">
          <button onClick={onClose} disabled={isPending} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">
            Cancel
          </button>
          <button
            onClick={() => onSend({ emailType, subject, message })}
            disabled={isPending || !canSend}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg flex items-center gap-2 disabled:opacity-50 transition-colors"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            {isPending ? "Sending…" : "Send Email"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// DOCUMENTS COMPONENT (Order Documents)
// ==========================================
function OrderDocuments({ order }: { order: any }) {
  const confirmAction = useConfirm();
  const { t } = useLanguage();
  const { data: docsData, refetch } = useOrderDocuments(order.id);
  const uploadMutation = useUploadOrderDocument();
  const deleteMutation = useDeleteOrderDocument();
  const [isUploading, setIsUploading] = useState(false);

  // The backend might return documents inside order.documents (e.g. from a join) or we fetch them dynamically.
  const documents = docsData?.data || order.documents || [];

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      showErrorToast("File is too large (max 10MB)");
      return;
    }
    setIsUploading(true);
    try {
      await uploadMutation.mutateAsync({ file, orderId: order.id, documentType: "attachment" });
      showSuccessToast("Success", "Document uploaded successfully");
      refetch();
    } catch (err) {
      showErrorToast("Error", "Failed to upload document");
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const handleDelete = async (docId: string) => {
    const ok = await confirmAction({ title: t("confirm.delete_title"), message: t("confirm.delete_document"), variant: "danger" });
    if (!ok) return;
    try {
      await deleteMutation.mutateAsync({ orderId: order.id, documentId: docId });
      showSuccessToast("Success", "Document removed");
      refetch();
    } catch (err) {
      showErrorToast("Error", "Failed to remove document");
    }
  };

  return (
    <div className="dashboard-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-bold text-sm uppercase flex items-center gap-1.5"><FileText className="h-4 w-4" /> Documents & Files</h3>
        <div>
          <label className={`btn-primary px-3 py-1.5 text-xs cursor-pointer flex items-center gap-2 ${isUploading ? "opacity-70 pointer-events-none" : ""}`}>
            <Upload className="w-3.5 h-3.5" /> {isUploading ? "Uploading..." : "Upload File"}
            <input type="file" onChange={handleUpload} className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.jpg,.jpeg,.png" />
          </label>
        </div>
      </div>

      <div className="space-y-3">
        {documents.map((doc: any) => (
          <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg hover:border-emerald-200 hover:bg-emerald-50/30 transition-colors group">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-100 rounded text-slate-500">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-slate-900 hover:text-emerald-700 hover:underline line-clamp-1">
                  {doc.file_name}
                </a>
                <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                  <span>{new Date(doc.created_at).toLocaleString()}</span>
                  <span>•</span>
                  <span>{doc.uploaded_by || 'Admin'}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <a href={doc.file_url} download className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded">
                <Download className="w-4 h-4" />
              </a>
              <button onClick={() => handleDelete(doc.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
        {documents.length === 0 && (
          <div className="text-center py-6 border-2 border-dashed rounded-lg bg-slate-50/50">
            <FileText className="w-6 h-6 text-slate-300 mx-auto mb-2" />
            <p className="text-xs text-slate-500">No documents attached.</p>
          </div>
        )}
      </div>
    </div>
  );
}

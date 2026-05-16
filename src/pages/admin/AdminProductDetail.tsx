import React, { useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft, Edit, Package, ShoppingCart, DollarSign, TrendingUp,
  Eye, BarChart3, Clock, CheckCircle2, XCircle, Loader2, AlertCircle,
  Tag, Layers, ArrowDownToLine, ArrowUpFromLine, RotateCcw, Image as ImageIcon,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api, resolveUploadImageUrl } from "@/lib/api";

/* ── helpers ── */
function toNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
}

function fmtMoney(v: unknown) {
  return `C$${toNum(v).toFixed(2)}`;
}

const STATUS_STYLES: Record<string, string> = {
  pending:    "badge-warning",
  processing: "badge-warning",
  shipped:    "badge-info",
  completed:  "badge-success",
  delivered:  "badge-success",
  cancelled:  "badge-destructive",
};

const INV_TYPE_CFG: Record<string, { label: string; icon: React.ElementType; cls: string }> = {
  purchase:   { label: "Purchase",   icon: ArrowDownToLine, cls: "text-green-600 bg-green-500/10" },
  sale:       { label: "Sale",       icon: ArrowUpFromLine, cls: "text-red-500 bg-red-500/10" },
  adjustment: { label: "Adjustment", icon: RotateCcw,       cls: "text-amber-500 bg-amber-500/10" },
  return:     { label: "Return",     icon: RotateCcw,       cls: "text-purple-500 bg-purple-500/10" },
};

function invCfg(type: string) {
  return INV_TYPE_CFG[type] ?? { label: type, icon: RotateCcw, cls: "text-muted-foreground bg-muted/30" };
}

/* ── component ── */
export default function AdminProductDetail() {
  const { productId } = useParams<{ productId: string }>();
  const [activeTab, setActiveTab] = useState<"overview" | "sales" | "inventory" | "images">("overview");

  const productQ = useQuery({
    queryKey: ["product", productId],
    queryFn: () => api.getProduct(productId!),
    enabled: !!productId,
  });

  const statsQ = useQuery({
    queryKey: ["product-stats", productId],
    queryFn: () => api.getProductStats(productId!),
    enabled: !!productId,
  });

  const historyQ = useQuery({
    queryKey: ["product-history", productId],
    queryFn: () => api.getProductHistory(productId!),
    enabled: !!productId,
  });

  if (productQ.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Loading product…</span>
      </div>
    );
  }

  if (productQ.isError || !productQ.data?.data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3 text-center">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-sm font-medium">Product not found.</p>
        <Link to="/admin/products" className="text-accent text-sm hover:underline flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Products
        </Link>
      </div>
    );
  }

  const p = productQ.data.data as unknown as Record<string, unknown>;
  const stats = statsQ.data?.data;
  const history: Record<string, unknown>[] = Array.isArray(historyQ.data?.data) ? historyQ.data.data as unknown as Record<string, unknown>[] : [];
  const recentOrders: Record<string, unknown>[] = Array.isArray(stats?.recent_orders) ? stats.recent_orders : [];

  const primaryImage = (p.images as { image_url: string; is_primary: number }[] | undefined)
    ?.find((img) => img.is_primary)?.image_url
    ?? (p.images as { image_url: string }[] | undefined)?.[0]?.image_url
    ?? null;

  const thumb = primaryImage ? resolveUploadImageUrl(String(primaryImage)) : null;
  const statusVal = String(p.status ?? (p.is_active ? "active" : "inactive"));

  const tabs = [
    { key: "overview",  label: "Overview",  icon: Package },
    { key: "sales",     label: "Sales",     icon: ShoppingCart },
    { key: "inventory", label: "Inventory", icon: BarChart3 },
    { key: "images",    label: "Images",    icon: ImageIcon },
  ] as const;

  return (
    <div className="space-y-6">
      {/* ── Back ── */}
      <Link
        to="/admin/products"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Products
      </Link>

      {/* ── Hero header ── */}
      <div className="dashboard-card flex flex-col sm:flex-row gap-4 items-start">
        {thumb ? (
          <img
            src={thumb}
            alt=""
            className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl object-cover border border-border shadow-sm flex-shrink-0"
          />
        ) : (
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-secondary border border-border flex items-center justify-center flex-shrink-0">
            <Package className="h-8 w-8 text-muted-foreground" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-start gap-2 mb-1">
            <h1 className="font-display font-black text-xl md:text-2xl leading-tight">{String(p.name ?? "")}</h1>
            <span className={`badge mt-0.5 ${statusVal === "active" ? "badge-success" : statusVal === "draft" ? "badge-warning" : "badge-destructive"}`}>
              {statusVal}
            </span>
          </div>
          <p className="text-xs text-muted-foreground font-mono mb-2">
            {String(p.sku ?? "")} · {String(p.category ?? "Uncategorized")}
          </p>
          {p.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">{String(p.description)}</p>
          )}
        </div>

        <div className="flex gap-2 flex-shrink-0 self-start">
          <Link to={`/admin/products/${productId}`} className="admin-btn--primary text-xs">
            <Edit className="h-3.5 w-3.5" /> Edit
          </Link>
        </div>
      </div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="dashboard-card">
          <div className="flex items-center gap-1.5 mb-1">
            <Tag className="h-3.5 w-3.5 text-accent" />
            <p className="text-xs text-muted-foreground">Retail Price</p>
          </div>
          <p className="text-xl font-bold font-display">{fmtMoney(p.price ?? p.base_price)}</p>
          {(p.wholesale_price || p.cost_price) && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Wholesale: {fmtMoney(p.wholesale_price ?? p.cost_price)}
            </p>
          )}
        </div>

        <div className="dashboard-card">
          <div className="flex items-center gap-1.5 mb-1">
            <Layers className="h-3.5 w-3.5 text-accent" />
            <p className="text-xs text-muted-foreground">Stock</p>
          </div>
          <p className={`text-xl font-bold font-display ${toNum(p.stock ?? p.stock_quantity) < 10 ? "text-destructive" : ""}`}>
            {toNum(p.stock ?? p.stock_quantity)}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">units on hand</p>
        </div>

        <div className="dashboard-card">
          <div className="flex items-center gap-1.5 mb-1">
            <ShoppingCart className="h-3.5 w-3.5 text-accent" />
            <p className="text-xs text-muted-foreground">Orders</p>
          </div>
          {statsQ.isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <>
              <p className="text-xl font-bold font-display">{stats?.total_orders ?? 0}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{stats?.total_units_sold ?? 0} units sold</p>
            </>
          )}
        </div>

        <div className="dashboard-card">
          <div className="flex items-center gap-1.5 mb-1">
            <DollarSign className="h-3.5 w-3.5 text-accent" />
            <p className="text-xs text-muted-foreground">Revenue</p>
          </div>
          {statsQ.isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <>
              <p className="text-xl font-bold font-display">{fmtMoney(stats?.total_revenue)}</p>
              {(stats?.view_count ?? 0) > 0 && (
                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                  <Eye className="h-3 w-3" /> {stats!.view_count} views tracked
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="dashboard-card p-0 overflow-hidden">
        <div className="flex border-b border-border overflow-x-auto">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === key
                  ? "border-accent text-accent"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        <div className="p-4 sm:p-5">
          {/* ── Overview tab ── */}
          {activeTab === "overview" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Product Info</p>
                  <dl className="space-y-2 text-sm">
                    {[
                      ["SKU",       p.sku],
                      ["Category",  p.category ?? "Uncategorized"],
                      ["Status",    statusVal],
                      ["Base Price",fmtMoney(p.price ?? p.base_price)],
                      ["Wholesale", fmtMoney(p.wholesale_price ?? p.cost_price ?? p.price)],
                      ["Stock",     toNum(p.stock ?? p.stock_quantity)],
                      ["Added",     p.created_at ? fmtDate(String(p.created_at)) : "—"],
                    ].map(([k, v]) => (
                      <div key={String(k)} className="flex justify-between gap-4 py-1 border-b border-border/50 last:border-0">
                        <dt className="text-muted-foreground">{String(k)}</dt>
                        <dd className="font-medium text-right">{String(v ?? "—")}</dd>
                      </div>
                    ))}
                  </dl>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Description</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {String(p.description ?? "No description provided.")}
                  </p>

                  {p.details && Object.keys(p.details as Record<string, unknown>).length > 0 && (
                    <>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mt-4 mb-2">Specifications</p>
                      <dl className="space-y-1 text-sm">
                        {Object.entries(p.details as Record<string, unknown>).map(([k, v]) => (
                          <div key={k} className="flex justify-between gap-4 py-1 border-b border-border/50 last:border-0">
                            <dt className="text-muted-foreground capitalize">{k.replace(/_/g, " ")}</dt>
                            <dd className="font-medium text-right">{String(v ?? "—")}</dd>
                          </div>
                        ))}
                      </dl>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Sales tab ── */}
          {activeTab === "sales" && (
            <div className="space-y-4">
              {statsQ.isLoading && (
                <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Loading sales data…</span>
                </div>
              )}

              {statsQ.isError && (
                <div className="flex items-center gap-2 text-destructive text-sm py-4">
                  <AlertCircle className="h-4 w-4" />
                  Failed to load sales data.
                </div>
              )}

              {!statsQ.isLoading && !statsQ.isError && (
                <>
                  {/* Summary row */}
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    {[
                      { label: "Total Orders",  value: stats?.total_orders ?? 0,            icon: ShoppingCart },
                      { label: "Units Sold",    value: stats?.total_units_sold ?? 0,         icon: Package },
                      { label: "Total Revenue", value: fmtMoney(stats?.total_revenue),       icon: TrendingUp },
                    ].map(({ label, value, icon: Icon }) => (
                      <div key={label} className="border border-border rounded-xl p-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Icon className="h-3.5 w-3.5 text-accent" />
                          <p className="text-xs text-muted-foreground">{label}</p>
                        </div>
                        <p className="text-lg font-bold font-display">{value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Recent orders table */}
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Recent Orders</p>
                  {recentOrders.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No orders for this product yet.</p>
                  ) : (
                    <>
                      {/* Mobile */}
                      <div className="md:hidden space-y-2">
                        {recentOrders.map((order) => (
                          <div key={String(order.id)} className="border border-border rounded-xl p-3 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <Link to={`/admin/orders`} className="text-sm font-semibold text-accent hover:underline">
                                #{String(order.order_number ?? order.id)}
                              </Link>
                              <span className={`badge text-[11px] ${STATUS_STYLES[String(order.status)] ?? "badge-secondary"}`}>
                                {String(order.status ?? "")}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">{String(order.customer_name ?? "Unknown")}</p>
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">Qty × Price</span>
                              <span className="font-medium">{toNum(order.quantity)} × {fmtMoney(order.unit_price)}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">Line Total</span>
                              <span className="font-bold">{fmtMoney(order.line_total)}</span>
                            </div>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {fmtDate(String(order.created_at))}
                            </p>
                          </div>
                        ))}
                      </div>

                      {/* Desktop */}
                      <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="table-header">
                              <th className="text-left px-3 py-2">Order #</th>
                              <th className="text-left px-3 py-2">Customer</th>
                              <th className="text-left px-3 py-2">Date</th>
                              <th className="text-right px-3 py-2">Qty</th>
                              <th className="text-right px-3 py-2">Unit Price</th>
                              <th className="text-right px-3 py-2">Line Total</th>
                              <th className="text-left px-3 py-2">Status</th>
                              <th className="text-left px-3 py-2">Payment</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {recentOrders.map((order) => (
                              <tr key={String(order.id)} className="hover:bg-muted/30 transition-colors">
                                <td className="px-3 py-2.5 font-mono text-xs text-accent font-semibold">
                                  #{String(order.order_number ?? order.id)}
                                </td>
                                <td className="px-3 py-2.5">
                                  <p className="font-medium">{String(order.customer_name ?? "Unknown")}</p>
                                  {order.customer_email && (
                                    <p className="text-xs text-muted-foreground">{String(order.customer_email)}</p>
                                  )}
                                </td>
                                <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                                  {order.created_at ? fmtDate(String(order.created_at)) : "—"}
                                </td>
                                <td className="px-3 py-2.5 text-right font-semibold">{toNum(order.quantity)}</td>
                                <td className="px-3 py-2.5 text-right">{fmtMoney(order.unit_price)}</td>
                                <td className="px-3 py-2.5 text-right font-bold">{fmtMoney(order.line_total)}</td>
                                <td className="px-3 py-2.5">
                                  <span className={`badge text-[11px] ${STATUS_STYLES[String(order.status)] ?? "badge-secondary"}`}>
                                    {String(order.status ?? "")}
                                  </span>
                                </td>
                                <td className="px-3 py-2.5">
                                  {String(order.payment_status) === "paid" ? (
                                    <span className="inline-flex items-center gap-1 text-xs text-green-600">
                                      <CheckCircle2 className="h-3.5 w-3.5" /> Paid
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                      <XCircle className="h-3.5 w-3.5" /> {String(order.payment_status ?? "—")}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── Inventory tab ── */}
          {activeTab === "inventory" && (
            <div className="space-y-4">
              {historyQ.isLoading && (
                <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Loading inventory history…</span>
                </div>
              )}

              {historyQ.isError && (
                <div className="flex items-center gap-2 text-destructive text-sm py-4">
                  <AlertCircle className="h-4 w-4" />
                  Failed to load inventory history.
                </div>
              )}

              {!historyQ.isLoading && !historyQ.isError && (
                <>
                  {history.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No inventory movements yet.</p>
                  ) : (
                    <>
                      {/* Mobile */}
                      <div className="md:hidden space-y-2">
                        {history.map((log, i) => {
                          const cfg = invCfg(String(log.type ?? log.change_type ?? "adjustment"));
                          const Icon = cfg.icon;
                          const qty = toNum(log.quantity_change ?? log.quantity ?? 0);
                          return (
                            <div key={String(log.id ?? i)} className="border border-border rounded-xl p-3">
                              <div className="flex items-center gap-2 mb-1.5">
                                <span className={`p-1.5 rounded-lg ${cfg.cls}`}>
                                  <Icon className="h-3.5 w-3.5" />
                                </span>
                                <span className="text-sm font-medium">{cfg.label}</span>
                                <span className={`ml-auto text-sm font-bold ${qty >= 0 ? "text-green-600" : "text-red-500"}`}>
                                  {qty >= 0 ? "+" : ""}{qty}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground">{String(log.notes ?? log.note ?? "—")}</p>
                              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {log.created_at ? fmtDate(String(log.created_at)) : "—"}
                              </p>
                            </div>
                          );
                        })}
                      </div>

                      {/* Desktop */}
                      <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="table-header">
                              <th className="text-left px-3 py-2">Date</th>
                              <th className="text-left px-3 py-2">Type</th>
                              <th className="text-right px-3 py-2">Change</th>
                              <th className="text-right px-3 py-2">Balance</th>
                              <th className="text-left px-3 py-2">Notes</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {history.map((log, i) => {
                              const cfg = invCfg(String(log.type ?? log.change_type ?? "adjustment"));
                              const Icon = cfg.icon;
                              const qty = toNum(log.quantity_change ?? log.quantity ?? 0);
                              return (
                                <tr key={String(log.id ?? i)} className="hover:bg-muted/30 transition-colors">
                                  <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                                    {log.created_at ? fmtDate(String(log.created_at)) : "—"}
                                  </td>
                                  <td className="px-3 py-2.5">
                                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-xs font-medium ${cfg.cls}`}>
                                      <Icon className="h-3 w-3" /> {cfg.label}
                                    </span>
                                  </td>
                                  <td className={`px-3 py-2.5 text-right font-bold ${qty >= 0 ? "text-green-600" : "text-red-500"}`}>
                                    {qty >= 0 ? "+" : ""}{qty}
                                  </td>
                                  <td className="px-3 py-2.5 text-right font-medium">
                                    {log.quantity_after != null ? toNum(log.quantity_after) : "—"}
                                  </td>
                                  <td className="px-3 py-2.5 text-muted-foreground max-w-xs truncate">
                                    {String(log.notes ?? log.note ?? "—")}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── Images tab ── */}
          {activeTab === "images" && (
            <div className="space-y-3">
              {(() => {
                const images = (p.images as { id: string; image_url: string; alt_text?: string; is_primary: number }[] | undefined) ?? [];
                if (images.length === 0) {
                  return (
                    <p className="text-sm text-muted-foreground text-center py-8">No images uploaded for this product.</p>
                  );
                }
                return (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {images.map((img) => (
                      <div
                        key={img.id}
                        className={`relative rounded-xl overflow-hidden border-2 ${img.is_primary ? "border-accent" : "border-border"}`}
                      >
                        <img
                          src={resolveUploadImageUrl(img.image_url)}
                          alt={img.alt_text ?? ""}
                          className="w-full aspect-square object-cover bg-secondary"
                        />
                        {img.is_primary ? (
                          <span className="absolute top-1.5 left-1.5 bg-accent text-accent-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                            Primary
                          </span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                );
              })()}
              <p className="text-xs text-muted-foreground">
                To manage images, use the{" "}
                <Link to={`/admin/products/${productId}`} className="text-accent hover:underline">
                  Edit Product
                </Link>{" "}
                page.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

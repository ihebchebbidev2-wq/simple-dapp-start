import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Package, ShoppingBag, Users, DollarSign, TrendingUp, TrendingDown, AlertTriangle, ArrowRight, Tag, Truck, FileText, Clock, BarChart3 } from "lucide-react";
import { api, Order, unwrapApiList } from "@/lib/api";
import { products } from "@/config/products";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminPageError } from "@/components/admin/AdminPageState";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { DashboardStatsSkeleton, OrderTableSkeleton, ActivityLogSkeleton } from "@/components/skeletons/DashboardSkeleton";
import { useLanguage } from "@/contexts/LanguageContext";

interface DashboardStats {
  totalProducts: number;
  totalOrders: number;
  totalCustomers: number;
  totalRevenue: number;
  // Period-over-period computed from backend
  productsChange?: number;
  ordersChange?: number;
  customersChange?: number;
  revenueChange?: number;
}

interface ActivityLogEntry {
  time: string;
  user: string;
  action: string;
  type: string;
}

const activityIcons: Record<string, React.ElementType> = {
  inventory: Package,
  order: ShoppingBag,
  shipping: Truck,
  customer: Users,
  discount: Tag,
  alert: AlertTriangle,
  cms: FileText,
};

const statusStyles: Record<string, string> = {
  pending: "badge-warning",
  processing: "badge-info",
  shipped: "badge-info",
  completed: "badge-success",
  cancelled: "badge-destructive",
};

export default function AdminOverview() {
  const { t } = useLanguage();
  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: products.length,
    totalOrders: 0,
    totalCustomers: 0,
    totalRevenue: 0,
  });
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [lowStockProducts, setLowStockProducts] = useState<any[]>([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoadError(false);
      try {
        setIsLoading(true);
        try {
          const statsResponse = await api.getDashboardStats();
          if (statsResponse.data) {
            const d = statsResponse.data as any;
            setStats({
              totalProducts: Number(d.totalProducts ?? d.total_products ?? products.length),
              totalOrders: Number(d.totalOrders ?? d.total_orders ?? 0),
              totalCustomers: Number(d.totalCustomers ?? d.total_customers ?? 0),
              totalRevenue: Number(d.totalRevenue ?? d.total_revenue ?? 0),
              productsChange: d.productsChange ?? d.products_change ?? undefined,
              ordersChange: d.ordersChange ?? d.orders_change ?? undefined,
              customersChange: d.customersChange ?? d.customers_change ?? undefined,
              revenueChange: d.revenueChange ?? d.revenue_change ?? undefined,
            });
          }
        } catch { /* Use defaults */ }

        try {
          const ordersResponse = await api.getOrders(1, 5);
          setRecentOrders(unwrapApiList<Order>(ordersResponse as any, []));
        } catch { /* Orders API failed */ }

        try {
          const activityResponse = await api.getDashboardActivityLog();
          const rows = activityResponse.data;
          if (Array.isArray(rows)) {
            setActivityLog(
              rows.map((r: Record<string, unknown>) => ({
                time: r.created_at != null ? new Date(String(r.created_at)).toLocaleString() : "",
                user: r.user_name != null ? String(r.user_name) : r.user_id != null ? String(r.user_id).slice(0, 8) + "…" : "System",
                action: String(r.action ?? r.entity_type ?? "event"),
                type: String(r.entity_type ?? "system"),
              }))
            );
          }
        } catch {
          setActivityLog([]);
        }

        try {
          const lowStockResponse = await api.getLowStockProducts();
          setLowStockProducts(unwrapApiList(lowStockResponse as any, []));
        } catch {
          setLowStockProducts(products.filter((p) => p.stock < 50).slice(0, 5));
        }
      } catch {
        setLoadError(true);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <AdminPageHeader title={t("admin.overview.title")} subtitle={t("admin.overview.subtitle")} hideBreadcrumb />
        <DashboardStatsSkeleton />
        <div className="grid lg:grid-cols-3 gap-4 md:gap-6">
          <div className="lg:col-span-2 dashboard-card">
            <OrderTableSkeleton rows={5} />
          </div>
          <div className="dashboard-card">
            <ActivityLogSkeleton rows={5} />
          </div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-6">
        <AdminPageHeader title={t("admin.overview.title")} subtitle={t("admin.overview.subtitle")} hideBreadcrumb />
        <AdminPageError
          message="Failed to load dashboard data. Please check your connection and try again."
          onRetry={() => {
            setIsLoading(true);
            setLoadError(false);
            window.location.reload();
          }}
        />
      </div>
    );
  }

  /** Format stat change — shows real data if available, otherwise nothing */
  function formatChange(value: number | undefined, label: string) {
    if (value === undefined || value === null) return null;
    const isPositive = value >= 0;
    const Icon = isPositive ? TrendingUp : TrendingDown;
    const color = isPositive ? "text-success" : "text-destructive";
    const prefix = isPositive ? "+" : "";
    const display = typeof value === "number" && Math.abs(value) < 100
      ? `${prefix}${value}`
      : `${prefix}${value}%`;
    return (
      <p className={`text-xs ${color} flex items-center gap-1 mt-2`}>
        <Icon className="h-3 w-3 flex-shrink-0" />
        <span className="truncate">{display} {label}</span>
      </p>
    );
  }

  const statsArray = [
    { label: t("admin.overview.total_products"), value: stats.totalProducts.toString(), icon: Package, change: stats.productsChange, changeLabel: "this month", color: "accent" as const },
    { label: t("admin.overview.total_orders"), value: stats.totalOrders.toString(), icon: ShoppingBag, change: stats.ordersChange, changeLabel: "this week", color: "info" as const },
    { label: t("admin.overview.customers"), value: stats.totalCustomers.toString(), icon: Users, change: stats.customersChange, changeLabel: "this month", color: "success" as const },
    { label: t("admin.overview.revenue"), value: `C$${stats.totalRevenue.toLocaleString()}`, icon: DollarSign, change: stats.revenueChange, changeLabel: "vs last month", color: "accent" as const },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={t("admin.overview.title")}
        subtitle={t("admin.overview.subtitle")}
        hideBreadcrumb
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {statsArray.map((stat) => (
          <div key={stat.label} className={`stat-card stat-card--${stat.color}`}>
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground font-medium">{stat.label}</p>
                <p className="text-2xl md:text-3xl font-bold font-display mt-1.5 tracking-tight">{stat.value}</p>
                {formatChange(stat.change, stat.changeLabel)}
              </div>
              <div className={`stat-icon stat-icon--${stat.color}`}>
                <stat.icon className="h-5 w-5" strokeWidth={1.5} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4 md:gap-6">
        {/* Recent orders */}
        <div className="lg:col-span-2 dashboard-card">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-display font-bold text-sm uppercase tracking-wider flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-accent" />
              {t("admin.overview.recent_orders")}
            </h3>
            <Link to="/admin/orders" className="admin-btn--ghost text-xs px-2 py-1 gap-1">
              {t("admin.overview.view_all")} <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {recentOrders.length === 0 ? (
            <AdminEmptyState
              resource="orders"
              title="No orders yet"
              description="Orders will appear here once customers start placing them."
            />
          ) : (
            <>
              {/* Mobile cards */}
              <div className="md:hidden space-y-2">
                {recentOrders.map((order: any) => (
                  <Link
                    key={order.id}
                    to={`/admin/orders/${order.id}`}
                    className="flex items-center justify-between py-3 border-b border-border last:border-0 hover:bg-muted/20 transition-colors rounded-lg px-2 -mx-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{order.order_number || order.id}</span>
                        <span className={statusStyles[order.status]}>{order.status}</span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{order.customer_email || order.customer}</p>
                    </div>
                    <div className="text-right flex-shrink-0 ml-2">
                      <p className="text-sm font-semibold">C${Number(order.total_amount || order.total || 0).toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">{order.order_date ? new Date(order.order_date).toLocaleDateString() : order.date}</p>
                    </div>
                  </Link>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto -mx-6 px-6">
                <table className="w-full text-sm min-w-[500px]">
                  <thead>
                    <tr className="table-header">
                      <th className="text-left px-3 py-2.5">{t("admin.overview.order")}</th>
                      <th className="text-left px-3 py-2.5">{t("admin.overview.customer")}</th>
                      <th className="text-left px-3 py-2.5">{t("admin.overview.total")}</th>
                      <th className="text-left px-3 py-2.5">{t("admin.overview.status")}</th>
                      <th className="text-left px-3 py-2.5">{t("admin.overview.date")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {recentOrders.map((order: any) => (
                      <tr
                        key={order.id}
                        className="hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => window.location.href = `/admin/orders/${order.id}`}
                      >
                        <td className="px-3 py-3 font-medium text-sm">{order.order_number || order.id}</td>
                        <td className="px-3 py-3 text-sm truncate max-w-[200px]">{order.customer_email || order.customer}</td>
                        <td className="px-3 py-3 font-semibold text-sm">C${Number(order.total_amount || order.total || 0).toFixed(2)}</td>
                        <td className="px-3 py-3"><span className={statusStyles[order.status]}>{order.status}</span></td>
                        <td className="px-3 py-3 text-muted-foreground text-xs">{order.order_date ? new Date(order.order_date).toLocaleDateString() : order.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Low stock */}
        <div className="dashboard-card">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-display font-bold text-sm uppercase tracking-wider flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" /> {t("admin.overview.low_stock")}
            </h3>
            <Link to="/admin/inventory" className="admin-btn--ghost text-xs px-2 py-1">{t("admin.overview.view_all")}</Link>
          </div>
          {lowStockProducts.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center mx-auto mb-3">
                <Package className="h-5 w-5 text-success" />
              </div>
              <p className="text-sm font-medium text-success">{t("admin.overview.all_stocked")}</p>
              <p className="text-xs text-muted-foreground mt-1">All products are well-stocked</p>
            </div>
          ) : (
            <div className="space-y-3">
              {lowStockProducts.slice(0, 6).map((p) => (
                <div key={p.id} className="flex items-center justify-between text-sm">
                  <span className="truncate mr-3 text-xs md:text-sm">{p.name}</span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="admin-progress w-16">
                      <div
                        className="admin-progress-bar"
                        style={{
                          width: `${Math.min(100, ((p.stock_quantity ?? p.stock) / 100) * 100)}%`,
                          background: (p.stock_quantity ?? p.stock) < 20
                            ? 'hsl(var(--destructive))'
                            : (p.stock_quantity ?? p.stock) < 50
                              ? 'hsl(var(--warning))'
                              : 'hsl(var(--accent))',
                        }}
                      />
                    </div>
                    <span className={`font-semibold text-xs tabular-nums ${(p.stock_quantity ?? p.stock) < 20 ? "text-destructive" : (p.stock_quantity ?? p.stock) < 50 ? "text-warning" : ""}`}>
                      {p.stock_quantity ?? p.stock}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Activity Log */}
      <div className="dashboard-card">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display font-bold text-sm uppercase tracking-wider flex items-center gap-2">
              <Clock className="h-4 w-4 text-accent" /> {t("admin.overview.recent_activity")}
          </h3>
        </div>
        {activityLog.length === 0 ? (
          <AdminEmptyState
            resource="activity"
            title="No recent activity"
            description="Activity will appear here as users interact with the system."
          />
        ) : (
          <div className="admin-timeline">
            {activityLog.map((entry, i) => {
              const Icon = activityIcons[entry.type] || FileText;
              return (
                <div key={i} className="admin-timeline-item">
                  <div className="admin-timeline-dot admin-timeline-dot--accent">
                    <Icon className="h-2.5 w-2.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{entry.action}</p>
                    <p className="text-xs text-muted-foreground">{entry.user} · {entry.time}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: t("admin.overview.add_product"), to: "/admin/products/new", icon: Package },
          { label: t("admin.overview.view_orders"), to: "/admin/orders", icon: ShoppingBag },
          { label: t("admin.nav.discounts"), to: "/admin/discounts", icon: Tag },
          { label: t("admin.nav.analytics"), to: "/admin/analytics", icon: BarChart3 },
        ].map((action) => (
          <Link
            key={action.to}
            to={action.to}
            className="dashboard-card group flex items-center gap-3 hover:border-accent/40 transition-all"
          >
            <div className="stat-icon stat-icon--accent group-hover:scale-105 transition-transform">
              <action.icon className="h-4.5 w-4.5" />
            </div>
            <span className="text-sm font-medium">{action.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

import React, { useState, useMemo } from "react";
import {
  AlertTriangle, AlertCircle, Search, Loader2,
  ArrowLeft, X
} from "lucide-react";
import { useProducts, useLowStockProducts, useInventoryLogs, useAdjustInventory, useOrders } from "@/hooks/useApi";
import { Product, InventoryLog, unwrapApiList, unwrapPagination } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminPageError, AdminPageLoading } from "@/components/admin/AdminPageState";
import { useDebouncedSearch } from "@/hooks/useDebouncedSearch";
import { showSuccessToast, showErrorToast } from "@/lib/toast";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type DetailView = 'low-stock' | 'out-of-stock' | 'sales-by-product' | 'open-orders'
  | 'valuation' | 'all-inventory' | 'recent-adjustments' | null;

export default function AdminInventory() {
  const [detailView, setDetailView] = useState<DetailView>(null);
  const [adjustingProduct, setAdjustingProduct] = useState<string | null>(null);
  const [adjustQuantity, setAdjustQuantity] = useState(0);
  const [adjustReason, setAdjustReason] = useState("");
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // All hooks called unconditionally at top level
  const { data: productsResponse, isLoading, isError, error } = useProducts(1, 200);
  const { data: lowStockResponse } = useLowStockProducts();
  const { data: logsResponse } = useInventoryLogs(1, 50);
  const { data: ordersResponse } = useOrders(1, 100);
  const adjustInventoryMutation = useAdjustInventory();

  const products: Product[] = unwrapApiList<Product>(productsResponse, []);
  const lowStockProducts: Product[] = unwrapApiList<Product>(lowStockResponse as any, []);
  const inventoryLogs: InventoryLog[] = unwrapApiList<InventoryLog>(logsResponse as any, []);

  const allOrders: any[] = unwrapApiList<any>(ordersResponse as any, []);
  const openOrders = useMemo(() =>
    allOrders.filter((o: any) =>
      ['pending', 'processing', 'confirmed'].includes(o.status?.toLowerCase?.() || '')
    ), [allOrders]);
  const openOrdersTotal = useMemo(() =>
    openOrders.reduce((sum: number, o: any) => sum + (parseFloat(o.total) || 0), 0),
    [openOrders]);

  const lowStockList = useMemo(() =>
    lowStockProducts.length > 0
      ? lowStockProducts
      : products.filter((p) => p.stock_quantity > 0 && p.stock_quantity <= 50),
    [lowStockProducts, products]);
  const outOfStockList = useMemo(() =>
    products.filter((p) => p.stock_quantity === 0),
    [products]);

  // Sales aggregation from orders (actual sales data) + inventory logs fallback
  const salesByProductData = useMemo(() => {
    // Try to build from orders that have items
    const salesMap: Record<string, { name: string; sku: string; qtySold: number; sales: number }> = {};

    // From orders items
    allOrders.forEach((order: any) => {
      const items = order.items || order.order_items || [];
      if (Array.isArray(items)) {
        items.forEach((item: any) => {
          const key = item.product_id || item.id;
          if (!key) return;
          if (!salesMap[key]) {
            salesMap[key] = {
              name: item.product_name || item.name || key,
              sku: item.sku || '',
              qtySold: 0,
              sales: 0,
            };
          }
          salesMap[key].qtySold += parseInt(item.quantity) || 0;
          salesMap[key].sales += (parseFloat(item.price) || 0) * (parseInt(item.quantity) || 0);
        });
      }
    });

    // Fallback: from inventory logs (negative changes = sales)
    if (Object.keys(salesMap).length === 0) {
      inventoryLogs
        .filter((l) => (l.quantity_change || 0) < 0)
        .forEach((log) => {
          const key = log.product_id || log.id;
          if (!salesMap[key]) {
            salesMap[key] = { name: log.product_name || key, sku: '', qtySold: 0, sales: 0 };
          }
          salesMap[key].qtySold += Math.abs(log.quantity_change || 0);
        });
    }

    return Object.values(salesMap).sort((a, b) => b.qtySold - a.qtySold);
  }, [allOrders, inventoryLogs]);

  const topProducts = salesByProductData.slice(0, 5);

  // Inventory valuation
  const valuationData = useMemo(() => {
    return products.map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      quantity: p.stock_quantity,
      unitCost: parseFloat(String(p.price)) || 0,
      totalValue: p.stock_quantity * (parseFloat(String(p.price)) || 0),
    })).sort((a, b) => b.totalValue - a.totalValue);
  }, [products]);

  const totalValuation = useMemo(() =>
    valuationData.reduce((sum, v) => sum + v.totalValue, 0),
    [valuationData]);

  const handleAdjustInventory = (productId: string) => {
    if (!adjustQuantity || !adjustReason) {
      showErrorToast("Inventory", "Please enter quantity and reason");
      return;
    }
    adjustInventoryMutation.mutate(
      { productId, quantity: adjustQuantity, reason: adjustReason },
      {
        onSuccess: () => {
          showSuccessToast("Inventory", "Stock adjusted successfully");
          queryClient.invalidateQueries({ queryKey: ['products'] });
          queryClient.invalidateQueries({ queryKey: ['inventory'] });
          setAdjustingProduct(null);
          setAdjustQuantity(0);
          setAdjustReason("");
        },
        onError: (e: unknown) => {
          showErrorToast("Inventory", e instanceof Error ? e.message : "Adjustment failed");
        },
      }
    );
  };

  const closeDetail = () => {
    setDetailView(null);
    setAdjustingProduct(null);
    setAdjustQuantity(0);
    setAdjustReason("");
  };

  if (isLoading) return <AdminPageLoading message="Loading inventory" />;
  if (isError) {
    return (
      <AdminPageError
        message={error instanceof Error ? error.message : "Failed to load inventory"}
        onRetry={() => queryClient.invalidateQueries({ queryKey: ["products"] })}
      />
    );
  }

  // ─── Detail Views ───
  if (detailView) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={closeDetail}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Overview
          </Button>
        </div>

        {detailView === 'low-stock' && (
          <LowStockDetail
            products={lowStockList}
            onAdjust={(id) => { setAdjustingProduct(id); }}
            adjustingProduct={adjustingProduct}
            adjustQuantity={adjustQuantity}
            setAdjustQuantity={setAdjustQuantity}
            adjustReason={adjustReason}
            setAdjustReason={setAdjustReason}
            handleAdjust={handleAdjustInventory}
            isPending={adjustInventoryMutation.isPending}
            onCancelAdjust={() => { setAdjustingProduct(null); setAdjustQuantity(0); setAdjustReason(""); }}
          />
        )}

        {detailView === 'out-of-stock' && (
          <OutOfStockDetail
            products={outOfStockList}
            onAdjust={(id) => { setAdjustingProduct(id); }}
            adjustingProduct={adjustingProduct}
            adjustQuantity={adjustQuantity}
            setAdjustQuantity={setAdjustQuantity}
            adjustReason={adjustReason}
            setAdjustReason={setAdjustReason}
            handleAdjust={handleAdjustInventory}
            isPending={adjustInventoryMutation.isPending}
            onCancelAdjust={() => { setAdjustingProduct(null); setAdjustQuantity(0); setAdjustReason(""); }}
          />
        )}

        {detailView === 'sales-by-product' && (
          <SalesByProductDetail data={salesByProductData} />
        )}

        {detailView === 'open-orders' && (
          <OpenOrdersDetail orders={openOrders} navigate={navigate} />
        )}

        {detailView === 'valuation' && (
          <ValuationDetail data={valuationData} total={totalValuation} />
        )}

        {detailView === 'all-inventory' && (
          <AllInventoryDetail
            products={products}
            adjustingProduct={adjustingProduct}
            onAdjust={(id) => { setAdjustingProduct(id); }}
            adjustQuantity={adjustQuantity}
            setAdjustQuantity={setAdjustQuantity}
            adjustReason={adjustReason}
            setAdjustReason={setAdjustReason}
            handleAdjust={handleAdjustInventory}
            isPending={adjustInventoryMutation.isPending}
            onCancelAdjust={() => { setAdjustingProduct(null); setAdjustQuantity(0); setAdjustReason(""); }}
          />
        )}

        {detailView === 'recent-adjustments' && (
          <RecentAdjustmentsDetail logs={inventoryLogs} />
        )}
      </div>
    );
  }

  // ─── Overview Dashboard ───
  return (
    <div className="space-y-6">
      <AdminPageHeader title="Inventory overview" />

      {/* Create Actions Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-semibold text-foreground">Create actions</span>
        <Button variant="outline" size="sm" onClick={() => navigate('/admin/products/new')}>
          Add product or service
        </Button>
        <Button variant="outline" size="sm" onClick={() => navigate('/admin/orders')}>
          Create sales order
        </Button>
        <Button variant="outline" size="sm" onClick={() => setDetailView('all-inventory')}>
          Adjust inventory
        </Button>
      </div>

      {/* Inventory at a glance */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3">Inventory at a glance</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">

          {/* LOW ON STOCK */}
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setDetailView('low-stock')}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Low on Stock</CardTitle>
                <span className="text-xs text-muted-foreground">As of today</span>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold mb-1">{lowStockList.length}</p>
              <div className="flex items-center gap-1.5 mb-3">
                <AlertCircle className="h-3.5 w-3.5 text-warning" />
                <span className="text-xs text-muted-foreground">Low on stock</span>
              </div>
              {lowStockList.length > 0 && (
                <div className="border-t border-border pt-2">
                  <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 text-xs font-semibold uppercase text-muted-foreground mb-1.5 px-1">
                    <span>Product</span>
                    <span>Qty</span>
                    <span>Action</span>
                  </div>
                  {lowStockList.slice(0, 3).map((p) => (
                    <div key={p.id} className="grid grid-cols-[1fr_auto_auto] gap-x-3 items-center py-1.5 px-1 text-xs border-b border-border last:border-0">
                      <span className="truncate" title={p.name}>{p.name}</span>
                      <span className="font-medium tabular-nums">{p.stock_quantity}</span>
                      <span className="text-primary font-medium">Reorder</span>
                    </div>
                  ))}
                </div>
              )}
              <button className="text-xs text-primary hover:underline mt-2">
                View all low on stock
              </button>
            </CardContent>
          </Card>

          {/* OUT OF STOCK */}
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setDetailView('out-of-stock')}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Out of Stock</CardTitle>
                <span className="text-xs text-muted-foreground">As of today</span>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold mb-1">{outOfStockList.length}</p>
              <div className="flex items-center gap-1.5 mb-3">
                <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                <span className="text-xs text-muted-foreground">Out of stock</span>
              </div>
              {outOfStockList.length > 0 ? (
                <div className="border-t border-border pt-2">
                  <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 text-xs font-semibold uppercase text-muted-foreground mb-1.5 px-1">
                    <span>Product</span>
                    <span>Qty</span>
                    <span>Action</span>
                  </div>
                  {outOfStockList.slice(0, 3).map((p) => (
                    <div key={p.id} className="grid grid-cols-[1fr_auto_auto] gap-x-3 items-center py-1.5 px-1 text-xs border-b border-border last:border-0">
                      <span className="truncate" title={p.name}>{p.name}</span>
                      <span className="font-medium tabular-nums">0</span>
                      <span className="text-primary font-medium">Reorder</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">All products in stock ✓</p>
              )}
              <button className="text-xs text-primary hover:underline mt-2">
                View all out of stock
              </button>
            </CardContent>
          </Card>

          {/* SALES BY PRODUCT */}
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setDetailView('sales-by-product')}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sales by Product</CardTitle>
                <span className="text-xs text-muted-foreground">All time</span>
              </div>
            </CardHeader>
            <CardContent>
              {topProducts.length > 0 ? (
                <div>
                  <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 text-xs font-semibold uppercase text-muted-foreground mb-1.5 px-1">
                    <span>Product Name</span>
                    <span>Qty Sold</span>
                    <span>Sales</span>
                  </div>
                  {topProducts.map((tp, i) => (
                    <div key={i} className="grid grid-cols-[1fr_auto_auto] gap-x-3 items-center py-1.5 px-1 text-xs border-b border-border last:border-0">
                      <span className="truncate">{tp.name}</span>
                      <span className="font-medium tabular-nums">{tp.qtySold}</span>
                      <span className="font-medium tabular-nums">${tp.sales.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-4">No sales data yet</p>
              )}
              <button className="text-xs text-primary hover:underline mt-2">
                View sales by products report
              </button>
            </CardContent>
          </Card>

          {/* OPEN SALES ORDERS */}
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setDetailView('open-orders')}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Open Sales Orders</CardTitle>
                <span className="text-xs text-muted-foreground">As of today</span>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold mb-0.5">${openOrdersTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              <p className="text-xs text-muted-foreground mb-3">{openOrders.length} open sales orders</p>
              {openOrders.length > 0 && (
                <div className="border-t border-border pt-2">
                  <div className="grid grid-cols-[auto_1fr_auto] gap-x-3 text-xs font-semibold uppercase text-muted-foreground mb-1.5 px-1">
                    <span>SO No.</span>
                    <span>Customer</span>
                    <span>Amount</span>
                  </div>
                  {openOrders.slice(0, 3).map((o: any) => (
                    <div key={o.id} className="grid grid-cols-[auto_1fr_auto] gap-x-3 items-center py-1.5 px-1 text-xs border-b border-border last:border-0">
                      <span className="text-primary font-medium">{o.order_number || o.id?.slice(0, 8)}</span>
                      <span className="truncate">{o.customer_name || o.billing_name || 'Guest'}</span>
                      <span className="font-medium tabular-nums">${parseFloat(o.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  ))}
                </div>
              )}
              <button className="text-xs text-primary hover:underline mt-2">
                View all sales orders
              </button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Second row: Inventory Reports + Recent Activity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Inventory Reports</CardTitle>
          </CardHeader>
          <CardContent className="space-y-0">
            {[
              { label: 'Inventory valuation summary', view: 'valuation' as DetailView },
              { label: 'Low stock products', view: 'low-stock' as DetailView },
              { label: 'Products and services list', view: null, href: '/admin/products' },
              { label: 'Recent inventory adjustments', view: 'recent-adjustments' as DetailView },
              { label: 'Sales by products - Summary', view: 'sales-by-product' as DetailView },
            ].map((report) => (
              <div key={report.label} className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
                <span className="text-sm">{report.label}</span>
                <button
                  onClick={() => report.href ? navigate(report.href) : setDetailView(report.view)}
                  className="text-sm text-primary hover:underline font-medium"
                >
                  View
                </button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {inventoryLogs.length > 0 ? (
              <div className="space-y-0">
                {inventoryLogs.slice(0, 5).map((log) => (
                  <div key={log.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{log.product_name || log.product_id}</p>
                      <p className="text-xs text-muted-foreground">{log.notes || log.transaction_type}</p>
                    </div>
                    <div className="text-right flex-shrink-0 ml-4">
                      <p className={`text-sm font-medium ${(log.quantity_change || 0) > 0 ? "text-accent-foreground" : "text-destructive"}`}>
                        {(log.quantity_change || 0) > 0 ? "+" : ""}{log.quantity_change}
                      </p>
                      <p className="text-xs text-muted-foreground">{new Date(log.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))}
                <button onClick={() => setDetailView('recent-adjustments')} className="text-xs text-primary hover:underline mt-2">
                  View all activity
                </button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4">No recent activity</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   DETAIL VIEW COMPONENTS
   ═══════════════════════════════════════════════════════════ */

interface AdjustProps {
  adjustingProduct: string | null;
  onAdjust: (id: string) => void;
  adjustQuantity: number;
  setAdjustQuantity: (v: number) => void;
  adjustReason: string;
  setAdjustReason: (v: string) => void;
  handleAdjust: (id: string) => void;
  isPending: boolean;
  onCancelAdjust: () => void;
}

function AdjustInlineRow({ productId, ...props }: AdjustProps & { productId: string }) {
  if (props.adjustingProduct !== productId) {
    return (
      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => props.onAdjust(productId)}>
        Adjust
      </Button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <Input
        type="number"
        value={props.adjustQuantity}
        onChange={(e) => props.setAdjustQuantity(parseInt(e.target.value) || 0)}
        className="w-16 text-center text-xs h-7"
        placeholder="+/-"
      />
      <Input
        type="text"
        value={props.adjustReason}
        onChange={(e) => props.setAdjustReason(e.target.value)}
        placeholder="Reason"
        className="w-32 text-xs h-7"
      />
      <Button size="sm" className="h-7 text-xs" onClick={() => props.handleAdjust(productId)} disabled={props.isPending}>
        {props.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
      </Button>
      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={props.onCancelAdjust}>
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}

/* ─── Low Stock Detail ─── */
function LowStockDetail({ products, ...adjustProps }: { products: Product[] } & AdjustProps) {
  const { inputValue: search, debouncedValue: debouncedSearch, setInputValue: setSearch } = useDebouncedSearch({ delay: 300 });
  const filtered = products.filter((p) => {
    const s = debouncedSearch.toLowerCase();
    return !s || p.name.toLowerCase().includes(s) || p.sku.toLowerCase().includes(s);
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-warning" />
          Low on Stock — {products.length} products
        </CardTitle>
        <div className="relative max-w-sm mt-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="pl-10" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">Product</th>
                <th className="text-left px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">SKU</th>
                <th className="text-left px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">Category</th>
                <th className="text-right px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">Current Qty</th>
                <th className="text-left px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">Status</th>
                <th className="text-right px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-secondary/50 transition-colors">
                  <td className="px-3 py-2.5 font-medium">{p.name}</td>
                  <td className="px-3 py-2.5 text-muted-foreground font-mono text-xs">{p.sku}</td>
                  <td className="px-3 py-2.5 text-muted-foreground text-xs">{p.category || 'Uncategorized'}</td>
                  <td className="px-3 py-2.5 text-right font-medium tabular-nums text-warning">{p.stock_quantity}</td>
                  <td className="px-3 py-2.5"><Badge variant="secondary">Low</Badge></td>
                  <td className="px-3 py-2.5 text-right">
                    <AdjustInlineRow productId={p.id} {...adjustProps} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No low stock products found</p>}
      </CardContent>
    </Card>
  );
}

/* ─── Out of Stock Detail ─── */
function OutOfStockDetail({ products, ...adjustProps }: { products: Product[] } & AdjustProps) {
  const { inputValue: search, debouncedValue: debouncedSearch, setInputValue: setSearch } = useDebouncedSearch({ delay: 300 });
  const filtered = products.filter((p) => {
    const s = debouncedSearch.toLowerCase();
    return !s || p.name.toLowerCase().includes(s) || p.sku.toLowerCase().includes(s);
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          Out of Stock — {products.length} products
        </CardTitle>
        <div className="relative max-w-sm mt-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="pl-10" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">Product</th>
                <th className="text-left px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">SKU</th>
                <th className="text-left px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">Category</th>
                <th className="text-right px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">Qty</th>
                <th className="text-left px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">Status</th>
                <th className="text-right px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-secondary/50 transition-colors">
                  <td className="px-3 py-2.5 font-medium">{p.name}</td>
                  <td className="px-3 py-2.5 text-muted-foreground font-mono text-xs">{p.sku}</td>
                  <td className="px-3 py-2.5 text-muted-foreground text-xs">{p.category || 'Uncategorized'}</td>
                  <td className="px-3 py-2.5 text-right font-medium tabular-nums text-destructive">0</td>
                  <td className="px-3 py-2.5"><Badge variant="destructive">Out of Stock</Badge></td>
                  <td className="px-3 py-2.5 text-right">
                    <AdjustInlineRow productId={p.id} {...adjustProps} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No out-of-stock products</p>}
      </CardContent>
    </Card>
  );
}

/* ─── Sales by Product Detail ─── */
function SalesByProductDetail({ data }: { data: { name: string; sku: string; qtySold: number; sales: number }[] }) {
  const { inputValue: search, debouncedValue: debouncedSearch, setInputValue: setSearch } = useDebouncedSearch({ delay: 300 });
  const filtered = data.filter((d) => {
    const s = debouncedSearch.toLowerCase();
    return !s || d.name.toLowerCase().includes(s) || d.sku.toLowerCase().includes(s);
  });
  const totalQty = filtered.reduce((s, d) => s + d.qtySold, 0);
  const totalSales = filtered.reduce((s, d) => s + d.sales, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Sales by Product Report</CardTitle>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mt-2">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products..." className="pl-10" />
          </div>
          <div className="text-sm text-muted-foreground">
            {filtered.length} products • {totalQty} units sold • ${totalSales.toLocaleString(undefined, { minimumFractionDigits: 2 })} total
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">#</th>
                <th className="text-left px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">Product Name</th>
                <th className="text-left px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">SKU</th>
                <th className="text-right px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">Qty Sold</th>
                <th className="text-right px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">Sales ($)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((d, i) => (
                <tr key={i} className="hover:bg-secondary/50 transition-colors">
                  <td className="px-3 py-2.5 text-muted-foreground">{i + 1}</td>
                  <td className="px-3 py-2.5 font-medium">{d.name}</td>
                  <td className="px-3 py-2.5 text-muted-foreground font-mono text-xs">{d.sku || '—'}</td>
                  <td className="px-3 py-2.5 text-right font-medium tabular-nums">{d.qtySold}</td>
                  <td className="px-3 py-2.5 text-right font-medium tabular-nums">${d.sales.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-border font-semibold">
                  <td className="px-3 py-2.5" colSpan={3}>Total</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{totalQty}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">${totalSales.toFixed(2)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        {filtered.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No sales data available</p>}
      </CardContent>
    </Card>
  );
}

/* ─── Open Orders Detail ─── */
function OpenOrdersDetail({ orders, navigate }: { orders: any[]; navigate: (path: string) => void }) {
  const totalAmount = orders.reduce((s: number, o: any) => s + (parseFloat(o.total) || 0), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">
          Open Sales Orders — {orders.length} orders • ${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">Order #</th>
                <th className="text-left px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">Customer</th>
                <th className="text-left px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">Status</th>
                <th className="text-left px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">Date</th>
                <th className="text-right px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {orders.map((o: any) => (
                <tr key={o.id} className="hover:bg-secondary/50 transition-colors cursor-pointer" onClick={() => navigate('/admin/orders')}>
                  <td className="px-3 py-2.5 text-primary font-medium">{o.order_number || o.id?.slice(0, 8)}</td>
                  <td className="px-3 py-2.5">{o.customer_name || o.billing_name || 'Guest'}</td>
                  <td className="px-3 py-2.5">
                    <Badge variant={o.status === 'pending' ? 'secondary' : 'default'}>
                      {o.status || 'Unknown'}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground text-xs">{o.created_at ? new Date(o.created_at).toLocaleDateString() : '—'}</td>
                  <td className="px-3 py-2.5 text-right font-medium tabular-nums">${parseFloat(o.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {orders.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No open orders</p>}
      </CardContent>
    </Card>
  );
}

/* ─── Inventory Valuation Detail ─── */
function ValuationDetail({ data, total }: { data: { id: string; name: string; sku: string; quantity: number; unitCost: number; totalValue: number }[]; total: number }) {
  const { inputValue: search, debouncedValue: debouncedSearch, setInputValue: setSearch } = useDebouncedSearch({ delay: 300 });
  const filtered = data.filter((d) => {
    const s = debouncedSearch.toLowerCase();
    return !s || d.name.toLowerCase().includes(s) || d.sku.toLowerCase().includes(s);
  });
  const filteredTotal = filtered.reduce((s, d) => s + d.totalValue, 0);
  const filteredQty = filtered.reduce((s, d) => s + d.quantity, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">
          Inventory Valuation Summary — ${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </CardTitle>
        <div className="relative max-w-sm mt-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="pl-10" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">Product</th>
                <th className="text-left px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">SKU</th>
                <th className="text-right px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">Qty on Hand</th>
                <th className="text-right px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">Unit Price</th>
                <th className="text-right px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">Total Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((d) => (
                <tr key={d.id} className="hover:bg-secondary/50 transition-colors">
                  <td className="px-3 py-2.5 font-medium">{d.name}</td>
                  <td className="px-3 py-2.5 text-muted-foreground font-mono text-xs">{d.sku}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{d.quantity}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">${d.unitCost.toFixed(2)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-medium">${d.totalValue.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-border font-semibold">
                  <td className="px-3 py-2.5" colSpan={2}>Total</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{filteredQty}</td>
                  <td className="px-3 py-2.5"></td>
                  <td className="px-3 py-2.5 text-right tabular-nums">${filteredTotal.toFixed(2)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Recent Adjustments Detail ─── */
function RecentAdjustmentsDetail({ logs }: { logs: InventoryLog[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Recent Inventory Adjustments — {logs.length} entries</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">Date</th>
                <th className="text-left px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">Product</th>
                <th className="text-left px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">Type</th>
                <th className="text-right px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">Change</th>
                <th className="text-right px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">Before</th>
                <th className="text-right px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">After</th>
                <th className="text-left px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-secondary/50 transition-colors">
                  <td className="px-3 py-2.5 text-muted-foreground text-xs whitespace-nowrap">{new Date(log.created_at).toLocaleString()}</td>
                  <td className="px-3 py-2.5 font-medium">{log.product_name || log.product_id}</td>
                  <td className="px-3 py-2.5">
                    <Badge variant="secondary">{log.transaction_type || 'adjustment'}</Badge>
                  </td>
                  <td className={`px-3 py-2.5 text-right font-medium tabular-nums ${(log.quantity_change || 0) > 0 ? "text-accent-foreground" : "text-destructive"}`}>
                    {(log.quantity_change || 0) > 0 ? "+" : ""}{log.quantity_change}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{log.quantity_before ?? '—'}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{log.quantity_after ?? '—'}</td>
                  <td className="px-3 py-2.5 text-muted-foreground text-xs max-w-[200px] truncate">{log.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {logs.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No inventory adjustments recorded yet</p>}
      </CardContent>
    </Card>
  );
}

/* ─── All Inventory Detail ─── */
function AllInventoryDetail({ products, ...adjustProps }: { products: Product[] } & AdjustProps) {
  const { inputValue: search, debouncedValue: debouncedSearch, setInputValue: setSearch } = useDebouncedSearch({ delay: 300 });
  const filtered = products
    .filter((p) => {
      const s = debouncedSearch.toLowerCase();
      return !s || p.name.toLowerCase().includes(s) || p.sku.toLowerCase().includes(s);
    })
    .sort((a, b) => a.stock_quantity - b.stock_quantity);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">All Inventory — {products.length} products</CardTitle>
        <div className="relative max-w-sm mt-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by product or SKU..." className="pl-10" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">Product</th>
                <th className="text-left px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">SKU</th>
                <th className="text-left px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">Category</th>
                <th className="text-right px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">Stock</th>
                <th className="text-left px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">Status</th>
                <th className="text-right px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-secondary/50 transition-colors">
                  <td className="px-3 py-2.5 font-medium">{p.name}</td>
                  <td className="px-3 py-2.5 text-muted-foreground font-mono text-xs">{p.sku}</td>
                  <td className="px-3 py-2.5 text-muted-foreground text-xs">{p.category || 'Uncategorized'}</td>
                  <td className={`px-3 py-2.5 text-right font-medium tabular-nums ${p.stock_quantity === 0 ? "text-destructive" : p.stock_quantity <= 50 ? "text-warning" : ""}`}>
                    {p.stock_quantity}
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge variant={p.stock_quantity > 20 ? "default" : p.stock_quantity > 0 ? "secondary" : "destructive"}>
                      {p.stock_quantity > 20 ? "In Stock" : p.stock_quantity > 0 ? "Low" : "Out"}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <AdjustInlineRow productId={p.id} {...adjustProps} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No products found</p>}
      </CardContent>
    </Card>
  );
}

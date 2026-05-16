import React, { useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft, ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight,
  Search, Calendar, ChevronDown, ChevronUp, TrendingUp, TrendingDown, RotateCcw, Loader2,
} from "lucide-react";
import { useProduct, useProductHistory } from "@/hooks/useApi";
import { AdminPageError } from "@/components/admin/AdminPageState";
import { unwrapApiList, unwrapPagination, resolveUploadImageUrl } from "@/lib/api";

type LogType = "in" | "out" | "transfer" | "adjustment" | "return";

const logTypeConfig: Record<LogType, { label: string; icon: React.ElementType; className: string }> = {
  in:         { label: "Stock In",   icon: ArrowDownToLine,  className: "text-green-600 bg-green-500/10" },
  out:        { label: "Stock Out",  icon: ArrowUpFromLine,  className: "text-red-500 bg-red-500/10" },
  transfer:   { label: "Transfer",   icon: ArrowLeftRight,   className: "text-blue-500 bg-blue-500/10" },
  adjustment: { label: "Adjustment", icon: RotateCcw,        className: "text-amber-500 bg-amber-500/10" },
  return:     { label: "Return",     icon: RotateCcw,        className: "text-purple-500 bg-purple-500/10" },
};

function resolveLogType(action: string, quantityChange: number): LogType {
  const a = (action || "").toLowerCase();
  if (a === "in" || a === "stock_in" || a === "receive") return "in";
  if (a === "out" || a === "stock_out" || a === "ship") return "out";
  if (a === "transfer") return "transfer";
  if (a === "return") return "return";
  // For "adjustment" or unknown: infer direction from quantity
  if (a === "adjustment") return "adjustment";
  // Fallback by quantity sign
  if (quantityChange > 0) return "in";
  if (quantityChange < 0) return "out";
  return "adjustment";
}

export default function AdminProductLogs() {
  const { productId } = useParams<{ productId: string }>();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  const { data: productData, isLoading: productLoading, isError: productError } = useProduct(productId!);
  const { data: logsData, isLoading: logsLoading, isError: logsError } = useProductHistory(productId!);

  const product = productData?.data;
  const rawLogs = unwrapApiList<any>(logsData, []);
  const pagination = unwrapPagination(logsData);

  const logs = useMemo(() =>
    rawLogs.map((l: any) => ({
      id: String(l.id),
      date: l.created_at,
      type: resolveLogType(l.action, Number(l.quantity_change)),
      quantity: Number(l.quantity_change),
      reason: l.reason || "",
      oldQuantity: Number(l.old_quantity),
      newQuantity: Number(l.new_quantity),
      user: l.user_name || "System",
      action: l.action,
    })),
    [rawLogs]
  );

  const filtered = useMemo(() =>
    logs.filter((l) => {
      const matchSearch = !search || l.reason.toLowerCase().includes(search.toLowerCase()) || l.user.toLowerCase().includes(search.toLowerCase());
      const matchType = typeFilter === "all" || l.type === typeFilter;
      return matchSearch && matchType;
    }),
    [logs, search, typeFilter]
  );

  const totalIn  = logs.filter((l) => l.quantity > 0).reduce((s, l) => s + l.quantity, 0);
  const totalOut = logs.filter((l) => l.quantity < 0).reduce((s, l) => s + Math.abs(l.quantity), 0);

  if (productLoading || logsLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (productError || !product) {
    return (
      <AdminPageError
        message="Product not found."
        extra={
          <Link to="/admin/products" className="text-accent hover:underline text-sm">
            ← Back to Products
          </Link>
        }
      />
    );
  }

  if (logsError) {
    return (
      <AdminPageError
        message="Failed to load inventory logs."
        extra={
          <Link to="/admin/products" className="text-accent hover:underline text-sm">
            ← Back to Products
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <Link to="/admin/products" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 self-start">
          <ArrowLeft className="h-4 w-4" /> Back to Products
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-3">
          {(() => {
            const imgSrc = (product as any).image || product.images?.[0]?.image_url;
            return imgSrc ? <img src={resolveUploadImageUrl(imgSrc)} alt="" className="w-12 h-12 rounded-sm object-cover bg-secondary flex-shrink-0" /> : null;
          })()}
          <div>
            <h2 className="font-display font-bold text-lg md:text-xl">{product.name}</h2>
            <p className="text-xs text-muted-foreground font-mono">
              {product.sku} · Current Stock: <span className="font-bold text-foreground">{(product as any).stock ?? product.stock_quantity ?? 0}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="dashboard-card">
          <p className="text-xs text-muted-foreground">Total Movements</p>
          <p className="text-xl font-bold font-display">{logs.length}</p>
        </div>
        <div className="dashboard-card">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-green-600" />
            <p className="text-xs text-muted-foreground">Total In</p>
          </div>
          <p className="text-xl font-bold font-display text-green-600">+{totalIn}</p>
        </div>
        <div className="dashboard-card">
          <div className="flex items-center gap-1.5">
            <TrendingDown className="h-3.5 w-3.5 text-red-500" />
            <p className="text-xs text-muted-foreground">Total Out</p>
          </div>
          <p className="text-xl font-bold font-display text-red-500">-{totalOut}</p>
        </div>
        <div className="dashboard-card">
          <p className="text-xs text-muted-foreground">Net Change</p>
          <p className={`text-xl font-bold font-display ${totalIn - totalOut >= 0 ? "text-green-600" : "text-red-500"}`}>
            {totalIn - totalOut >= 0 ? "+" : ""}{totalIn - totalOut}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="dashboard-card">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
          <div className="relative flex-1 w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search reason or user..."
              className="w-full pl-10 pr-4 py-2 border border-border rounded-sm text-sm bg-background outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="border border-border rounded-sm px-3 py-2 text-sm bg-background outline-none w-full sm:w-auto"
          >
            <option value="all">All Types</option>
            <option value="in">Stock In</option>
            <option value="out">Stock Out</option>
            <option value="transfer">Transfer</option>
            <option value="adjustment">Adjustment</option>
            <option value="return">Return</option>
          </select>
        </div>

        {/* Mobile card view */}
        <div className="md:hidden space-y-2">
          {filtered.length === 0 && (
            <p className="text-center py-8 text-sm text-muted-foreground">No logs found.</p>
          )}
          {filtered.map((log) => {
            const config = logTypeConfig[log.type];
            const Icon = config.icon;
            const isExpanded = expandedLog === log.id;
            return (
              <div key={log.id} className="border border-border rounded-md overflow-hidden">
                <button
                  onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                  className="w-full p-3 text-left flex items-center gap-3"
                >
                  <div className={`p-2 rounded-sm flex-shrink-0 ${config.className}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{config.label}</span>
                      <span className={`text-sm font-bold ${log.quantity > 0 ? "text-green-600" : "text-red-500"}`}>
                        {log.quantity > 0 ? "+" : ""}{log.quantity}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(log.date).toLocaleDateString()} · {log.user}
                    </p>
                  </div>
                  {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
                </button>
                {isExpanded && (
                  <div className="px-3 pb-3 border-t border-border pt-3 bg-secondary/30 space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Stock Before</span>
                      <span>{log.oldQuantity}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Stock After</span>
                      <span className="font-medium">{log.newQuantity}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">User</span>
                      <span>{log.user}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Time</span>
                      <span>{new Date(log.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    {log.reason && (
                      <div className="pt-1.5 border-t border-border mt-1.5">
                        <p className="text-xs text-muted-foreground">{log.reason}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="text-left px-3 py-2">Date</th>
                <th className="text-left px-3 py-2">Type</th>
                <th className="text-right px-3 py-2">Change</th>
                <th className="text-right px-3 py-2">Before</th>
                <th className="text-right px-3 py-2">After</th>
                <th className="text-left px-3 py-2">Reason</th>
                <th className="text-left px-3 py-2">User</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((log) => {
                const config = logTypeConfig[log.type];
                const Icon = config.icon;
                return (
                  <tr key={log.id} className="hover:bg-secondary/50 transition-colors">
                    <td className="px-3 py-3 text-muted-foreground whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        {new Date(log.date).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-xs font-medium ${config.className}`}>
                        <Icon className="h-3 w-3" /> {config.label}
                      </span>
                    </td>
                    <td className={`px-3 py-3 text-right font-bold ${log.quantity > 0 ? "text-green-600" : "text-red-500"}`}>
                      {log.quantity > 0 ? "+" : ""}{log.quantity}
                    </td>
                    <td className="px-3 py-3 text-right text-muted-foreground">{log.oldQuantity}</td>
                    <td className="px-3 py-3 text-right font-medium">{log.newQuantity}</td>
                    <td className="px-3 py-3 text-muted-foreground max-w-[200px] truncate">{log.reason || "—"}</td>
                    <td className="px-3 py-3 text-muted-foreground">{log.user}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="text-center py-8 text-sm text-muted-foreground">No logs found.</p>
          )}
        </div>

        <div className="mt-4 text-xs text-muted-foreground font-medium">
          Showing {filtered.length} of {Number(pagination?.total ?? logs.length)} entries
        </div>
      </div>
    </div>
  );
}

import React, { useState } from "react";
import { Plus, Search, Edit, Trash2, Copy, Tag, Percent, DollarSign, Calendar, CheckCircle, X, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { useDiscounts, useApiMutation } from "@/hooks/useApi";
import { api, Discount, unwrapApiList, unwrapPagination } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { showSuccessToast, showErrorToast } from "@/lib/toast";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminPageError, AdminPageLoading } from "@/components/admin/AdminPageState";
import { useConfirm } from "@/components/ConfirmDialog";
import { useLanguage } from "@/contexts/LanguageContext";

const statusStyles: Record<string, string> = {
  active: "badge-success",
  expired: "badge-destructive",
  scheduled: "badge-info",
  disabled: "badge-warning",
};

function getDiscountStatus(discount: Discount): string {
  if (!discount.is_active) return "disabled";
  const now = new Date();
  const validFrom = new Date(discount.valid_from);
  const validUntil = new Date(discount.valid_until);
  if (now < validFrom) return "scheduled";
  if (now > validUntil) return "expired";
  if (discount.max_usage_count && discount.current_usage_count >= discount.max_usage_count) return "expired";
  return "active";
}

export default function AdminDiscounts() {
  const confirmAction = useConfirm();
  const { t } = useLanguage();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [expandedDiscount, setExpandedDiscount] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ 
    code: "", 
    discount_type: "percentage" as "percentage" | "fixed_amount", 
    discount_value: 0, 
    min_purchase_amount: 0, 
    max_usage_count: 100, 
    valid_from: "", 
    valid_until: "",
    description: "",
  });

  const queryClient = useQueryClient();

  const { data: discountsResponse, isLoading, isError, error } = useDiscounts(page, 50);

  const createDiscountMutation = useApiMutation(
    (data: any) => api.createDiscount(data),
    {
      onSuccess: () => {
        showSuccessToast("Discounts", "Discount code created");
        queryClient.invalidateQueries({ queryKey: ['discounts'] });
        setShowForm(false);
        resetForm();
      },
      onError: (e: unknown) => {
        showErrorToast("Discounts", e instanceof Error ? e.message : "Failed to create discount");
      },
    }
  );

  const updateDiscountMutation = useApiMutation(
    ({ id, data }: { id: string; data: any }) => api.updateDiscount(id, data),
    {
      onSuccess: () => {
        showSuccessToast("Discounts", "Discount code updated");
        queryClient.invalidateQueries({ queryKey: ['discounts'] });
        setShowForm(false);
        setEditingId(null);
        resetForm();
      },
      onError: (e: unknown) => {
        showErrorToast("Discounts", e instanceof Error ? e.message : "Failed to update discount");
      },
    }
  );

  const deleteDiscountMutation = useApiMutation(
    (id: string) => api.deleteDiscount(id),
    {
      onSuccess: () => {
        showSuccessToast("Discounts", "Discount code deleted");
        queryClient.invalidateQueries({ queryKey: ['discounts'] });
      },
      onError: (e: unknown) => {
        showErrorToast("Discounts", e instanceof Error ? e.message : "Delete failed");
      },
    }
  );

  function resetForm() {
    setForm({ 
      code: "", 
      discount_type: "percentage", 
      discount_value: 0, 
      min_purchase_amount: 0, 
      max_usage_count: 100, 
      valid_from: "", 
      valid_until: "",
      description: "",
    });
  }

  const discounts: Discount[] = unwrapApiList<Discount>(discountsResponse, []);
  const pagination = unwrapPagination(discountsResponse);

  const filtered = discounts.filter((d) => {
    const status = getDiscountStatus(d);
    const matchSearch = !search || d.code.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || status === statusFilter;
    return matchSearch && matchStatus;
  });

  const activeCodes = discounts.filter(d => getDiscountStatus(d) === "active").length;
  const totalUsed = discounts.reduce((s, d) => s + d.current_usage_count, 0);

  const handleSubmit = () => {
    if (!form.code || !form.valid_from || !form.valid_until) return;

    const data = {
      code: form.code.toUpperCase(),
      discount_type: form.discount_type,
      discount_value: form.discount_value,
      min_purchase_amount: form.min_purchase_amount || undefined,
      max_usage_count: form.max_usage_count || undefined,
      valid_from: form.valid_from,
      valid_until: form.valid_until,
      description: form.description || undefined,
      is_active: true,
    };

    if (editingId) {
      updateDiscountMutation.mutate({ id: editingId, data });
    } else {
      createDiscountMutation.mutate(data);
    }
  };

  const handleEdit = (discount: Discount) => {
    setForm({
      code: discount.code,
      discount_type: discount.discount_type,
      discount_value: discount.discount_value,
      min_purchase_amount: discount.min_purchase_amount || 0,
      max_usage_count: discount.max_usage_count || 100,
      valid_from: discount.valid_from.split('T')[0],
      valid_until: discount.valid_until.split('T')[0],
      description: discount.description || "",
    });
    setEditingId(discount.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    const ok = await confirmAction({ title: t("confirm.delete_title"), message: t("confirm.delete_discount"), variant: "danger" });
    if (ok) deleteDiscountMutation.mutate(id);
  };

  const handleToggleStatus = (discount: Discount) => {
    updateDiscountMutation.mutate({
      id: discount.id,
      data: { is_active: !discount.is_active }
    });
  };

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
  };

  if (isLoading) {
    return <AdminPageLoading message="Loading discounts" />;
  }

  if (isError) {
    return (
      <AdminPageError
        message={error instanceof Error ? error.message : "An error occurred while fetching discounts."}
        onRetry={() => queryClient.invalidateQueries({ queryKey: ["discounts"] })}
      />
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Discounts & Coupons"
        subtitle={pagination ? `${pagination.total} total codes` : undefined}
        icon={Tag}
        actions={
          <button
            onClick={() => {
              resetForm();
              setEditingId(null);
              setShowForm(!showForm);
            }}
            className={showForm ? "admin-btn--secondary" : "admin-btn--primary"}
          >
            {showForm ? (
              <><X className="h-4 w-4" /> Cancel</>
            ) : (
              <><Plus className="h-4 w-4" /> Create Discount</>
            )}
          </button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="stat-card stat-card--accent">
          <p className="text-xs text-muted-foreground font-medium">Total Codes</p>
          <p className="text-2xl font-bold font-display mt-1 tracking-tight">{discounts.length}</p>
        </div>
        <div className="stat-card stat-card--success">
          <p className="text-xs text-muted-foreground font-medium">Active</p>
          <p className="text-2xl font-bold font-display mt-1 tracking-tight text-success">{activeCodes}</p>
        </div>
        <div className="stat-card stat-card--info">
          <p className="text-xs text-muted-foreground font-medium">Total Uses</p>
          <p className="text-2xl font-bold font-display mt-1 tracking-tight">{totalUsed}</p>
        </div>
        <div className="stat-card stat-card--warning">
          <p className="text-xs text-muted-foreground font-medium">Avg. Discount</p>
          <p className="text-2xl font-bold font-display mt-1 tracking-tight">
            {discounts.filter(d => d.discount_type === "percentage").length > 0 
              ? Math.round(discounts.filter(d => d.discount_type === "percentage").reduce((s, d) => s + d.discount_value, 0) / discounts.filter(d => d.discount_type === "percentage").length)
              : 0}%
          </p>
        </div>
      </div>

      {/* Create/Edit form */}
      {showForm && (
        <div className="dashboard-card">
          <div className="flex items-center gap-2.5 mb-5 pb-3 border-b border-border">
            <div className="stat-icon stat-icon--accent">
              <Tag className="h-4 w-4" />
            </div>
            <h3 className="font-display font-bold text-sm uppercase tracking-wider">
              {editingId ? "Edit Discount Code" : "New Discount Code"}
            </h3>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="admin-label">Code</label>
              <input 
                value={form.code} 
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} 
                placeholder="e.g. FLEET10" 
                className="admin-input font-mono" 
              />
            </div>
            <div>
              <label className="admin-label">Type</label>
              <select 
                value={form.discount_type} 
                onChange={(e) => setForm({ ...form, discount_type: e.target.value as "percentage" | "fixed_amount" })} 
                className="admin-input"
              >
                <option value="percentage">Percentage (%)</option>
                <option value="fixed_amount">Fixed Amount ($)</option>
              </select>
            </div>
            <div>
              <label className="admin-label">Value</label>
              <input 
                type="number" 
                value={form.discount_value} 
                onChange={(e) => setForm({ ...form, discount_value: parseFloat(e.target.value) || 0 })} 
                className="admin-input" 
              />
            </div>
            <div>
              <label className="admin-label">Min. Order (CAD)</label>
              <input 
                type="number" 
                value={form.min_purchase_amount} 
                onChange={(e) => setForm({ ...form, min_purchase_amount: parseFloat(e.target.value) || 0 })} 
                className="admin-input" 
              />
            </div>
            <div>
              <label className="admin-label">Max Uses</label>
              <input 
                type="number" 
                value={form.max_usage_count} 
                onChange={(e) => setForm({ ...form, max_usage_count: parseInt(e.target.value) || 0 })} 
                className="admin-input" 
              />
            </div>
            <div>
              <label className="admin-label">Description</label>
              <input 
                value={form.description} 
                onChange={(e) => setForm({ ...form, description: e.target.value })} 
                placeholder="Optional description" 
                className="admin-input" 
              />
            </div>
            <div>
              <label className="admin-label">Start Date</label>
              <input 
                type="date" 
                value={form.valid_from} 
                onChange={(e) => setForm({ ...form, valid_from: e.target.value })} 
                className="admin-input" 
              />
            </div>
            <div>
              <label className="admin-label">End Date</label>
              <input 
                type="date" 
                value={form.valid_until} 
                onChange={(e) => setForm({ ...form, valid_until: e.target.value })} 
                className="admin-input" 
              />
            </div>
            <div className="flex items-end">
              <button 
                onClick={handleSubmit} 
                disabled={createDiscountMutation.isPending || updateDiscountMutation.isPending}
                className="admin-btn--primary w-full py-2.5"
              >
                {(createDiscountMutation.isPending || updateDiscountMutation.isPending) ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4" />
                )}
                {editingId ? "Update Code" : "Create Code"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* List */}
      <div className="dashboard-card">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-5">
          <div className="relative flex-1 w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
              placeholder="Search codes..." 
              className="admin-input pl-10" 
            />
          </div>
          <select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)} 
            className="admin-input w-full sm:w-auto"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="scheduled">Scheduled</option>
            <option value="expired">Expired</option>
            <option value="disabled">Disabled</option>
          </select>
        </div>

        {/* Mobile */}
        <div className="md:hidden space-y-2">
          {filtered.map((d) => {
            const status = getDiscountStatus(d);
            const isExpanded = expandedDiscount === d.id;
            const usagePercent = d.max_usage_count ? Math.min(100, (d.current_usage_count / d.max_usage_count) * 100) : 0;
            return (
              <div key={d.id} className="border border-border rounded-xl overflow-hidden">
                <button onClick={() => setExpandedDiscount(isExpanded ? null : d.id)} className="w-full p-3 text-left flex items-center justify-between hover:bg-muted/20 transition-colors">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Tag className="h-3.5 w-3.5 text-accent flex-shrink-0" />
                      <span className="font-mono font-bold text-sm">{d.code}</span>
                      <span className={statusStyles[status]}>{status}</span>
                    </div>
                    <p className="text-sm font-semibold">
                      {d.discount_type === "percentage" ? `${d.discount_value}% off` : `C$${d.discount_value} off`}
                    </p>
                  </div>
                  {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </button>
                {isExpanded && (
                  <div className="px-3 pb-3 border-t border-border pt-3 space-y-2 bg-muted/10">
                    <div className="flex justify-between text-xs"><span className="text-muted-foreground">Min. Order</span><span className="font-medium">C${d.min_purchase_amount || 0}</span></div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs"><span className="text-muted-foreground">Uses</span><span className="font-medium">{d.current_usage_count} / {d.max_usage_count || "∞"}</span></div>
                      {d.max_usage_count > 0 && (
                        <div className="admin-progress">
                          <div className="admin-progress-bar" style={{ width: `${usagePercent}%`, background: usagePercent >= 90 ? 'hsl(var(--destructive))' : undefined }} />
                        </div>
                      )}
                    </div>
                    <div className="flex justify-between text-xs"><span className="text-muted-foreground">Period</span><span className="font-medium">{d.valid_from.split('T')[0]} → {d.valid_until.split('T')[0]}</span></div>
                    <div className="flex gap-2 pt-2">
                      <button onClick={() => copyToClipboard(d.code)} className="admin-btn--secondary flex-1 text-xs py-1.5"><Copy className="h-3 w-3" /> Copy</button>
                      <button onClick={() => handleEdit(d)} className="admin-btn--primary flex-1 text-xs py-1.5"><Edit className="h-3 w-3" /> Edit</button>
                      <button onClick={() => handleDelete(d.id)} disabled={deleteDiscountMutation.isPending} className="admin-btn--danger px-3 py-1.5 text-xs"><Trash2 className="h-3 w-3" /></button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Desktop */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="text-left px-3 py-2.5">Code</th>
                <th className="text-left px-3 py-2.5">Discount</th>
                <th className="text-right px-3 py-2.5">Min. Order</th>
                <th className="text-left px-3 py-2.5">Usage</th>
                <th className="text-left px-3 py-2.5">Period</th>
                <th className="text-left px-3 py-2.5">Status</th>
                <th className="text-right px-3 py-2.5">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((d) => {
                const status = getDiscountStatus(d);
                const usagePercent = d.max_usage_count ? Math.min(100, (d.current_usage_count / d.max_usage_count) * 100) : 0;
                return (
                  <tr key={d.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <Tag className="h-3.5 w-3.5 text-accent flex-shrink-0" />
                        <span className="font-mono font-bold">{d.code}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 font-semibold">
                      <span className="flex items-center gap-1">
                        {d.discount_type === "percentage" ? <><Percent className="h-3 w-3" />{d.discount_value}%</> : <><DollarSign className="h-3 w-3" />C${d.discount_value}</>}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right text-muted-foreground">C${d.min_purchase_amount || 0}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-3 min-w-[120px]">
                        <div className="admin-progress flex-1">
                          <div className="admin-progress-bar" style={{ width: `${usagePercent}%`, background: usagePercent >= 90 ? 'hsl(var(--destructive))' : undefined }} />
                        </div>
                        <span className="text-xs font-medium tabular-nums whitespace-nowrap">
                          <span className={usagePercent >= 90 ? "text-destructive" : ""}>{d.current_usage_count}</span>
                          <span className="text-muted-foreground"> / {d.max_usage_count || "∞"}</span>
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1"><Calendar className="h-3 w-3" />{d.valid_from.split('T')[0]}</div>
                      <div className="text-muted-foreground/60">→ {d.valid_until.split('T')[0]}</div>
                    </td>
                    <td className="px-3 py-3"><span className={statusStyles[status]}>{status}</span></td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => copyToClipboard(d.code)} className="admin-btn--ghost p-1.5" title="Copy Code"><Copy className="h-4 w-4" /></button>
                        <button onClick={() => handleEdit(d)} className="admin-btn--ghost p-1.5" title="Edit"><Edit className="h-4 w-4" /></button>
                        <button onClick={() => handleToggleStatus(d)} disabled={updateDiscountMutation.isPending} className="admin-btn--ghost p-1.5" title={d.is_active ? "Disable" : "Enable"}>{d.is_active ? <X className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}</button>
                        <button onClick={() => handleDelete(d.id)} disabled={deleteDiscountMutation.isPending} className="admin-btn--danger p-1.5 border-0" title="Delete"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && <div className="text-center py-12 text-sm text-muted-foreground">No discount codes found.</div>}

        {/* Pagination */}
        {pagination && pagination.pages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-border">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="admin-btn--secondary text-xs px-3 py-1.5"
            >
              Previous
            </button>
            <span className="text-xs text-muted-foreground font-medium">Page {page} of {pagination.pages}</span>
            <button
              onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
              disabled={page === pagination.pages}
              className="admin-btn--secondary text-xs px-3 py-1.5"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

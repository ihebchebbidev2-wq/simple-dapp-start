import React, { useEffect, useState } from "react";
import {
  Plus, Save, Trash2, Loader2, CheckCircle, GripVertical,
  ToggleLeft, ToggleRight, Pencil, X, Receipt,
} from "lucide-react";
import {
  useAllTaxRates, useCreateTaxRate, useUpdateTaxRate,
  useDeleteTaxRate,
} from "@/hooks/useApi";
import { unwrapApiList } from "@/lib/api";
import type { TaxRateConfig } from "@/lib/api";
import { showErrorToast, showSuccessToast } from "@/lib/toast";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminPageError, AdminPageLoading } from "@/components/admin/AdminPageState";
import { useConfirm } from "@/components/ConfirmDialog";
import { useLanguage } from "@/contexts/LanguageContext";

type EditRow = Partial<TaxRateConfig> & { _new?: boolean };

export default function AdminTaxRates() {
  const { t } = useLanguage();
  const confirmAction = useConfirm();
  const { data: res, isLoading, isError, refetch } = useAllTaxRates();
  const createMut = useCreateTaxRate();
  const updateMut = useUpdateTaxRate();
  const deleteMut = useDeleteTaxRate();

  const rates: TaxRateConfig[] = unwrapApiList<TaxRateConfig>(res, []);

  const [editing, setEditing] = useState<EditRow | null>(null);

  function openNew() {
    setEditing({
      _new: true,
      name: "",
      label_en: "",
      label_fr: "",
      label_es: "",
      rate: 0,
      is_active: true,
      is_compound: false,
      display_order: (rates.length + 1),
    });
  }

  function openEdit(r: TaxRateConfig) {
    setEditing({ ...r });
  }

  async function handleSave() {
    if (!editing) return;
    const { _new, id, ...data } = editing as any;
    if (!data.name?.trim()) {
      showErrorToast("Tax Rate", "Name is required");
      return;
    }
    if (data.rate == null || data.rate < 0 || data.rate > 100) {
      showErrorToast("Tax Rate", "Rate must be between 0 and 100");
      return;
    }
    try {
      if (_new) {
        await createMut.mutateAsync(data);
        showSuccessToast("Tax Rate", "Created successfully");
      } else {
        await updateMut.mutateAsync({ id, data });
        showSuccessToast("Tax Rate", "Updated successfully");
      }
      setEditing(null);
      refetch();
    } catch (e) {
      showErrorToast("Tax Rate", e instanceof Error ? e.message : "Save failed");
    }
  }

  async function handleDelete(id: string, name: string) {
    const ok = await confirmAction({
      title: "Delete Tax Rate",
      message: `Are you sure you want to delete "${name}"? This cannot be undone.`,
      variant: "danger",
    });
    if (!ok) return;
    try {
      await deleteMut.mutateAsync(id);
      showSuccessToast("Tax Rate", "Deleted");
      refetch();
    } catch (e) {
      showErrorToast("Tax Rate", e instanceof Error ? e.message : "Delete failed");
    }
  }

  async function handleToggleActive(r: TaxRateConfig) {
    try {
      await updateMut.mutateAsync({ id: r.id, data: { is_active: !r.is_active } });
      showSuccessToast("Tax Rate", r.is_active ? "Deactivated" : "Activated");
      refetch();
    } catch (e) {
      showErrorToast("Tax Rate", e instanceof Error ? e.message : "Toggle failed");
    }
  }

  if (isLoading) return <AdminPageLoading message="Loading tax rates" />;
  if (isError) return <AdminPageError message="Could not load tax rates" onRetry={() => refetch()} />;

  const isSaving = createMut.isPending || updateMut.isPending;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Tax Rates"
        subtitle="Configure tax rates applied to orders, offers, and reports"
      />

      {/* Add button */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={openNew}
          className="admin-btn--primary px-4 py-2"
        >
          <Plus className="h-4 w-4" /> Add Tax Rate
        </button>
      </div>

      {/* Edit / Create form */}
      {editing && (
        <div className="dashboard-card border-2 border-primary/30">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold text-sm uppercase tracking-wider">
              {editing._new ? "New Tax Rate" : `Edit: ${editing.name}`}
            </h3>
            <button type="button" onClick={() => setEditing(null)} className="p-1 hover:bg-muted rounded-lg transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="admin-label">Internal Name *</label>
              <input
                className="admin-input"
                value={editing.name ?? ""}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                placeholder="e.g. GST, QST, HST, PST"
              />
            </div>
            <div>
              <label className="admin-label">Rate (%) *</label>
              <input
                type="number"
                step="0.001"
                min="0"
                max="100"
                className="admin-input"
                value={editing.rate ?? ""}
                onChange={(e) => setEditing({ ...editing, rate: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div>
              <label className="admin-label">Display Order</label>
              <input
                type="number"
                min="1"
                className="admin-input"
                value={editing.display_order ?? 1}
                onChange={(e) => setEditing({ ...editing, display_order: parseInt(e.target.value) || 1 })}
              />
            </div>
            <div>
              <label className="admin-label">English Label</label>
              <input
                className="admin-input"
                value={editing.label_en ?? ""}
                onChange={(e) => setEditing({ ...editing, label_en: e.target.value })}
                placeholder="e.g. GST (5%)"
              />
            </div>
            <div>
              <label className="admin-label">French Label</label>
              <input
                className="admin-input"
                value={editing.label_fr ?? ""}
                onChange={(e) => setEditing({ ...editing, label_fr: e.target.value })}
                placeholder="e.g. TPS (5%)"
              />
            </div>
            <div>
              <label className="admin-label">Spanish Label</label>
              <input
                className="admin-input"
                value={editing.label_es ?? ""}
                onChange={(e) => setEditing({ ...editing, label_es: e.target.value })}
                placeholder="e.g. IVA (5%)"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 mt-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={editing.is_compound ?? false}
                onChange={(e) => setEditing({ ...editing, is_compound: e.target.checked })}
                className="rounded border-input"
              />
              <span>Compound (calculated on subtotal + previous taxes)</span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={editing.is_active ?? true}
                onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })}
                className="rounded border-input"
              />
              <span>Active</span>
            </label>
          </div>

          <div className="flex justify-end mt-4">
            <button
              type="button"
              disabled={isSaving}
              onClick={handleSave}
              className="admin-btn--primary px-5 py-2"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {editing._new ? "Create" : "Save Changes"}
            </button>
          </div>
        </div>
      )}

      {/* Tax rates table */}
      {rates.length === 0 ? (
        <div className="dashboard-card text-center py-12">
          <Receipt className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground">No tax rates configured yet.</p>
          <p className="text-sm text-muted-foreground/70 mt-1">Click "Add Tax Rate" to create your first tax.</p>
        </div>
      ) : (
        <div className="dashboard-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="pb-3 pr-3 font-semibold text-muted-foreground">#</th>
                <th className="pb-3 pr-3 font-semibold text-muted-foreground">Name</th>
                <th className="pb-3 pr-3 font-semibold text-muted-foreground">Rate</th>
                <th className="pb-3 pr-3 font-semibold text-muted-foreground hidden md:table-cell">EN Label</th>
                <th className="pb-3 pr-3 font-semibold text-muted-foreground hidden lg:table-cell">FR Label</th>
                <th className="pb-3 pr-3 font-semibold text-muted-foreground">Compound</th>
                <th className="pb-3 pr-3 font-semibold text-muted-foreground">Active</th>
                <th className="pb-3 font-semibold text-muted-foreground text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rates.map((r) => (
                <tr key={r.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="py-3 pr-3 text-muted-foreground">{r.display_order}</td>
                  <td className="py-3 pr-3 font-medium">{r.name}</td>
                  <td className="py-3 pr-3 font-mono">{r.rate}%</td>
                  <td className="py-3 pr-3 hidden md:table-cell text-muted-foreground">{r.label_en || "—"}</td>
                  <td className="py-3 pr-3 hidden lg:table-cell text-muted-foreground">{r.label_fr || "—"}</td>
                  <td className="py-3 pr-3">
                    {r.is_compound ? (
                      <span className="text-xs bg-accent/10 text-accent px-2 py-0.5 rounded-full font-medium">Yes</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">No</span>
                    )}
                  </td>
                  <td className="py-3 pr-3">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(r)}
                      className="transition-colors"
                      title={r.is_active ? "Deactivate" : "Activate"}
                    >
                      {r.is_active ? (
                        <ToggleRight className="h-5 w-5 text-primary" />
                      ) : (
                        <ToggleLeft className="h-5 w-5 text-muted-foreground" />
                      )}
                    </button>
                  </td>
                  <td className="py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(r)}
                        className="p-1.5 hover:bg-primary/10 rounded-lg transition-colors text-primary"
                        title="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(r.id, r.name)}
                        disabled={deleteMut.isPending}
                        className="p-1.5 hover:bg-destructive/10 rounded-lg transition-colors text-destructive"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Summary */}
      {rates.length > 0 && (
        <div className="dashboard-card bg-muted/30">
          <h4 className="font-display font-bold text-xs uppercase tracking-wider text-muted-foreground mb-2">Tax Summary (Active)</h4>
          <div className="flex flex-wrap gap-4">
            {rates.filter(r => r.is_active).map(r => (
              <div key={r.id} className="flex items-center gap-2 text-sm">
                <span className="font-medium">{r.name}:</span>
                <span className="font-mono">{r.rate}%</span>
                {r.is_compound && <span className="text-[10px] text-accent">(compound)</span>}
              </div>
            ))}
            {rates.filter(r => r.is_active).length === 0 && (
              <p className="text-sm text-muted-foreground">No active tax rates</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

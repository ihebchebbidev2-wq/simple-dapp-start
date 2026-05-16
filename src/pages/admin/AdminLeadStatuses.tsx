import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Save, X, Pencil, Loader2, Tag } from "lucide-react";
import { api } from "@/lib/api";
import { showErrorToast, showSuccessToast } from "@/lib/toast";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminPageLoading, AdminPageError } from "@/components/admin/AdminPageState";
import { useConfirm } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type LeadStatus = { id: string; label: string; color: string; sort_order: number; is_default: number };
type EditRow = Partial<LeadStatus> & { _new?: boolean };

export default function AdminLeadStatuses() {
  const qc = useQueryClient();
  const confirmAction = useConfirm();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["lead-statuses"],
    queryFn: () => api.listLeadStatuses(),
  });
  const rows: LeadStatus[] = (data?.data as LeadStatus[]) || [];

  const [editing, setEditing] = useState<EditRow | null>(null);

  const createMut = useMutation({
    mutationFn: (payload: { label: string; color?: string; sort_order?: number; is_default?: boolean }) =>
      api.createLeadStatus(payload),
  });
  const updateMut = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<{ label: string; color: string; sort_order: number; is_default: boolean }> }) =>
      api.updateLeadStatus(id, payload),
  });
  const deleteMut = useMutation({ mutationFn: (id: string) => api.deleteLeadStatus(id) });

  const openNew = () =>
    setEditing({ _new: true, label: "", color: "#64748b", sort_order: rows.length + 1, is_default: 0 });

  async function handleSave() {
    if (!editing) return;
    const label = (editing.label || "").trim();
    if (!label) return showErrorToast("Lead status", "Label is required");
    try {
      if (editing._new) {
        await createMut.mutateAsync({
          label,
          color: editing.color || "#64748b",
          sort_order: Number(editing.sort_order || 0),
          is_default: !!editing.is_default,
        });
        showSuccessToast("Lead status", "Created");
      } else {
        await updateMut.mutateAsync({
          id: editing.id!,
          payload: {
            label,
            color: editing.color,
            sort_order: Number(editing.sort_order || 0),
            is_default: !!editing.is_default,
          },
        });
        showSuccessToast("Lead status", "Updated");
      }
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["lead-statuses"] });
      refetch();
    } catch (e) {
      showErrorToast("Lead status", e instanceof Error ? e.message : "Save failed");
    }
  }

  async function handleDelete(row: LeadStatus) {
    const ok = await confirmAction({
      title: "Delete status",
      message: `Delete "${row.label}"? Leads that use it must be reassigned first.`,
      variant: "danger",
    });
    if (!ok) return;
    try {
      await deleteMut.mutateAsync(row.id);
      showSuccessToast("Lead status", "Deleted");
      qc.invalidateQueries({ queryKey: ["lead-statuses"] });
      refetch();
    } catch (e) {
      showErrorToast("Lead status", e instanceof Error ? e.message : "Delete failed");
    }
  }

  if (isLoading) return <AdminPageLoading message="Loading lead statuses..." />;
  if (isError) return <AdminPageError message="Failed to load lead statuses" onRetry={refetch} />;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        icon={Tag}
        title="Lead Statuses"
        subtitle="Customize your lead pipeline: add, rename, recolor, and reorder statuses."
        actions={
          <Button onClick={openNew} size="sm">
            <Plus className="w-4 h-4 mr-2" /> New Status
          </Button>
        }
      />

      <div className="bg-card rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <th className="text-left p-3 font-medium">Label</th>
              <th className="text-left p-3 font-medium">Color</th>
              <th className="text-left p-3 font-medium">Order</th>
              <th className="text-left p-3 font-medium">Default</th>
              <th className="text-right p-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No statuses yet. Click "New Status" to add one.</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-3">
                  <span
                    className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium text-white"
                    style={{ backgroundColor: r.color }}
                  >
                    {r.label}
                  </span>
                </td>
                <td className="p-3 font-mono text-xs">{r.color}</td>
                <td className="p-3">{r.sort_order}</td>
                <td className="p-3">{r.is_default ? "Yes" : ""}</td>
                <td className="p-3 text-right">
                  <Button variant="ghost" size="sm" onClick={() => setEditing({ ...r })}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(r)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="bg-card rounded-lg border shadow-lg w-full max-w-md p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{editing._new ? "New status" : "Edit status"}</h3>
              <Button variant="ghost" size="sm" onClick={() => setEditing(null)}><X className="w-4 h-4" /></Button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">Label</label>
                <Input
                  value={editing.label || ""}
                  onChange={(e) => setEditing({ ...editing, label: e.target.value })}
                  placeholder="e.g. Qualified"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Color</label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={editing.color || "#64748b"}
                      onChange={(e) => setEditing({ ...editing, color: e.target.value })}
                      className="h-9 w-12 rounded border"
                    />
                    <Input
                      value={editing.color || ""}
                      onChange={(e) => setEditing({ ...editing, color: e.target.value })}
                      className="font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Sort order</label>
                  <Input
                    type="number"
                    value={editing.sort_order ?? 0}
                    onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })}
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!editing.is_default}
                  onChange={(e) => setEditing({ ...editing, is_default: e.target.checked ? 1 : 0 })}
                />
                Set as default for new leads
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={handleSave} disabled={createMut.isPending || updateMut.isPending}>
                {(createMut.isPending || updateMut.isPending) ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

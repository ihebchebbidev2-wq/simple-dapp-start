import React, { useMemo, useState } from "react";
import {
  Phone,
  Mail,
  UserRound,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  X,
  CheckCircle,
} from "lucide-react";
import { useAdminContactsListAll, useCreateAdminContact, useDeleteAdminContact, useUpdateAdminContact } from "@/hooks/useApi";
import { unwrapApiList } from "@/lib/api";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminPageError, AdminPageLoading } from "@/components/admin/AdminPageState";

type AdminContactRow = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  department?: string | null;
  specialization?: string | null;
  is_available: boolean;
  display_order: number;
  created_at?: string;
  updated_at?: string;
};

type ContactForm = {
  name: string;
  email: string;
  phone: string;
  department: string;
  specialization: string;
  is_available: boolean;
  display_order: number;
};

const emptyForm: ContactForm = {
  name: "",
  email: "",
  phone: "",
  department: "",
  specialization: "",
  is_available: true,
  display_order: 0,
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0].slice(0, 2).toUpperCase();
}

export default function AdminContacts() {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ContactForm>({ ...emptyForm });

  const { data: res, isLoading, isError, error } = useAdminContactsListAll();
  const contacts = unwrapApiList<AdminContactRow>(res, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter((c) => {
      return (
        c.name.toLowerCase().includes(q) ||
        String(c.department ?? "").toLowerCase().includes(q) ||
        String(c.specialization ?? "").toLowerCase().includes(q) ||
        String(c.email ?? "").toLowerCase().includes(q)
      );
    });
  }, [contacts, search]);

  const createMutation = useCreateAdminContact();
  const updateMutation = useUpdateAdminContact();
  const deleteMutation = useDeleteAdminContact();

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({ ...emptyForm });
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm, display_order: 0 });
    setShowForm(true);
  };

  const openEdit = (c: AdminContactRow) => {
    setEditingId(c.id);
    setForm({
      name: c.name ?? "",
      email: String(c.email ?? ""),
      phone: String(c.phone ?? ""),
      department: String(c.department ?? ""),
      specialization: String(c.specialization ?? ""),
      is_available: Boolean(c.is_available),
      display_order: Number(c.display_order ?? 0),
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    const payload = {
      name: form.name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      department: form.department.trim() || null,
      specialization: form.specialization.trim() || null,
      is_available: form.is_available ? 1 : 0,
      display_order: Number.isFinite(form.display_order) ? form.display_order : 0,
    };

    if (!payload.name) return;

    if (editingId) {
      updateMutation.mutate(
        { id: editingId, data: payload },
        {
          onSuccess: () => closeForm(),
        }
      );
    } else {
      createMutation.mutate(payload as any, {
        onSuccess: () => closeForm(),
      });
    }
  };

  const isMutating = createMutation.isPending || updateMutation.isPending;

  if (isLoading) {
    return <AdminPageLoading message="Loading admin contacts" />;
  }

  if (isError) {
    return (
      <AdminPageError
        message={error instanceof Error ? error.message : "Failed to load"}
      />
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Admin Contacts"
        subtitle="Manage the internal contact directory used by the admin UI and customer portal."
        icon={UserRound}
        actions={
          <button
            type="button"
            onClick={openCreate}
            className="admin-btn--primary"
          >
            <Plus className="h-4 w-4" /> New Contact
          </button>
        }
      />

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative flex-1 max-w-md">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, department, specialization, email..."
            className="admin-input pl-3"
          />
        </div>
        <div className="text-xs text-muted-foreground">
          {filtered.length} contact{filtered.length !== 1 ? "s" : ""}
        </div>
      </div>

      {showForm && (
        <div className="dashboard-card space-y-4">
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-border">
            <div className="flex items-center gap-2.5">
              <div className="stat-icon stat-icon--accent">
                <UserRound className="h-4 w-4" />
              </div>
              <span className="font-display font-bold text-sm uppercase tracking-wider">
                {editingId ? "Edit Contact" : "New Contact"}
              </span>
            </div>
            <button type="button" onClick={closeForm} className="admin-btn--ghost p-1.5" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="admin-label">Full name</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="admin-input"
                placeholder="e.g. Marc Dupont"
              />
            </div>

            <div>
              <label className="admin-label">Email</label>
              <input
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="admin-input"
                placeholder="name@company.com"
              />
            </div>

            <div>
              <label className="admin-label">Phone</label>
              <input
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                className="admin-input"
                placeholder="+1-555-0100"
              />
            </div>

            <div>
              <label className="admin-label">Department</label>
              <input
                value={form.department}
                onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
                className="admin-input"
                placeholder="e.g. Sales"
              />
            </div>

            <div>
              <label className="admin-label">Specialization</label>
              <input
                value={form.specialization}
                onChange={(e) => setForm((f) => ({ ...f, specialization: e.target.value }))}
                className="admin-input"
                placeholder="e.g. Air Suspension"
              />
            </div>

            <div>
              <label className="admin-label">Display order</label>
              <input
                type="number"
                value={form.display_order}
                onChange={(e) => setForm((f) => ({ ...f, display_order: parseInt(e.target.value, 10) || 0 }))}
                className="admin-input"
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={form.is_available}
                onClick={() => setForm((f) => ({ ...f, is_available: !f.is_available }))}
                className="admin-toggle"
                data-checked={String(form.is_available)}
              />
              <label className="text-sm text-muted-foreground cursor-pointer select-none">
                Available in portal
              </label>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={isMutating || !form.name.trim()}
              className="admin-btn--primary px-6"
            >
              {isMutating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
              {editingId ? (updateMutation.isPending ? "Saving..." : "Save Changes") : createMutation.isPending ? "Creating..." : "Create Contact"}
            </button>
            <button type="button" onClick={closeForm} className="admin-btn--secondary px-6">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Contact cards (mobile) + table (desktop) */}
      <div className="md:hidden space-y-3">
        {filtered.map((c) => (
          <div key={c.id} className="dashboard-card">
            <div className="flex items-start gap-3">
              <div className="admin-avatar w-10 h-10 text-sm flex-shrink-0">
                {getInitials(c.name)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">{c.name}</span>
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${c.is_available ? "bg-success" : "bg-muted-foreground/30"}`} />
                </div>
                {c.department && <p className="text-xs text-muted-foreground mt-0.5">{c.department}{c.specialization ? ` · ${c.specialization}` : ""}</p>}
                <div className="flex flex-col gap-0.5 mt-2 text-xs text-muted-foreground">
                  {c.email && <span className="inline-flex items-center gap-1.5"><Mail className="h-3 w-3" /> {c.email}</span>}
                  {c.phone && <span className="inline-flex items-center gap-1.5"><Phone className="h-3 w-3" /> {c.phone}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button type="button" onClick={() => openEdit(c)} className="admin-btn--ghost p-1.5"><Pencil className="h-3.5 w-3.5" /></button>
                <button
                  type="button"
                  disabled={deleteMutation.isPending}
                  onClick={() => { if (confirm("Delete this admin contact?")) deleteMutation.mutate(c.id); }}
                  className="admin-btn--danger p-1.5 border-0"
                ><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto border border-border rounded-xl">
        <table className="w-full text-sm">
          <thead className="table-header">
            <tr>
              <th className="text-left p-3">Contact</th>
              <th className="text-left p-3">Department / Specialization</th>
              <th className="text-left p-3">Available</th>
              <th className="text-right p-3">Order</th>
              <th className="text-right p-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((c) => (
              <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="admin-avatar w-8 h-8 text-[10px] flex-shrink-0">
                      {getInitials(c.name)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium">{c.name}</div>
                      {(c.email || c.phone) && (
                        <div className="text-xs text-muted-foreground mt-0.5 flex flex-col gap-0.5">
                          {c.email ? <span className="inline-flex items-center gap-1.5"><Mail className="h-3 w-3" /> {c.email}</span> : null}
                          {c.phone ? <span className="inline-flex items-center gap-1.5"><Phone className="h-3 w-3" /> {c.phone}</span> : null}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="p-3">
                  <div className="text-sm font-medium">
                    {c.department ? c.department : <span className="text-muted-foreground">—</span>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {c.specialization ? c.specialization : "No specialization"}
                  </div>
                </td>
                <td className="p-3">
                  <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${c.is_available ? "text-success" : "text-muted-foreground"}`}>
                    <span className={`w-2 h-2 rounded-full ${c.is_available ? "bg-success" : "bg-muted-foreground/30"}`} />
                    {c.is_available ? "Available" : "Unavailable"}
                  </span>
                </td>
                <td className="p-3 text-right font-mono text-xs">{c.display_order ?? 0}</td>
                <td className="p-3 text-right">
                  <div className="inline-flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEdit(c)}
                      className="admin-btn--ghost text-xs px-2 py-1"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </button>
                    <button
                      type="button"
                      disabled={deleteMutation.isPending}
                      onClick={() => {
                        if (!confirm("Delete this admin contact?")) return;
                        deleteMutation.mutate(c.id);
                      }}
                      className="admin-btn--danger text-xs px-2 py-1 border-0"
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

      {filtered.length === 0 && (
        <div className="dashboard-card text-center py-12">
          <UserRound className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No contacts found.</p>
        </div>
      )}
    </div>
  );
}

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Plus, Trash2, CheckCircle2, ListTodo, Loader2, X, Save,
  AlertTriangle, Clock, User as UserIcon, Building2,
} from "lucide-react";
import { api, type UpcomingTask, type User, type Customer } from "@/lib/api";
import { showErrorToast, showSuccessToast } from "@/lib/toast";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminPageLoading, AdminPageError } from "@/components/admin/AdminPageState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useConfirm } from "@/components/ConfirmDialog";

type Tab = "all" | "mine" | "soon" | "overdue" | "done";

type Draft = {
  id?: string;
  title: string;
  notes: string;
  due_at: string;
  priority: "low" | "normal" | "high";
  assigned_to: string;
  customer_id: string;
  customer_label?: string;
};

const EMPTY_DRAFT: Draft = {
  title: "",
  notes: "",
  due_at: "",
  priority: "normal",
  assigned_to: "",
  customer_id: "",
};

function priorityClass(p?: string) {
  if (p === "high") return "bg-red-100 text-red-700 border-red-200";
  if (p === "low") return "bg-slate-100 text-slate-600 border-slate-200";
  return "bg-blue-50 text-blue-700 border-blue-200";
}

function fmtDue(d: string | null | undefined): { label: string; tone: "muted" | "warn" | "danger" | "ok" } {
  if (!d) return { label: "No due date", tone: "muted" };
  const dt = new Date(d);
  const now = Date.now();
  const diff = dt.getTime() - now;
  const abs = Math.abs(diff);
  const hours = Math.round(abs / 3600000);
  const days = Math.round(abs / 86400000);
  const human = days >= 1 ? `${days}d` : `${hours}h`;
  if (diff < 0) return { label: `Overdue by ${human}`, tone: "danger" };
  if (diff < 2 * 3600000) return { label: `Due in ${human}`, tone: "danger" };
  if (diff < 24 * 3600000) return { label: `Due in ${human}`, tone: "warn" };
  return { label: `Due ${dt.toLocaleDateString()}`, tone: "ok" };
}

export default function AdminTasks() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const confirmAction = useConfirm();

  const [tab, setTab] = useState<Tab>("all");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);

  const filters = useMemo(() => {
    if (tab === "mine") return { assigned_to: "me", status: "open" };
    if (tab === "done") return { status: "done" };
    if (tab === "overdue") return { status: "open", due_before: new Date().toISOString().slice(0, 19).replace("T", " ") };
    if (tab === "soon") {
      const in48 = new Date(Date.now() + 48 * 3600 * 1000);
      return { status: "open", due_before: in48.toISOString().slice(0, 19).replace("T", " ") };
    }
    return {};
  }, [tab]);

  const tasksQ = useQuery({
    queryKey: ["tasks", tab],
    queryFn: () => api.listTasks(filters as Parameters<typeof api.listTasks>[0]),
  });
  const tasks: UpcomingTask[] = (tasksQ.data?.data as UpcomingTask[]) || [];

  const usersQ = useQuery({
    queryKey: ["admin-users-for-tasks"],
    queryFn: () => api.getUsers(1, 100),
  });
  const users: User[] = (usersQ.data?.data as User[]) || [];

  const createMut = useMutation({ mutationFn: (p: Parameters<typeof api.createTask>[0]) => api.createTask(p) });
  const updateMut = useMutation({ mutationFn: ({ id, p }: { id: string; p: Parameters<typeof api.updateTask>[1] }) => api.updateTask(id, p) });
  const deleteMut = useMutation({ mutationFn: (id: string) => api.deleteTask(id) });

  async function searchCustomers(q: string) {
    setCustomerQuery(q);
    if (q.trim().length < 2) { setCustomerResults([]); return; }
    try {
      const r = await api.searchCustomers(q.trim());
      setCustomerResults((r.data as Customer[]) || []);
    } catch { setCustomerResults([]); }
  }

  async function saveDraft() {
    if (!draft) return;
    if (!draft.title.trim()) return showErrorToast("Task", "Title is required");
    const payload = {
      title: draft.title.trim(),
      notes: draft.notes || null,
      due_at: draft.due_at || null,
      priority: draft.priority,
      assigned_to: draft.assigned_to || null,
      customer_id: draft.customer_id || null,
    };
    try {
      if (draft.id) {
        await updateMut.mutateAsync({ id: draft.id, p: payload });
        showSuccessToast("Task", "Updated");
      } else {
        await createMut.mutateAsync(payload);
        showSuccessToast("Task", "Created");
      }
      setDraft(null);
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["customer-tasks"] });
    } catch (e) {
      showErrorToast("Task", e instanceof Error ? e.message : "Save failed");
    }
  }

  async function toggleDone(t: UpcomingTask) {
    try {
      await updateMut.mutateAsync({ id: t.id, p: { status: t.status === "done" ? "open" : "done" } });
      qc.invalidateQueries({ queryKey: ["tasks"] });
    } catch (e) {
      showErrorToast("Task", e instanceof Error ? e.message : "Update failed");
    }
  }

  async function removeTask(t: UpcomingTask) {
    const ok = await confirmAction({ title: "Delete task", message: `Delete "${t.title}"?`, variant: "danger" });
    if (!ok) return;
    try {
      await deleteMut.mutateAsync(t.id);
      showSuccessToast("Task", "Deleted");
      qc.invalidateQueries({ queryKey: ["tasks"] });
    } catch (e) {
      showErrorToast("Task", e instanceof Error ? e.message : "Delete failed");
    }
  }

  function openCustomer(t: UpcomingTask) {
    if (!t.customer_id) return;
    const cat = t.customer_category || "customer";
    const base = cat === "lead" ? "/admin/leads" : cat === "contract" ? "/admin/contract-customers" : "/admin/customers";
    navigate(`${base}/${t.customer_id}?tab=tasks&highlight=${t.id}`);
  }

  if (tasksQ.isLoading) return <AdminPageLoading message="Loading tasks..." />;
  if (tasksQ.isError) return <AdminPageError message="Failed to load tasks" onRetry={tasksQ.refetch} />;

  const tabs: { id: Tab; label: string; icon: JSX.Element }[] = [
    { id: "all", label: "All", icon: <ListTodo className="w-4 h-4" /> },
    { id: "mine", label: "Assigned to me", icon: <UserIcon className="w-4 h-4" /> },
    { id: "soon", label: "Due soon", icon: <Clock className="w-4 h-4" /> },
    { id: "overdue", label: "Overdue", icon: <AlertTriangle className="w-4 h-4" /> },
    { id: "done", label: "Done", icon: <CheckCircle2 className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        icon={ListTodo}
        title="Tasks & Reminders"
        subtitle="All your tasks in one place — linked to a customer or not."
        actions={
          <Button size="sm" onClick={() => setDraft({ ...EMPTY_DRAFT })}>
            <Plus className="w-4 h-4 mr-2" /> New Task
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2">
        {tabs.map(tt => (
          <button
            key={tt.id}
            onClick={() => setTab(tt.id)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition ${tab === tt.id ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted border-border"}`}
          >
            {tt.icon} {tt.label}
          </button>
        ))}
      </div>

      <div className="bg-card border rounded-lg divide-y">
        {tasks.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">No tasks in this view.</div>
        )}
        {tasks.map((t) => {
          const due = fmtDue(t.due_at);
          const toneClass = due.tone === "danger" ? "text-red-600" : due.tone === "warn" ? "text-amber-600" : due.tone === "ok" ? "text-emerald-600" : "text-muted-foreground";
          return (
            <div key={t.id} className="p-4 flex items-start gap-3">
              <button
                onClick={() => toggleDone(t)}
                className="mt-0.5 shrink-0"
                title={t.status === "done" ? "Mark as open" : "Mark as done"}
              >
                <CheckCircle2 className={`w-5 h-5 ${t.status === "done" ? "text-emerald-600" : "text-muted-foreground hover:text-emerald-600"}`} />
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className={`font-medium ${t.status === "done" ? "line-through text-muted-foreground" : ""}`}>{t.title}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${priorityClass(t.priority)}`}>{t.priority || "normal"}</span>
                  <span className={`text-xs ${toneClass}`}>{due.label}</span>
                </div>
                {t.notes && (
                  <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap line-clamp-3">{t.notes}</p>
                )}
                <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                  {t.customer_id && (
                    <button onClick={() => openCustomer(t)} className="inline-flex items-center gap-1 hover:text-primary">
                      <Building2 className="w-3 h-3" />
                      {t.company_name || t.contact_person || t.customer_email || "Customer"}
                    </button>
                  )}
                  {t.assignee_name && (
                    <span className="inline-flex items-center gap-1">
                      <UserIcon className="w-3 h-3" /> {t.assignee_name}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="sm" onClick={() => setDraft({
                  id: t.id,
                  title: t.title,
                  notes: t.notes || "",
                  due_at: t.due_at ? new Date(t.due_at).toISOString().slice(0, 16) : "",
                  priority: (t.priority as Draft["priority"]) || "normal",
                  assigned_to: t.assigned_to || "",
                  customer_id: t.customer_id || "",
                  customer_label: t.company_name || t.contact_person || undefined,
                })}>Edit</Button>
                <Button variant="ghost" size="sm" onClick={() => removeTask(t)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {draft && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setDraft(null)}>
          <div className="bg-card rounded-lg border shadow-lg w-full max-w-lg p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{draft.id ? "Edit task" : "New task"}</h3>
              <Button variant="ghost" size="sm" onClick={() => setDraft(null)}><X className="w-4 h-4" /></Button>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Title</label>
              <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="e.g. Follow up with Acme Inc." />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Notes</label>
              <Textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Due date</label>
                <Input type="datetime-local" value={draft.due_at} onChange={(e) => setDraft({ ...draft, due_at: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Priority</label>
                <select
                  className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                  value={draft.priority}
                  onChange={(e) => setDraft({ ...draft, priority: e.target.value as Draft["priority"] })}
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Assignee</label>
              <select
                className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                value={draft.assigned_to}
                onChange={(e) => setDraft({ ...draft, assigned_to: e.target.value })}
              >
                <option value="">— Unassigned —</option>
                {users.filter((u) => u.role !== "user").map((u) => (
                  <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
                ))}
                {users.length === 0 && <option value="" disabled>Loading…</option>}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Linked customer (optional)</label>
              {draft.customer_id ? (
                <div className="flex items-center justify-between gap-2 rounded border px-3 py-2 text-sm">
                  <span className="truncate">
                    <Building2 className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />
                    {draft.customer_label || draft.customer_id}
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => setDraft({ ...draft, customer_id: "", customer_label: undefined })}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <Input
                    placeholder="Type to search customers…"
                    value={customerQuery}
                    onChange={(e) => searchCustomers(e.target.value)}
                  />
                  {customerResults.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-popover border rounded-md shadow max-h-56 overflow-auto">
                      {customerResults.slice(0, 20).map((c) => (
                        <button
                          key={c.id}
                          className="w-full text-left px-3 py-2 hover:bg-muted text-sm"
                          onClick={() => {
                            setDraft({ ...draft, customer_id: c.id, customer_label: c.company_name || c.contact_person || c.email || c.id });
                            setCustomerQuery("");
                            setCustomerResults([]);
                          }}
                        >
                          <span className="font-medium">{c.company_name || c.contact_person || c.email}</span>
                          {c.email && <span className="text-muted-foreground"> · {c.email}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDraft(null)}>Cancel</Button>
              <Button onClick={saveDraft} disabled={createMut.isPending || updateMut.isPending}>
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

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, Bell, CheckCircle2, Clock, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useUpcomingTasks, markTaskDoneWithAdminToken } from "@/hooks/useUpcomingTasks";
import { type UpcomingTask } from "@/lib/api";
import { showErrorToast, showSuccessToast } from "@/lib/toast";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Tiered reminder system. The modal re-appears each time a task crosses
 * into a more urgent tier (48h → 24h → 2h → overdue), even if the user
 * dismissed the previous tier. Once a tier is dismissed, that tier stays
 * snoozed until the task moves into the next, smaller tier.
 */
type ReminderTier = "overdue" | "2h" | "24h" | "48h";
/** Ordered most-urgent → least-urgent. */
const TIER_ORDER: ReminderTier[] = ["overdue", "2h", "24h", "48h"];

function currentTier(dueAt: string): ReminderTier | null {
  const diffMs = new Date(dueAt).getTime() - Date.now();
  if (diffMs < 0) return "overdue";
  const diffH = diffMs / (1000 * 60 * 60);
  if (diffH <= 2) return "2h";
  if (diffH <= 24) return "24h";
  if (diffH <= 48) return "48h";
  return null;
}

function dismissKey(taskId: string) {
  return `task_reminder_dismissed_tier_${taskId}`;
}
function getDismissedTier(taskId: string): ReminderTier | null {
  try {
    const v = localStorage.getItem(dismissKey(taskId));
    return v && (TIER_ORDER as string[]).includes(v) ? (v as ReminderTier) : null;
  } catch { return null; }
}
function setDismissedTier(taskId: string, tier: ReminderTier) {
  try { localStorage.setItem(dismissKey(taskId), tier); } catch { /* noop */ }
}

/** Show only if current tier is strictly MORE URGENT than the dismissed one. */
function shouldShow(taskId: string, dueAt: string): boolean {
  const tier = currentTier(dueAt);
  if (!tier) return false;
  const dismissed = getDismissedTier(taskId);
  if (!dismissed) return true;
  return TIER_ORDER.indexOf(tier) < TIER_ORDER.indexOf(dismissed);
}

function formatDue(dueAt: string) {
  const d = new Date(dueAt);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffH = Math.round(diffMs / (1000 * 60 * 60));
  const dateLabel = d.toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
  if (diffMs < 0) return { label: dateLabel, badge: "Overdue", overdue: true, urgent: true, diffH: Math.abs(diffH) };
  if (diffH < 1) return { label: dateLabel, badge: "Due now", overdue: false, urgent: true, diffH };
  if (diffH <= 2) return { label: dateLabel, badge: `Due in ${diffH}h`, overdue: false, urgent: true, diffH };
  if (diffH < 24) return { label: dateLabel, badge: `Due in ${diffH}h`, overdue: false, urgent: false, diffH };
  if (diffH < 48) return { label: dateLabel, badge: `Due in ${diffH}h`, overdue: false, urgent: false, diffH };
  return { label: dateLabel, badge: "Due soon", overdue: false, urgent: false, diffH };
}

/** Visual mapping for the customer-segment badge shown next to each reminder. */
function categoryBadge(task: UpcomingTask): { label: string; className: string } {
  const cat = (task.customer_category ?? "customer") as "lead" | "customer" | "contract";
  if (cat === "lead") {
    return {
      label: "Lead",
      className: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-400 dark:border-violet-800",
    };
  }
  if (cat === "contract") {
    return {
      label: task.contract_validated ? "Contract" : "Contract (unvalidated)",
      className: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950 dark:text-teal-400 dark:border-teal-800",
    };
  }
  return {
    label: "Customer",
    className: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800",
  };
}

interface Props {
  /** Disable polling/render (e.g. on the chat page where it would be noisy). */
  enabled?: boolean;
}

export function TaskReminderModal({ enabled = true }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { tasks, refresh, hasAdminToken } = useUpcomingTasks(enabled);
  const [open, setOpen] = useState(false);
  const [recheckTick, setRecheckTick] = useState(0);
  const [completing, setCompleting] = useState<string | null>(null);

  // Tasks that should show right now (tier-aware). Recomputes on tick.
  const pending = useMemo(
    () => tasks.filter((t) => shouldShow(t.id, t.due_at)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasks, recheckTick],
  );

  // Open modal whenever there's at least one pending tier
  useEffect(() => {
    if (pending.length > 0) setOpen(true);
    else setOpen(false);
  }, [pending.length]);

  // Re-evaluate every minute so tasks "advance" into 24h / 2h / overdue
  useEffect(() => {
    if (!enabled) return;
    const i = setInterval(() => {
      setRecheckTick((n) => n + 1);
      refresh();
    }, 60_000);
    return () => clearInterval(i);
  }, [enabled, refresh]);

  const dismissOne = (taskId: string, dueAt: string) => {
    const tier = currentTier(dueAt);
    if (tier) setDismissedTier(taskId, tier);
    setRecheckTick((n) => n + 1);
  };

  const dismissAll = () => {
    for (const t of pending) {
      const tier = currentTier(t.due_at);
      if (tier) setDismissedTier(t.id, tier);
    }
    setRecheckTick((n) => n + 1);
    setOpen(false);
  };

  const goToCustomer = (task: UpcomingTask) => {
    setOpen(false);
    // Route to the correct admin page based on customer segment so contract customers
    // and leads land on their dedicated pages instead of the normal customers list.
    const cat = (task.customer_category ?? "customer") as "lead" | "customer" | "contract";
    const base =
      cat === "lead"
        ? "/admin/leads"
        : cat === "contract"
          ? "/admin/contract-customers"
          : "/admin/customers";
    navigate(`${base}/${task.customer_id}?tab=tasks&highlight=${task.id}`);
  };

  const markDone = async (task: UpcomingTask) => {
    setCompleting(task.id);
    try {
      await markTaskDoneWithAdminToken(task.id);
      showSuccessToast("Task", "Marked as done");
      queryClient.invalidateQueries({ queryKey: ["customer", task.customer_id] });
      queryClient.invalidateQueries({ queryKey: ["customer-tasks"] });
      await refresh();
    } catch (e) {
      showErrorToast("Task", e instanceof Error ? e.message : "Failed to update task");
    } finally {
      setCompleting(null);
    }
  };

  if (!enabled || !hasAdminToken || pending.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-amber-500" />
            Task Reminders
            <Badge variant="secondary" className="ml-1">{pending.length}</Badge>
          </DialogTitle>
          <DialogDescription>
            You'll be reminded again as each task gets closer (48h → 24h → 2h → overdue).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
          {pending.map((task) => {
            const due = formatDue(task.due_at);
            return (
              <div
                key={task.id}
                className={`rounded-lg border p-3 ${
                  due.overdue
                    ? "border-destructive/40 bg-destructive/5"
                    : due.urgent
                      ? "border-orange-400/60 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-700/60"
                      : "border-amber-300/60 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-700/60"
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                        due.overdue
                          ? "bg-destructive text-destructive-foreground"
                          : due.urgent
                            ? "bg-orange-500 text-white"
                            : "bg-amber-500 text-white"
                      }`}>
                        {due.overdue ? <AlertCircle className="h-3 w-3 inline mr-1" /> : <Clock className="h-3 w-3 inline mr-1" />}
                        {due.badge}
                      </span>
                      <span className="text-xs text-muted-foreground">{due.label}</span>
                    </div>
                    <p className="font-semibold text-sm mt-1.5 break-words">{task.title}</p>
                    <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                      <button
                        type="button"
                        onClick={() => goToCustomer(task)}
                        className="text-xs text-primary hover:underline truncate text-left max-w-[220px]"
                      >
                        {task.company_name || task.contact_person || task.email || "Customer"}
                      </button>
                      {(() => {
                        const cb = categoryBadge(task);
                        return (
                          <span
                            className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${cb.className}`}
                            title={`Customer segment: ${cb.label}`}
                          >
                            {cb.label}
                          </span>
                        );
                      })()}
                    </div>
                    {task.notes && (
                      <p className="text-xs text-muted-foreground mt-1.5 whitespace-pre-wrap line-clamp-3">{task.notes}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => dismissOne(task.id, task.due_at)}
                    className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-background/50 flex-shrink-0"
                    title="Snooze until next reminder tier"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex gap-2 justify-end items-center">
                  <Button size="sm" variant="ghost" onClick={() => dismissOne(task.id, task.due_at)}>
                    Snooze
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => goToCustomer(task)}>
                    Open Customer
                  </Button>
                  <Button
                    size="sm"
                    variant="default"
                    className="font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => markDone(task)}
                    disabled={completing === task.id}
                    title="Complete this task"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                    {completing === task.id ? "Saving…" : "Mark as Done"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-between items-center pt-2 border-t">
          <p className="text-xs text-muted-foreground">
            Reminders re-appear at 48h, 24h, 2h, and once overdue.
          </p>
          <Button variant="ghost" size="sm" onClick={dismissAll}>
            Snooze all
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import React, { useMemo, useState, useRef, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useConfirm } from "@/components/ConfirmDialog";
import {
  Eye, EyeOff, Search, X, Mail, Phone, ArrowLeft, ShoppingBag, FileText, Edit, Ban,
  CheckCircle, Plus, Loader2, AlertCircle, Upload, Trash2, ExternalLink, Download,
  MessageSquareText, CalendarClock, UserRound, Clock, ListTodo, CheckCircle2,
  XCircle, FolderOpen, Copy, Check, Building2, MapPin, CreditCard, Truck,
  Hash, Globe, User, Briefcase, DollarSign, Package, MoreHorizontal, KeyRound, Save, Bell,
} from "lucide-react";
import {
  useCustomers, useCustomer, useCustomerOrders, useCustomerDocuments,
  useCustomerTasks, useCreateCustomerTask, useUpdateCustomerTask,
  useDeleteCustomerTask, useAvailableAdminContacts, useApiMutation,
} from "@/hooks/useApi";
import { useUpcomingTasks } from "@/hooks/useUpcomingTasks";
import {
  api, Customer, CustomerNote, CustomerTask, Order,
  unwrapApiList, unwrapPagination, resolveBackendUploadUrl,
} from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { showSuccessToast, showErrorToast } from "@/lib/toast";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminPageError, AdminPageLoading } from "@/components/admin/AdminPageState";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CustomerQboPanel } from "@/components/admin/CustomerQboPanel";

type CustomerDocumentRow = {
  id: string; document_type: string; file_url: string;
  file_name: string; uploaded_by: string | null; created_at: string;
};

function toNumber(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const n = parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
}

/* ── Field display ── */
function FieldValue({ label, value, className }: { label: string; value?: string | number | null; className?: string }) {
  const display = value != null && String(value).trim() !== "" ? String(value) : "—";
  const isEmpty = display === "—";
  return (
    <div className={className}>
      <dt className="text-xs font-medium text-muted-foreground mb-0.5">{label}</dt>
      <dd className={`text-sm ${isEmpty ? "text-muted-foreground/40 italic" : "text-foreground font-medium"}`}>{display}</dd>
    </div>
  );
}

/* ── Stat ── */
function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string | number; color: string }) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
          </div>
          <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${color}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Initials avatar ── */
function CustomerAvatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const sizes = { sm: "h-8 w-8 text-xs", md: "h-12 w-12 text-sm", lg: "h-16 w-16 text-lg" };
  return (
    <div className={`${sizes[size]} rounded-lg bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0`}>
      {initials}
    </div>
  );
}

export default function AdminCustomers({ contractOnly = false, leadOnly = false }: { contractOnly?: boolean; leadOnly?: boolean }) {
  const confirmAction = useConfirm();
  const { customerId } = useParams();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>(contractOnly ? "contract" : leadOnly ? "lead" : "all");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(customerId || null);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<Set<string>>(new Set());

  // Per-row resend-credentials status (in-memory, no reload).
  // 'sending' | 'sent' | 'failed' with timestamp + last message for tooltip.
  type ResendStatus = { state: "sending" | "sent" | "failed"; at: number; message: string };
  const [resendStatus, setResendStatus] = useState<Record<string, ResendStatus>>({});
  const setRowResendStatus = (id: string, status: ResendStatus) =>
    setResendStatus(prev => ({ ...prev, [id]: status }));

  useEffect(() => { if (customerId) setSelectedCustomerId(customerId); }, [customerId]);

  // Upcoming/overdue tasks — used to highlight rows and to deep-link the Tasks tab
  const { tasks: upcomingTasks } = useUpcomingTasks();
  const customersWithDueTasks = useMemo(() => {
    const map = new Map<string, { count: number; overdue: number }>();
    const now = Date.now();
    for (const t of upcomingTasks) {
      const cur = map.get(t.customer_id) || { count: 0, overdue: 0 };
      cur.count++;
      if (new Date(t.due_at).getTime() < now) cur.overdue++;
      map.set(t.customer_id, cur);
    }
    return map;
  }, [upcomingTasks]);

  // Deep-link from reminder modal: ?tab=tasks&highlight=<taskId>
  const initialTab = searchParams.get("tab") || "overview";
  const highlightTaskId = searchParams.get("highlight");
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  useEffect(() => {
    const t = searchParams.get("tab");
    if (t) setActiveTab(t);
  }, [searchParams]);

  // Scroll to highlighted task once Tasks tab is mounted
  useEffect(() => {
    if (!highlightTaskId || activeTab !== "tasks") return;
    const i = setTimeout(() => {
      const el = document.getElementById(`task-${highlightTaskId}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 200);
    return () => clearTimeout(i);
  }, [highlightTaskId, activeTab, selectedCustomerId]);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [editTab, setEditTab] = useState("contact");
  const [showAdminPwd, setShowAdminPwd] = useState(false);
  const [adminPwdData, setAdminPwdData] = useState<{ has_account: boolean; email?: string; admin_password?: string | null } | null>(null);
  const [adminPwdLoading, setAdminPwdLoading] = useState(false);
  const [adminPwdInput, setAdminPwdInput] = useState("");
  const [adminPwdVisible, setAdminPwdVisible] = useState(false);
  const [adminPwdSaving, setAdminPwdSaving] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<CustomerDocumentRow | null>(null);

  const copyFormLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/apply`).then(() => {
      setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000);
    });
  };

  const [newCustomer, setNewCustomer] = useState({
    company_name: "", neq: "", tax_id: "", full_name: "", email: "", phone: "", fax: "", website: "",
    contact_title: "", contact_position: "",
    address: "", address_2: "", city: "", province: "", postal_code: "", country: "",
    billing_address: "", billing_address_2: "", billing_city: "", billing_province: "", billing_postal_code: "", billing_country: "",
    shipping_address: "", shipping_address_2: "", shipping_city: "", shipping_province: "", shipping_postal_code: "", shipping_country: "",
    fleet_details: "", brands_serviced: "",
    primary_contact_name: "", primary_contact_phone: "", primary_contact_email: "",
    ap_contact_name: "", ap_contact_email: "", ap_phone: "",
    payment_method: "", category: (contractOnly ? "contract" : leadOnly ? "lead" : "lead") as Customer["category"], create_account: true,
    initial_note: "", accountant_email: "",
  });

  const [editForm, setEditForm] = useState<Record<string, any>>({
    company_name: "", email: "", phone: "", fax: "", website: "",
    contact_person: "", contact_title: "", contact_position: "", customer_type: "", distributor_type: "",
    num_trucks: "", num_trailers: "",
    address: "", address_2: "", shipping_address: "", billing_address: "", city: "", province: "", postal_code: "", country: "",
    shipping_address_2: "", shipping_city: "", shipping_province: "", shipping_postal_code: "", shipping_country: "",
    billing_address_2: "", billing_city: "", billing_province: "", billing_postal_code: "", billing_country: "",
    payment_method: "", payment_terms: "", credit_limit: "", bank_reference: "",
    accounting_contact: "", accounting_phone: "", billing_email: "", accountant_email: "",
    neq_tva: "", tax_number: "",
    supplier_ref_1: "", supplier_ref_2: "",
    parts_needed: "", special_requests: "", sales_representative: "",
    price_augmentation_percent: "",
    status: "active" as Customer["status"], category: "lead" as Customer["category"],
    contract_validated: false,
  });

  const importInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const { data: customersResponse, isLoading, isError, error } = useCustomers(page, 50);
  const { data: customerDetailResponse } = useCustomer(selectedCustomerId || "");
  const { data: customerOrdersResponse } = useCustomerOrders(selectedCustomerId || "");
  const { data: customerDocumentsResponse } = useCustomerDocuments(selectedCustomerId || "");
  const { data: tasksResponse } = useCustomerTasks(selectedCustomerId || "");
  const { data: availableContactsResponse } = useAvailableAdminContacts();

  const createCustomerMutation = useApiMutation(
    (data: any) => api.createCustomer(data),
    {
      onSuccess: async (res) => {
        const customerId = res?.data?.id;
        const note = newCustomer.initial_note?.trim();
        if (customerId && note) {
          try { await api.addCustomerNote(customerId, { note, isInternal: true }); } catch {}
        }
        queryClient.invalidateQueries({ queryKey: ['customers'] });
        setShowCreateModal(false);
        setNewCustomer({ company_name: "", neq: "", tax_id: "", full_name: "", email: "", phone: "", fax: "", website: "", contact_title: "", contact_position: "", address: "", address_2: "", city: "", province: "", postal_code: "", country: "", billing_address: "", billing_address_2: "", billing_city: "", billing_province: "", billing_postal_code: "", billing_country: "", shipping_address: "", shipping_address_2: "", shipping_city: "", shipping_province: "", shipping_postal_code: "", shipping_country: "", fleet_details: "", brands_serviced: "", primary_contact_name: "", primary_contact_phone: "", primary_contact_email: "", ap_contact_name: "", ap_contact_email: "", ap_phone: "", payment_method: "", category: (contractOnly ? "contract" : leadOnly ? "lead" : "lead") as Customer["category"], create_account: true, initial_note: "", accountant_email: "" });
        showSuccessToast("Customers", t("admin.customers.created"));
      },
      onError: (e: unknown) => showErrorToast("Customers", e instanceof Error ? e.message : "Failed to create customer"),
    }
  );

  const updateCustomerMutation = useApiMutation(
    ({ id, data }: { id: string; data: any }) => api.updateCustomer(id, data),
    {
      onSuccess: () => {
        showSuccessToast("Customers", t("admin.customers.updated"));
        queryClient.invalidateQueries({ queryKey: ['customers'] });
        queryClient.invalidateQueries({ queryKey: ['customer'] });
        setShowEditModal(false);
      },
      onError: (e: unknown) => {
        const detail = e instanceof Error ? e.message : "Failed to update customer";
        const apiDetail = (e as any)?.details ? JSON.stringify((e as any).details) : "";
        showErrorToast("Customer Update Failed", `${detail}${apiDetail ? ` — ${apiDetail}` : ""}`);
        console.error("[Customer Update Error]", e);
      },
    }
  );

  const deleteCustomerMutation = useApiMutation(
    (id: string) => api.deleteCustomer(id),
    {
      onSuccess: () => {
        showSuccessToast("Customers", t("admin.customers.deleted"));
        queryClient.invalidateQueries({ queryKey: ['customers'] });
        setSelectedCustomerId(null);
      },
      onError: (e: unknown) => showErrorToast("Customers", e instanceof Error ? e.message : "Delete failed"),
    }
  );

  const uploadDocumentMutation = useApiMutation(
    ({ file, customerId }: { file: File; customerId: string }) =>
      api.uploadContractFile(file, { customerId, documentType: "contract" }),
    {
      onSuccess: (res, { customerId }) => {
        queryClient.invalidateQueries({ queryKey: ["customer", customerId, "documents"] });
        showSuccessToast("Documents", res.message || "Document uploaded.");
      },
      onError: (e: unknown) => showErrorToast("Documents", e instanceof Error ? e.message : "Upload failed"),
    }
  );

  const deleteDocumentMutation = useApiMutation(
    ({ documentId, customerId }: { documentId: string; customerId: string }) =>
      api.deleteCustomerDocument(documentId),
    {
      onSuccess: (res, { customerId }) => {
        queryClient.invalidateQueries({ queryKey: ["customer", customerId, "documents"] });
        showSuccessToast("Documents", res.message || "Document removed.");
      },
      onError: (e: unknown) => showErrorToast("Documents", e instanceof Error ? e.message : "Delete failed"),
    }
  );

  const importCustomersMutation = useApiMutation((file: File) => api.importCustomersFile(file), {
    onSuccess: (res) => { queryClient.invalidateQueries({ queryKey: ['customers'] }); showSuccessToast("Import", res.message || "Import completed."); },
    onError: (e: unknown) => showErrorToast("Import", e instanceof Error ? e.message : 'Import failed'),
  });

  const addCustomerNoteMutation = useApiMutation(
    (vars: { customerId: string; note: string; isInternal: boolean }) =>
      api.addCustomerNote(vars.customerId, { note: vars.note, isInternal: vars.isInternal }),
    {
      onSuccess: (_res, vars) => { queryClient.invalidateQueries({ queryKey: ['customer', vars.customerId] }); setNoteDraft(""); showSuccessToast("Notes", "Note added"); },
      onError: (e: unknown) => showErrorToast("Notes", e instanceof Error ? e.message : "Failed to add note"),
    }
  );

  const deleteCustomerNoteMutation = useApiMutation(
    (vars: { customerId: string; noteId: string }) =>
      api.deleteCustomerNote(vars.customerId, vars.noteId),
    {
      onSuccess: (_res, vars) => { queryClient.invalidateQueries({ queryKey: ['customer', vars.customerId] }); showSuccessToast("Notes", "Note deleted"); },
      onError: (e: unknown) => showErrorToast("Notes", e instanceof Error ? e.message : "Failed to delete note"),
    }
  );

  const updateCustomerNoteMutation = useApiMutation(
    (vars: { customerId: string; noteId: string; note: string; isInternal: boolean }) =>
      api.updateCustomerNote(vars.customerId, vars.noteId, { note: vars.note, isInternal: vars.isInternal }),
    {
      onSuccess: (_res, vars) => {
        queryClient.invalidateQueries({ queryKey: ['customer', vars.customerId] });
        setEditingNoteId(null);
        showSuccessToast("Notes", "Note updated");
      },
      onError: (e: unknown) => showErrorToast("Notes", e instanceof Error ? e.message : "Failed to update note"),
    }
  );

  const convertLeadMutation = useApiMutation(
    (customerId: string) => api.convertLeadToCustomer(customerId),
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['customers'] });
        queryClient.invalidateQueries({ queryKey: ['customer'] });
        showSuccessToast("Leads", "Lead converted to customer successfully");
      },
      onError: (e: unknown) => showErrorToast("Convert", e instanceof Error ? e.message : "Failed to convert"),
    }
  );
  const createTaskMutation = useCreateCustomerTask();
  const updateTaskMutation = useUpdateCustomerTask();
  const deleteTaskMutation = useDeleteCustomerTask();

  const customers = unwrapApiList<Customer>(customersResponse, []);
  const pagination = unwrapPagination(customersResponse);
  const selectedCustomer = customerDetailResponse?.data;
  const customerOrders: Order[] = unwrapApiList<Order>(customerOrdersResponse as any, []);
  const customerDocuments: CustomerDocumentRow[] = unwrapApiList<CustomerDocumentRow>(customerDocumentsResponse, []);
  const customerNotes: CustomerNote[] = (selectedCustomer?.notes ?? []) as CustomerNote[];
  const tasks: CustomerTask[] = unwrapApiList<CustomerTask>(tasksResponse as any, []);

  const adminContacts = useMemo(() => {
    return unwrapApiList<Record<string, unknown>>(availableContactsResponse as any, []).map((ac) => ({
      id: String(ac.id ?? ""), name: String(ac.name ?? "Contact"),
    }));
  }, [availableContactsResponse]);

  const [taskOwnerFilter, setTaskOwnerFilter] = useState<string>("all");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteIsInternal, setNoteIsInternal] = useState(true);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState("");
  const [editingNoteIsInternal, setEditingNoteIsInternal] = useState(true);
  const [taskDraft, setTaskDraft] = useState({ title: "", dueAtLocal: "", assignedTo: "", notes: "" });
  const [editingTask, setEditingTask] = useState<CustomerTask | null>(null);
  const [editTaskForm, setEditTaskForm] = useState({ title: "", dueAtLocal: "", assignedTo: "", notes: "" });

  const filteredTasks = useMemo(() => {
    const now = Date.now();
    return tasks.filter((t) => {
      if (taskOwnerFilter !== "all" && t.assigned_to !== taskOwnerFilter) return false;
      if (overdueOnly) { if (t.status !== "open" || !t.due_at) return false; return new Date(t.due_at).getTime() < now; }
      return true;
    });
  }, [tasks, taskOwnerFilter, overdueOnly]);

  const filtered = customers.filter((c: Customer) => {
    const s = search.toLowerCase();
    const matchesSearch = !search || c.company_name?.toLowerCase().includes(s) || c.full_name?.toLowerCase().includes(s) || c.email?.toLowerCase().includes(s);
    const matchesCategory = categoryFilter === "all" || c.category === categoryFilter;
    // Keep modules separate: in the default Customers view, hide contracts AND leads (each has its own page)
    if (!contractOnly && !leadOnly && categoryFilter === "all" && (c.category === "contract" || c.category === "lead")) return false;
    return matchesSearch && matchesCategory;
  });

  const handleToggleStatus = (customer: Customer) => {
    updateCustomerMutation.mutate({ id: customer.id, data: { status: customer.status === "active" ? "inactive" : "active" } });
  };

  const openEditModal = (c: Customer) => {
    const a = c as any;
    setEditForm({
      company_name: c.company_name || "",
      email: c.email || "", phone: c.phone || "",
      contact_person: a.contact_person || c.full_name || "",
      contact_title: a.contact_title || "",
      contact_position: a.contact_position || "",
      fax: a.fax || "",
      website: a.website || "",
      customer_type: a.customer_type || "", distributor_type: a.distributor_type || "",
      num_trucks: a.num_trucks ?? "", num_trailers: a.num_trailers ?? "",
      // Primary address
      address: a.address || "", address_2: a.address_2 || "",
      city: a.city || "", province: a.province || "",
      postal_code: a.postal_code || "", country: a.country || "",
      // Shipping
      shipping_address: a.shipping_address || "", shipping_address_2: a.shipping_address_2 || "",
      shipping_city: a.shipping_city || "", shipping_province: a.shipping_province || "",
      shipping_postal_code: a.shipping_postal_code || "", shipping_country: a.shipping_country || "",
      // Billing
      billing_address: a.billing_address || "", billing_address_2: a.billing_address_2 || "",
      billing_city: a.billing_city || "", billing_province: a.billing_province || "",
      billing_postal_code: a.billing_postal_code || "", billing_country: a.billing_country || "",
      payment_method: a.payment_method || "", payment_terms: a.payment_terms || "",
      credit_limit: a.credit_limit ?? "", bank_reference: a.bank_reference || "",
      accounting_contact: a.accounting_contact || "", accounting_phone: a.accounting_phone || "",
      billing_email: a.billing_email || "", accountant_email: a.accountant_email || "",
      neq_tva: a.neq_tva || "", tax_number: a.tax_number || "",
      sales_representative: a.sales_representative || "",
      supplier_ref_1: a.supplier_ref_1 || "", supplier_ref_2: a.supplier_ref_2 || "",
      parts_needed: a.parts_needed || "", special_requests: a.special_requests || "",
      price_augmentation_percent: a.price_augmentation_percent ?? "",
      status: c.status, category: c.category || "lead",
      contract_validated: !!(a.contract_validated),
    });
    setShowEditModal(true);
  };

  const handleEditCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) return;
    updateCustomerMutation.mutate({ id: selectedCustomerId, data: editForm });
  };

  const handleCreateCustomer = (e: React.FormEvent) => { e.preventDefault(); createCustomerMutation.mutate(newCustomer); };
  const handleImportCustomersChange = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) importCustomersMutation.mutate(file); e.target.value = ""; };
  const handleDocumentFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file && selectedCustomerId) uploadDocumentMutation.mutate({ file, customerId: selectedCustomerId }); e.target.value = ""; };

  const fetchAdminPassword = async (custId: string) => {
    setAdminPwdLoading(true); setAdminPwdData(null); setAdminPwdInput(""); setAdminPwdVisible(false);
    try {
      const res = await api.getCustomerAdminPassword(custId);
      const d = res.data;
      setAdminPwdData(d ?? { has_account: false });
      setAdminPwdInput(d?.admin_password || "");
      setShowAdminPwd(true);
    } catch (e) { showErrorToast("Admin Password", e instanceof Error ? e.message : "Failed to fetch"); }
    finally { setAdminPwdLoading(false); }
  };
  const saveAdminPassword = async (custId: string) => {
    if (!adminPwdInput.trim()) return; setAdminPwdSaving(true);
    try {
      await api.setCustomerAdminPassword(custId, adminPwdInput.trim());
      showSuccessToast("Admin Password", "Admin password saved");
      setAdminPwdData(prev => prev ? { ...prev, admin_password: adminPwdInput.trim() } : prev);
    } catch (e) { showErrorToast("Admin Password", e instanceof Error ? e.message : "Failed to save"); }
    finally { setAdminPwdSaving(false); }
  };
  const removeAdminPassword = async (custId: string) => {
    setAdminPwdSaving(true);
    try {
      await api.removeCustomerAdminPassword(custId);
      showSuccessToast("Admin Password", "Admin password removed");
      setAdminPwdData(prev => prev ? { ...prev, admin_password: null } : prev);
      setAdminPwdInput("");
    } catch (e) { showErrorToast("Admin Password", e instanceof Error ? e.message : "Failed to remove"); }
    finally { setAdminPwdSaving(false); }
  };

  if (isLoading) return <AdminPageLoading message="Loading customers" />;
  if (isError) return <AdminPageError message={error instanceof Error ? error.message : "Error loading customers"} onRetry={() => queryClient.invalidateQueries({ queryKey: ["customers"] })} />;

  /* ═══════════════════════════════════════════════
   * EDIT MODAL — must be checked BEFORE detail view
   * so it isn't swallowed by the detail view's early return
   * ═══════════════════════════════════════════════ */
  if (showEditModal && selectedCustomerId) {
    const ef = editForm;
    const upd = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setEditForm(prev => ({ ...prev, [field]: e.target.value }));

    const sectionIcon = (Icon: React.ElementType, label: string) => (
      <div className="flex items-center gap-2.5">
        <div className="p-1.5 rounded-lg bg-primary/10"><Icon className="h-4 w-4 text-primary" /></div>
        <div>
          <h3 className="text-sm font-bold text-foreground">{label}</h3>
        </div>
      </div>
    );

    const fieldGroup = (label: string, children: React.ReactNode, required?: boolean, span2?: boolean) => (
      <div className={`space-y-1.5 ${span2 ? "md:col-span-2" : ""}`}>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {label}{required && <span className="text-destructive ml-0.5">*</span>}
        </Label>
        {children}
      </div>
    );

    const selectField = (value: string, onChange: (e: any) => void, options: { value: string; label: string }[]) => (
      <Select value={value} onValueChange={(v) => onChange({ target: { value: v } } as any)}>
        <SelectTrigger className="h-10"><SelectValue placeholder="Select..." /></SelectTrigger>
        <SelectContent>
          {options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    );

    const editTabs = [
      { id: "contact", label: t("admin.customers.contact_info") || "Contact", icon: User },
      { id: "company", label: t("admin.customers.company_details") || "Company", icon: Building2 },
      { id: "address", label: t("admin.customers.addresses") || "Addresses", icon: MapPin },
      { id: "billing", label: t("admin.customers.payment_accounting") || "Billing", icon: CreditCard },
      { id: "other", label: t("admin.customers.supplier_refs") || "Other", icon: FileText },
    ];

    return (
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setShowEditModal(false)} className="rounded-xl h-10 w-10">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-black tracking-tight text-foreground">
                {t("admin.edit") || "Edit"} {ef.company_name || ef.contact_person || "Customer"}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">Update customer information and settings</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={ef.status === "active"
              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400"
              : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400"
            }>
              {ef.status}
            </Badge>
            <Badge variant="outline" className={ef.category === "customer"
              ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400"
              : ef.category === "contract"
              ? "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950 dark:text-teal-400"
              : "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-400"
            }>
              {ef.category || "lead"}
            </Badge>
          </div>
        </div>

        <form onSubmit={handleEditCustomer}>
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Sidebar navigation */}
            <nav className="lg:w-56 shrink-0">
              <div className="lg:sticky lg:top-4 space-y-1 bg-card rounded-xl border border-border p-2">
                {editTabs.map(tab => {
                  const Icon = tab.icon;
                  const active = editTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setEditTab(tab.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                        active
                          ? "bg-primary/10 text-primary font-bold"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      }`}
                    >
                      <Icon className={`h-4 w-4 shrink-0 ${active ? "text-primary" : ""}`} />
                      <span className="truncate">{tab.label}</span>
                    </button>
                  );
                })}

                <Separator className="my-2" />

                {/* Status + Category quick edit */}
                <div className="px-3 py-2 space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t("admin.status")}</Label>
                    {selectField(ef.status, upd("status"), [
                      { value: "active", label: t("admin.active") || "Active" },
                      { value: "inactive", label: t("admin.inactive") || "Inactive" },
                    ])}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t("admin.customers.category")}</Label>
                    {selectField(ef.category, (e: React.ChangeEvent<HTMLSelectElement>) => {
                      const val = e.target.value;
                      setEditForm(prev => ({
                        ...prev,
                        category: val,
                        ...(val === "contract" ? { contract_validated: true } : {}),
                      }));
                    }, [
                      { value: "lead", label: t("admin.lead") || "Lead" },
                      { value: "customer", label: t("admin.customer") || "Customer" },
                      { value: "contract", label: t("admin.contract") || "Contract" },
                    ])}
                  </div>
                  {ef.category === "contract" && (
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t("admin.customers.contract_validated")}</Label>
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={!!ef.contract_validated}
                          onChange={(e) => setEditForm(prev => ({ ...prev, contract_validated: e.target.checked }))}
                          className="rounded border-input accent-accent h-4 w-4"
                        />
                        <span className="text-xs text-foreground">{t("admin.customers.can_pay_by_contract")}</span>
                      </label>
                    </div>
                  )}
                </div>
              </div>
            </nav>

            {/* Main content */}
            <div className="flex-1 space-y-6">
              {/* Contact Info */}
              {editTab === "contact" && (
                <Card className="shadow-sm border-border">
                  <CardHeader className="pb-4 border-b border-border bg-muted/30">
                    {sectionIcon(User, t("admin.customers.contact_info") || "Contact Information")}
                    <CardDescription className="mt-1.5 ml-9">Primary contact details and representative info</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="grid md:grid-cols-2 gap-5">
                      {fieldGroup(t("admin.customers.contact_person") || "Contact Person", <Input value={ef.contact_person} onChange={upd("contact_person")} placeholder="John Doe (optional)" />)}
                      {fieldGroup(t("admin.customers.title_field") || "Title", <Input value={ef.contact_title} onChange={upd("contact_title")} placeholder="e.g. Mr./Mrs." />)}
                      {fieldGroup("Position / Role", <Input value={ef.contact_position} onChange={upd("contact_position")} placeholder="e.g. Fleet Manager, Owner" />)}
                      {fieldGroup(t("admin.email"), <Input type="email" value={ef.email} onChange={upd("email")} placeholder="email@company.com" />)}
                      {fieldGroup(t("admin.phone"), <Input type="tel" value={ef.phone} onChange={upd("phone")} placeholder="+1 (555) 000-0000" />)}
                      {fieldGroup("Fax", <Input type="tel" value={ef.fax} onChange={upd("fax")} placeholder="+1 (555) 000-0000" />)}
                      {fieldGroup(t("admin.customers.sales_rep") || "Sales Representative", <Input value={ef.sales_representative} onChange={upd("sales_representative")} placeholder="Assigned rep" />)}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Company Details */}
              {editTab === "company" && (
                <Card className="shadow-sm border-border">
                  <CardHeader className="pb-4 border-b border-border bg-muted/30">
                    {sectionIcon(Building2, t("admin.customers.company_details") || "Company Details")}
                    <CardDescription className="mt-1.5 ml-9">Business registration, fleet, and operational details</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="grid md:grid-cols-2 gap-5">
                      {fieldGroup(t("admin.customers.company_name") || "Company Name", <Input value={ef.company_name} onChange={upd("company_name")} placeholder="ACME Industries Inc." />)}
                      {fieldGroup(t("admin.customers.customer_type") || "Customer Type",
                        selectField(ef.customer_type || "_none", (e: any) => upd("customer_type")({ target: { value: e.target.value === "_none" ? "" : e.target.value } } as any), [
                          { value: "_none", label: "— Select —" },
                          { value: "Retail", label: t("admin.retail") || "Retail" },
                          { value: "Wholesale", label: t("admin.wholesale") || "Wholesale" },
                          { value: "Fleet", label: t("admin.fleet") || "Fleet" },
                          { value: "Distributor", label: t("admin.distributor") || "Distributor" },
                        ])
                      )}
                      {fieldGroup(t("admin.customers.distributor_type") || "Distributor Type", <Input value={ef.distributor_type} onChange={upd("distributor_type")} placeholder="Type of distribution" />)}
                      {fieldGroup(t("admin.customers.neq_tva") || "NEQ / TVA", <Input value={ef.neq_tva} onChange={upd("neq_tva")} placeholder="NEQ or TVA number" />)}
                      {fieldGroup(t("admin.customers.tax_number") || "Tax Number", <Input value={ef.tax_number} onChange={upd("tax_number")} placeholder="Tax registration #" />)}
                      {fieldGroup(t("admin.customers.website") || "Website", <Input type="url" value={ef.website} onChange={upd("website")} placeholder="https://example.com" />)}
                    </div>

                    <Separator className="my-6" />
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                      <Truck className="h-3.5 w-3.5" /> Fleet Information
                    </h4>
                    <div className="grid md:grid-cols-2 gap-5">
                      {fieldGroup(t("admin.customers.num_trucks") || "Number of Trucks", <Input type="number" min={0} value={ef.num_trucks} onChange={upd("num_trucks")} placeholder="0" />)}
                      {fieldGroup(t("admin.customers.num_trailers") || "Number of Trailers", <Input type="number" min={0} value={ef.num_trailers} onChange={upd("num_trailers")} placeholder="0" />)}
                      {fieldGroup(t("admin.customers.parts_needed") || "Parts Needed", <Textarea value={ef.parts_needed} onChange={upd("parts_needed")} rows={3} placeholder="List specific parts or categories needed..." />, false, true)}
                      {fieldGroup(t("admin.customers.special_requests") || "Special Requests", <Textarea value={ef.special_requests} onChange={upd("special_requests")} rows={3} placeholder="Any special requirements or notes..." />, false, true)}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Addresses */}
              {editTab === "address" && (
                <Card className="shadow-sm border-border">
                  <CardHeader className="pb-4 border-b border-border bg-muted/30">
                    {sectionIcon(MapPin, t("admin.customers.addresses") || "Addresses")}
                    <CardDescription className="mt-1.5 ml-9">Primary, shipping, and billing address details</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-6">
                    {/* Primary */}
                    <div>
                      <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                        <Globe className="h-3.5 w-3.5" /> Primary Address
                      </h4>
                      <div className="grid md:grid-cols-2 gap-5">
                        {fieldGroup(t("admin.customers.address") || "Street Address", <Input value={ef.address} onChange={upd("address")} placeholder="123 Main Street" />, false, true)}
                        {fieldGroup("Address Line 2", <Input value={ef.address_2} onChange={upd("address_2")} placeholder="Suite, unit, building (optional)" />, false, true)}
                        {fieldGroup(t("admin.customers.city") || "City", <Input value={ef.city} onChange={upd("city")} placeholder="Montreal" />)}
                        {fieldGroup(t("admin.customers.province") || "Province / State", <Input value={ef.province} onChange={upd("province")} placeholder="QC" />)}
                        {fieldGroup(t("admin.customers.postal_code") || "Postal Code", <Input value={ef.postal_code} onChange={upd("postal_code")} placeholder="H1A 1A1" />)}
                        {fieldGroup(t("admin.customers.country") || "Country", <Input value={ef.country} onChange={upd("country")} placeholder="Canada" />)}
                      </div>
                    </div>

                    <Separator />

                    {/* Shipping */}
                    <div>
                      <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                        <Truck className="h-3.5 w-3.5" /> Shipping Address
                      </h4>
                      <div className="grid md:grid-cols-2 gap-5">
                        {fieldGroup("Shipping Street", <Input value={ef.shipping_address} onChange={upd("shipping_address")} placeholder="Leave empty to reuse primary" />, false, true)}
                        {fieldGroup("Shipping Address Line 2", <Input value={ef.shipping_address_2} onChange={upd("shipping_address_2")} placeholder="Suite, unit, building (optional)" />, false, true)}
                        {fieldGroup("Shipping City", <Input value={ef.shipping_city} onChange={upd("shipping_city")} placeholder="City" />)}
                        {fieldGroup("Shipping Province / State", <Input value={ef.shipping_province} onChange={upd("shipping_province")} placeholder="Province / State" />)}
                        {fieldGroup("Shipping Postal Code", <Input value={ef.shipping_postal_code} onChange={upd("shipping_postal_code")} placeholder="Postal Code" />)}
                        {fieldGroup("Shipping Country", <Input value={ef.shipping_country} onChange={upd("shipping_country")} placeholder="Country" />)}
                      </div>
                    </div>

                    <Separator />

                    {/* Billing */}
                    <div>
                      <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                        <CreditCard className="h-3.5 w-3.5" /> Billing Address
                      </h4>
                      <div className="grid md:grid-cols-2 gap-5">
                        {fieldGroup("Billing Street", <Input value={ef.billing_address} onChange={upd("billing_address")} placeholder="Leave empty to reuse primary" />, false, true)}
                        {fieldGroup("Billing Address Line 2", <Input value={ef.billing_address_2} onChange={upd("billing_address_2")} placeholder="Suite, unit, building (optional)" />, false, true)}
                        {fieldGroup("Billing City", <Input value={ef.billing_city} onChange={upd("billing_city")} placeholder="City" />)}
                        {fieldGroup("Billing Province / State", <Input value={ef.billing_province} onChange={upd("billing_province")} placeholder="Province / State" />)}
                        {fieldGroup("Billing Postal Code", <Input value={ef.billing_postal_code} onChange={upd("billing_postal_code")} placeholder="Postal Code" />)}
                        {fieldGroup("Billing Country", <Input value={ef.billing_country} onChange={upd("billing_country")} placeholder="Country" />)}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Billing & Payment */}
              {editTab === "billing" && (
                <Card className="shadow-sm border-border">
                  <CardHeader className="pb-4 border-b border-border bg-muted/30">
                    {sectionIcon(CreditCard, t("admin.customers.payment_accounting") || "Payment & Accounting")}
                    <CardDescription className="mt-1.5 ml-9">Payment methods, terms, and accounting contacts</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="grid md:grid-cols-2 gap-5">
                      {fieldGroup(t("admin.customers.payment_method") || "Payment Method",
                        selectField(ef.payment_method || "_none", (e: any) => upd("payment_method")({ target: { value: e.target.value === "_none" ? "" : e.target.value } } as any), [
                          { value: "_none", label: "— Select —" },
                          { value: "transfer", label: t("admin.transfer") || "Bank Transfer" },
                          { value: "credit_card", label: t("admin.credit_card") || "Credit Card" },
                          { value: "cheque", label: t("admin.cheque") || "Cheque" },
                          { value: "cod", label: t("admin.cod") || "Cash on Delivery" },
                          { value: "stripe", label: t("admin.stripe") || "Stripe" },
                        ])
                      )}
                      {fieldGroup(t("admin.customers.payment_terms") || "Payment Terms",
                        selectField(ef.payment_terms || "_none", (e: any) => upd("payment_terms")({ target: { value: e.target.value === "_none" ? "" : e.target.value } } as any), [
                          { value: "_none", label: "— Select —" },
                          { value: "on_delivery", label: t("admin.on_delivery") || "On Delivery" },
                          { value: "net_15", label: t("admin.net_15") || "Net 15" },
                          { value: "net_30", label: t("admin.net_30") || "Net 30" },
                          { value: "net_60", label: t("admin.net_60") || "Net 60" },
                          { value: "prepaid", label: t("admin.prepaid") || "Prepaid" },
                        ])
                      )}
                      {fieldGroup(t("admin.customers.credit_limit") || "Credit Limit", <Input type="number" step="0.01" value={ef.credit_limit} onChange={upd("credit_limit")} placeholder="0.00" />)}
                      {fieldGroup(t("admin.customers.bank_reference") || "Bank Reference", <Input value={ef.bank_reference} onChange={upd("bank_reference")} placeholder="Bank or payment reference" />)}
                      {fieldGroup("Price Augmentation %", <Input type="number" step="0.01" min="0" max="100" value={ef.price_augmentation_percent} onChange={upd("price_augmentation_percent")} placeholder="0.00" />)}
                    </div>

                    <Separator className="my-6" />
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5" /> Accounting Contact
                    </h4>
                    <div className="grid md:grid-cols-2 gap-5">
                      {fieldGroup(t("admin.customers.accounting_contact") || "Contact Name", <Input value={ef.accounting_contact} onChange={upd("accounting_contact")} placeholder="AP contact name" />)}
                      {fieldGroup(t("admin.customers.accounting_phone") || "Phone", <Input type="tel" value={ef.accounting_phone} onChange={upd("accounting_phone")} placeholder="+1 (555) 000-0000" />)}
                      {fieldGroup(t("admin.customers.billing_email") || "Billing Email", <Input type="email" value={ef.billing_email} onChange={upd("billing_email")} placeholder="ap@company.com" />, false, true)}
                      {fieldGroup("Accountant Email", <Input type="email" value={ef.accountant_email || ""} onChange={upd("accountant_email")} placeholder="accountant@company.com" />, false, true)}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Other / Supplier Refs */}
              {editTab === "other" && (
                <Card className="shadow-sm border-border">
                  <CardHeader className="pb-4 border-b border-border bg-muted/30">
                    {sectionIcon(FileText, t("admin.customers.supplier_refs") || "Supplier References & Other")}
                    <CardDescription className="mt-1.5 ml-9">External references and additional information</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="grid md:grid-cols-2 gap-5">
                      {fieldGroup(t("admin.customers.supplier_ref_1") || "Supplier Reference 1", <Input value={ef.supplier_ref_1} onChange={upd("supplier_ref_1")} placeholder="Reference #1" />)}
                      {fieldGroup(t("admin.customers.supplier_ref_2") || "Supplier Reference 2", <Input value={ef.supplier_ref_2} onChange={upd("supplier_ref_2")} placeholder="Reference #2" />)}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Save bar */}
              <div className="sticky bottom-0 bg-background/80 backdrop-blur-sm border-t border-border -mx-1 px-1 py-4 flex items-center justify-between gap-4">
                <Button type="button" variant="outline" onClick={() => setShowEditModal(false)} className="px-6">
                  {t("admin.cancel") || "Cancel"}
                </Button>
                <Button type="submit" size="lg" className="px-8 font-bold shadow-sm" disabled={updateCustomerMutation.isPending}>
                  {updateCustomerMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving...</>
                  ) : (
                    <><CheckCircle className="h-4 w-4 mr-2" /> {t("admin.save_all_changes") || "Save All Changes"}</>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </form>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════
   * CUSTOMER DETAIL VIEW
   * ═══════════════════════════════════════════════ */
  if (selectedCustomerId && selectedCustomer) {
    const c = selectedCustomer;
    const a = c as any;
    const openTasks = tasks.filter(t => t.status === "open").length;
    const completedTasks = tasks.filter(t => t.status === "done").length;
    const displayName = c.company_name || c.full_name;

    const statusColor = c.status === "active"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800"
      : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800";
    const categoryColor = (c.category || "lead") === "customer"
      ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800"
      : (c.category || "lead") === "contract"
      ? "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950 dark:text-teal-400 dark:border-teal-800"
      : "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-400 dark:border-violet-800";

    return (
      <div className="space-y-6 max-w-6xl">
        {/* Back */}
        <Button variant="ghost" size="sm" onClick={() => {
          setSelectedCustomerId(null);
          const fallback = contractOnly ? "/admin/contract-customers" : leadOnly ? "/admin/leads" : "/admin/customers";
          if (window.history.length > 1) {
            navigate(-1);
          } else {
            navigate(fallback);
          }
        }}>
          <ArrowLeft className="h-4 w-4 mr-1.5" /> {t("admin.customers.back")}
        </Button>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-4">
            <CustomerAvatar name={displayName} size="lg" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{displayName}</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {c.full_name !== displayName && c.full_name}{c.email ? ` · ${c.email}` : ""}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline" className={statusColor}>{c.status}</Badge>
                <Badge variant="outline" className={categoryColor}>{c.category || "lead"}</Badge>
                <span className="text-xs text-muted-foreground">
                  {t("admin.customers.customer_since")} {new Date(c.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {(c.category || "lead") === "lead" && (
              <Button variant="default" size="sm" onClick={async () => {
                const ok = await confirmAction({ title: "Convert to Customer", message: `Convert "${c.company_name || c.full_name}" from Lead to Customer?`, variant: "success" });
                if (ok) convertLeadMutation.mutate(c.id);
              }} disabled={convertLeadMutation.isPending}>
                {convertLeadMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <CheckCircle className="h-3.5 w-3.5 mr-1.5" />}
                Convert to Customer
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => openEditModal(c)}>
              <Edit className="h-3.5 w-3.5 mr-1.5" /> {t("admin.edit") || "Edit"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => fetchAdminPassword(c.id)} disabled={adminPwdLoading}>
              <KeyRound className="h-3.5 w-3.5 mr-1.5" /> {adminPwdLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Admin Password"}
            </Button>
            {(c.category || "lead") === "contract" && (() => {
              const rs = resendStatus[c.id];
              const isSending = rs?.state === "sending";
              const variantColor =
                rs?.state === "sent"
                  ? "border-emerald-500 text-emerald-600 hover:text-emerald-600"
                  : rs?.state === "failed"
                  ? "border-destructive text-destructive hover:text-destructive"
                  : "";
              const label = isSending
                ? "Sending…"
                : rs?.state === "sent"
                ? `✅ Sent ${new Date(rs.at).toLocaleTimeString()}`
                : rs?.state === "failed"
                ? `❌ Failed ${new Date(rs.at).toLocaleTimeString()}`
                : "Resend Credentials";
              return (
                <Button
                  variant="outline"
                  size="sm"
                  className={variantColor}
                  disabled={isSending}
                  title={rs?.message || "Generate a new password and email it to the customer"}
                  onClick={async () => {
                    if (!c.email) {
                      showErrorToast("This customer has no email on file.");
                      return;
                    }
                    const ok = await confirmAction({
                      title: "Resend Credentials",
                      message: `Generate a NEW password for "${c.company_name || c.full_name}" and email it to ${c.email}? The current password will no longer work.`,
                      variant: "warning",
                    });
                    if (!ok) return;
                    setRowResendStatus(c.id, { state: "sending", at: Date.now(), message: "Sending…" });
                    try {
                      const res: any = await api.request("POST", `/customers/${c.id}/resend-credentials`, {});
                      if (res?.success) {
                        const msg = res.message || `New credentials emailed to ${c.email}`;
                        setRowResendStatus(c.id, { state: "sent", at: Date.now(), message: msg });
                        showSuccessToast(msg);
                      } else if (res?.data?.password) {
                        const msg = `Email send failed. New password: ${res.data.password}`;
                        setRowResendStatus(c.id, { state: "failed", at: Date.now(), message: msg });
                        showErrorToast(`${msg} (copy it now)`);
                      } else {
                        const msg = res?.message || "Failed to resend credentials";
                        setRowResendStatus(c.id, { state: "failed", at: Date.now(), message: msg });
                        showErrorToast(msg);
                      }
                    } catch (err: any) {
                      const payload = err?.response?.data ?? err?.data;
                      if (payload?.details?.password) {
                        const msg = `Email send failed. New password: ${payload.details.password}`;
                        setRowResendStatus(c.id, { state: "failed", at: Date.now(), message: msg });
                        showErrorToast(`${msg} (copy it now)`);
                      } else {
                        const msg = err?.message || "Failed to resend credentials";
                        setRowResendStatus(c.id, { state: "failed", at: Date.now(), message: msg });
                        showErrorToast(msg);
                      }
                    }
                  }}
                >
                  {isSending ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : rs?.state === "sent" ? (
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                  ) : rs?.state === "failed" ? (
                    <XCircle className="h-3.5 w-3.5 mr-1.5" />
                  ) : (
                    <Mail className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  {label}
                </Button>
              );
            })()}
            <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleToggleStatus(c)}>
              {c.status === "active" ? <><Ban className="h-3.5 w-3.5 mr-1.5" /> {t("admin.customers.deactivate")}</> : <><CheckCircle className="h-3.5 w-3.5 mr-1.5" /> {t("admin.customers.activate")}</>}
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={ShoppingBag} label={t("admin.customers.total_orders")} value={customerOrders.length || c.total_orders || 0} color="bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400" />
          <StatCard icon={DollarSign} label={t("admin.customers.total_spent")} value={`C$${(customerOrders.reduce((sum: number, o: any) => sum + Number(o.total_amount || o.total || 0), 0) || c.total_spent || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`} color="bg-emerald-100 text-emerald-600 dark:bg-emerald-900 dark:text-emerald-400" />
          <StatCard icon={ListTodo} label={t("admin.customers.open_tasks")} value={openTasks} color="bg-amber-100 text-amber-600 dark:bg-amber-900 dark:text-amber-400" />
          <StatCard icon={FileText} label={t("admin.customers.documents")} value={customerDocuments.length} color="bg-violet-100 text-violet-600 dark:bg-violet-900 dark:text-violet-400" />
        </div>

        {/* Admin Password Panel */}
        {showAdminPwd && adminPwdData && (
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-primary" /> Admin Override Password
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setShowAdminPwd(false)}><X className="h-4 w-4" /></Button>
            </CardHeader>
            <CardContent>
              {!adminPwdData.has_account ? (
                <p className="text-sm text-muted-foreground">This customer has no linked user account. Create one first.</p>
              ) : (
                <div className="space-y-3">
                  <div className="text-xs text-muted-foreground">
                    Linked account: <span className="font-medium text-foreground">{adminPwdData.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Input
                        type={adminPwdVisible ? "text" : "password"}
                        value={adminPwdInput}
                        onChange={(e) => setAdminPwdInput(e.target.value)}
                        placeholder="Set admin override password..."
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setAdminPwdVisible(!adminPwdVisible)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {adminPwdVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <Button size="sm" onClick={() => saveAdminPassword(c.id)} disabled={adminPwdSaving || !adminPwdInput.trim()}>
                      {adminPwdSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                      Save
                    </Button>
                    {adminPwdData.admin_password && (
                      <Button size="sm" variant="outline" className="text-destructive" onClick={() => removeAdminPassword(c.id)} disabled={adminPwdSaving}>
                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    This password lets admins log into this customer's account without changing their real password. It works alongside the original password.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setSearchParams((p) => { const np = new URLSearchParams(p); np.set("tab", v); return np; }, { replace: true }); }} className="w-full">
          <TabsList className="w-full justify-start h-auto p-1 gap-1 flex-wrap">
            <TabsTrigger value="overview" className="gap-1.5 text-xs"><UserRound className="h-3.5 w-3.5" /> {t("admin.customers.overview")}</TabsTrigger>
            <TabsTrigger value="orders" className="gap-1.5 text-xs"><ShoppingBag className="h-3.5 w-3.5" /> {t("admin.customers.orders")} ({customerOrders.length})</TabsTrigger>
            <TabsTrigger value="notes" className="gap-1.5 text-xs"><MessageSquareText className="h-3.5 w-3.5" /> {t("admin.customers.notes")} ({customerNotes.length})</TabsTrigger>
            <TabsTrigger value="tasks" className="gap-1.5 text-xs"><ListTodo className="h-3.5 w-3.5" /> {t("admin.customers.tasks")} ({tasks.length})</TabsTrigger>
            <TabsTrigger value="documents" className="gap-1.5 text-xs"><FileText className="h-3.5 w-3.5" /> {t("admin.customers.documents")} ({customerDocuments.length})</TabsTrigger>
            <TabsTrigger value="quickbooks" className="gap-1.5 text-xs"><DollarSign className="h-3.5 w-3.5" /> QuickBooks</TabsTrigger>
          </TabsList>

          {/* OVERVIEW */}
          <TabsContent value="overview" className="mt-4">
            <div className="grid lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <User className="h-4 w-4 text-primary" /> {t("admin.customers.contact_info")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
                    <FieldValue label={t("admin.customers.full_name")} value={c.full_name} />
                    <FieldValue label={t("admin.customers.contact_person")} value={a.contact_person} />
                    <FieldValue label={t("admin.customers.title_field")} value={a.contact_title} />
                    <FieldValue label="Position / Role" value={a.contact_position} />
                    <FieldValue label={t("admin.email")} value={c.email} />
                    <FieldValue label={t("admin.phone")} value={c.phone} />
                    <FieldValue label="Fax" value={a.fax} />
                    <FieldValue label={t("admin.customers.sales_rep")} value={a.sales_representative} />
                    <FieldValue label={t("admin.customers.primary_contact")} value={a.primary_contact_name} />
                    <FieldValue label={t("admin.customers.primary_contact_phone")} value={a.primary_contact_phone} />
                    <FieldValue label={t("admin.customers.primary_contact_email")} value={a.primary_contact_email} className="col-span-2" />
                  </dl>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" /> {t("admin.customers.company_details")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
                    <FieldValue label={t("admin.customers.company_name")} value={c.company_name} />
                    <FieldValue label={t("admin.customers.customer_type")} value={a.customer_type} />
                    <FieldValue label={t("admin.customers.distributor_type")} value={a.distributor_type} />
                    <FieldValue label={t("admin.customers.neq_tva")} value={a.neq_tva} />
                    <FieldValue label={t("admin.customers.tax_number")} value={a.tax_number} />
                    <FieldValue label={t("admin.customers.num_trucks")} value={a.num_trucks} />
                    <FieldValue label={t("admin.customers.num_trailers")} value={a.num_trailers} />
                    <FieldValue label={t("admin.customers.website")} value={a.website} />
                    <FieldValue label={t("admin.customers.parts_needed")} value={a.parts_needed} className="col-span-2" />
                    <FieldValue label={t("admin.customers.special_requests")} value={a.special_requests} className="col-span-2" />
                  </dl>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" /> {t("admin.customers.addresses")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
                    <FieldValue label={t("admin.customers.address")} value={a.address} className="col-span-2" />
                    <FieldValue label={t("admin.customers.shipping_address")} value={a.shipping_address} className="col-span-2" />
                    <FieldValue label={t("admin.customers.billing_address")} value={a.billing_address} className="col-span-2" />
                    <FieldValue label={t("admin.customers.city")} value={a.city} />
                    <FieldValue label={t("admin.customers.province")} value={a.province} />
                    <FieldValue label={t("admin.customers.postal_code")} value={a.postal_code} />
                    <FieldValue label={t("admin.customers.country")} value={a.country} />
                  </dl>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-primary" /> {t("admin.customers.payment_accounting")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
                    <FieldValue label={t("admin.customers.payment_method")} value={a.payment_method} />
                    <FieldValue label={t("admin.customers.payment_terms")} value={a.payment_terms} />
                    <FieldValue label={t("admin.customers.credit_limit")} value={a.credit_limit ? `C$${Number(a.credit_limit).toLocaleString()}` : null} />
                    <FieldValue label={t("admin.customers.bank_reference")} value={a.bank_reference} />
                    <FieldValue label="Price Augmentation" value={a.price_augmentation_percent ? `${Number(a.price_augmentation_percent)}%` : null} />
                    <FieldValue label={t("admin.customers.accounting_contact")} value={a.accounting_contact} />
                    <FieldValue label={t("admin.customers.accounting_phone")} value={a.accounting_phone} />
                    <FieldValue label={t("admin.customers.billing_email")} value={a.billing_email} className="col-span-2" />
                  </dl>
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" /> {t("admin.customers.supplier_refs")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
                    <FieldValue label={t("admin.customers.supplier_ref_1")} value={a.supplier_ref_1} />
                    <FieldValue label={t("admin.customers.supplier_ref_2")} value={a.supplier_ref_2} />
                  </dl>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ORDERS */}
          <TabsContent value="orders" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">{t("admin.customers.orders")}</CardTitle>
                <CardDescription>{customerOrders.length} {t("admin.customers.orders").toLowerCase()}</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {customerOrders.length === 0 ? (
                  <div className="text-center py-16 px-6">
                    <ShoppingBag className="h-10 w-10 mx-auto text-muted-foreground/20 mb-3" />
                    <p className="text-sm text-muted-foreground">{t("admin.customers.no_orders")}</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order #</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>{t("admin.status")}</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customerOrders.map((o: any) => (
                        <TableRow key={o.id} className="cursor-pointer" onClick={() => navigate(`/admin/orders/${o.id}`)}>
                          <TableCell className="font-medium">#{o.order_number || o.id?.slice(0, 8)}</TableCell>
                          <TableCell className="text-muted-foreground">{new Date(o.created_at).toLocaleDateString()}</TableCell>
                          <TableCell><Badge variant="outline">{o.status}</Badge></TableCell>
                          <TableCell className="text-right font-semibold">C${toNumber(o.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* NOTES */}
          <TabsContent value="notes" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">{t("admin.customers.notes")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <form onSubmit={(e) => {
                  e.preventDefault();
                  if (noteDraft.trim()) addCustomerNoteMutation.mutate({ customerId: c.id, note: noteDraft, isInternal: noteIsInternal });
                }} className="space-y-3">
                  <Textarea value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} rows={3} placeholder={t("admin.customers.write_note")} />
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                      <input type="checkbox" checked={noteIsInternal} onChange={(e) => setNoteIsInternal(e.target.checked)} className="rounded border-input" /> Internal only
                    </label>
                    <Button type="submit" size="sm" disabled={!noteDraft.trim()}>{t("admin.customers.add_note")}</Button>
                  </div>
                </form>
                <Separator />
                {customerNotes.length === 0 ? (
                  <div className="text-center py-12">
                    <MessageSquareText className="h-8 w-8 mx-auto text-muted-foreground/20 mb-2" />
                    <p className="text-sm text-muted-foreground">{t("admin.customers.no_notes")}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {customerNotes.map(n => {
                      const isEditing = editingNoteId === n.id;
                      return (
                        <div key={n.id} className="p-3 rounded-lg border border-border bg-muted/30">
                          <div className="flex justify-between items-center text-xs text-muted-foreground mb-1.5">
                            <span className="font-medium">{n.user || "System"} <Badge variant="outline" className="ml-1 text-[10px] px-1.5 py-0">{(isEditing ? editingNoteIsInternal : n.is_internal) ? "Internal" : "Public"}</Badge></span>
                            <div className="flex items-center gap-2">
                              <span>{new Date(n.created_at).toLocaleString()}</span>
                              {!isEditing && (
                                <>
                                  <Button
                                    variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                    onClick={() => {
                                      setEditingNoteId(n.id);
                                      setEditingNoteText(n.note);
                                      setEditingNoteIsInternal(!!n.is_internal);
                                    }}
                                    title="Edit note"
                                  >
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                    onClick={async () => {
                                      const ok = await confirmAction({ title: "Delete Note", message: "Are you sure you want to delete this note?", variant: "danger" });
                                      if (ok) deleteCustomerNoteMutation.mutate({ customerId: c.id, noteId: n.id });
                                    }}
                                    title="Delete note"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                          {isEditing ? (
                            <div className="space-y-2 mt-2">
                              <Textarea
                                value={editingNoteText}
                                onChange={(e) => setEditingNoteText(e.target.value)}
                                rows={3}
                                autoFocus
                              />
                              <div className="flex items-center justify-between">
                                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                                  <input
                                    type="checkbox"
                                    checked={editingNoteIsInternal}
                                    onChange={(e) => setEditingNoteIsInternal(e.target.checked)}
                                    className="rounded border-input"
                                  />
                                  Internal only
                                </label>
                                <div className="flex gap-2">
                                  <Button
                                    type="button" variant="outline" size="sm"
                                    onClick={() => setEditingNoteId(null)}
                                    disabled={updateCustomerNoteMutation.isPending}
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    type="button" size="sm"
                                    disabled={!editingNoteText.trim() || updateCustomerNoteMutation.isPending}
                                    onClick={() => updateCustomerNoteMutation.mutate({
                                      customerId: c.id,
                                      noteId: n.id,
                                      note: editingNoteText.trim(),
                                      isInternal: editingNoteIsInternal,
                                    })}
                                  >
                                    {updateCustomerNoteMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
                                    Save
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm whitespace-pre-wrap">{n.note}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TASKS */}
          <TabsContent value="tasks" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">{t("admin.customers.tasks")}</CardTitle>
                <CardDescription>{openTasks} open · {completedTasks} completed</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <form onSubmit={(e) => {
                  e.preventDefault();
                  if (taskDraft.title.trim()) {
                    createTaskMutation.mutate({
                      customerId: c.id,
                      payload: { title: taskDraft.title, due_at: taskDraft.dueAtLocal ? new Date(taskDraft.dueAtLocal).toISOString() : null, status: "open", assigned_to: taskDraft.assignedTo || null, notes: taskDraft.notes || null }
                    }, { onSuccess: () => setTaskDraft({ title: "", dueAtLocal: "", assignedTo: "", notes: "" }) });
                  }
                }} className="space-y-3 p-4 rounded-lg border border-dashed border-border bg-muted/20">
                  <Input value={taskDraft.title} onChange={(e) => setTaskDraft(d => ({ ...d, title: e.target.value }))} placeholder={t("admin.customers.task_title")} />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input type="datetime-local" value={taskDraft.dueAtLocal} onChange={(e) => setTaskDraft(d => ({ ...d, dueAtLocal: e.target.value }))} />
                    <select value={taskDraft.assignedTo} onChange={(e) => setTaskDraft(d => ({ ...d, assignedTo: e.target.value }))} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                      <option value="">{t("admin.customers.unassigned")}</option>
                      {adminContacts.map(ac => <option key={ac.id} value={ac.id}>{ac.name}</option>)}
                    </select>
                  </div>
                  <Textarea value={taskDraft.notes} onChange={(e) => setTaskDraft(d => ({ ...d, notes: e.target.value }))} rows={2} placeholder={t("admin.customers.notes_optional")} />
                  <Button type="submit" size="sm" disabled={!taskDraft.title.trim()}>{t("admin.customers.create_task")}</Button>
                </form>

                <div className="flex items-center gap-3">
                  <select value={taskOwnerFilter} onChange={(e) => setTaskOwnerFilter(e.target.value)} className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm">
                    <option value="all">{t("admin.customers.all_owners")}</option>
                    {adminContacts.map(ac => <option key={ac.id} value={ac.id}>{ac.name}</option>)}
                  </select>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                    <input type="checkbox" checked={overdueOnly} onChange={(e) => setOverdueOnly(e.target.checked)} className="rounded border-input" /> Overdue only
                  </label>
                </div>

                {filteredTasks.length === 0 ? (
                  <div className="text-center py-12">
                    <ListTodo className="h-8 w-8 mx-auto text-muted-foreground/20 mb-2" />
                    <p className="text-sm text-muted-foreground">{t("admin.customers.no_tasks")}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredTasks.map(tk => {
                      const isOverdue = tk.status === "open" && tk.due_at && new Date(tk.due_at).getTime() < Date.now();
                      const isHighlighted = highlightTaskId === tk.id;
                      return (
                        <div
                          key={tk.id}
                          id={`task-${tk.id}`}
                          className={`p-3 border rounded-lg flex items-center justify-between gap-3 transition-colors ${
                            isHighlighted ? "ring-2 ring-amber-400 ring-offset-2 ring-offset-background animate-in fade-in zoom-in-95" : ""
                          } ${tk.status === "done" ? "bg-muted/30 opacity-60" : isOverdue ? "border-destructive/30 bg-destructive/5" : "bg-card"}`}
                        >
                          <div className="min-w-0 flex-1">
                            <p className={`text-sm font-medium ${tk.status === "done" ? "line-through text-muted-foreground" : ""}`}>{tk.title}</p>
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                              {tk.due_at && (
                                <span className={`flex items-center gap-1 ${isOverdue ? "text-destructive font-medium" : ""}`}>
                                  <CalendarClock className="h-3 w-3" /> {new Date(tk.due_at).toLocaleString()}
                                </span>
                              )}
                              {tk.notes && <span className="truncate max-w-[200px]">{tk.notes}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {tk.status === "done" ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => updateTaskMutation.mutate({ taskId: tk.id, payload: { status: "open" } as any })}
                                disabled={updateTaskMutation.isPending}
                              >
                                <CheckCircle2 className="h-3 w-3 mr-1" />{t("admin.customers.done")}
                              </Button>
                            ) : (
                              <Button
                                variant={isHighlighted || isOverdue ? "default" : "secondary"}
                                size="sm"
                                className={`h-7 text-xs font-semibold ${isHighlighted || isOverdue ? "shadow-sm" : ""}`}
                                onClick={() => updateTaskMutation.mutate({ taskId: tk.id, payload: { status: "done" } as any })}
                                disabled={updateTaskMutation.isPending}
                                title="Mark this task as done"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                                Mark as Done
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => {
                              setEditingTask(tk);
                              setEditTaskForm({
                                title: tk.title,
                                dueAtLocal: tk.due_at ? new Date(tk.due_at).toISOString().slice(0, 16) : "",
                                assignedTo: tk.assigned_to || "",
                                notes: tk.notes || "",
                              });
                            }}>
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteTaskMutation.mutate(tk.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Edit Task Dialog */}
            {editingTask && (
              <Dialog open={!!editingTask} onOpenChange={(open) => { if (!open) setEditingTask(null); }}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Edit Task</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div>
                      <Label>Title</Label>
                      <Input value={editTaskForm.title} onChange={(e) => setEditTaskForm(f => ({ ...f, title: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Due Date</Label>
                      <Input type="datetime-local" value={editTaskForm.dueAtLocal} onChange={(e) => setEditTaskForm(f => ({ ...f, dueAtLocal: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Assigned To</Label>
                      <select value={editTaskForm.assignedTo} onChange={(e) => setEditTaskForm(f => ({ ...f, assignedTo: e.target.value }))} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                        <option value="">Unassigned</option>
                        {adminContacts.map(ac => <option key={ac.id} value={ac.id}>{ac.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <Label>Notes</Label>
                      <Textarea value={editTaskForm.notes} onChange={(e) => setEditTaskForm(f => ({ ...f, notes: e.target.value }))} rows={3} />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setEditingTask(null)}>Cancel</Button>
                      <Button onClick={() => {
                        updateTaskMutation.mutate({
                          taskId: editingTask.id,
                          payload: {
                            title: editTaskForm.title,
                            due_at: editTaskForm.dueAtLocal ? new Date(editTaskForm.dueAtLocal).toISOString() : null,
                            assigned_to: editTaskForm.assignedTo || null,
                            notes: editTaskForm.notes || null,
                          } as any,
                        }, { onSuccess: () => setEditingTask(null) });
                      }} disabled={!editTaskForm.title.trim()}>
                        Save Changes
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </TabsContent>

          {/* DOCUMENTS */}
          <TabsContent value="documents" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <CardTitle className="text-sm font-semibold">{t("admin.customers.documents")}</CardTitle>
                  <CardDescription>{customerDocuments.length} files</CardDescription>
                </div>
                <Button size="sm" variant="outline" onClick={() => documentInputRef.current?.click()}>
                  <Upload className="h-3.5 w-3.5 mr-1.5" /> Upload
                </Button>
                <input ref={documentInputRef} type="file" className="hidden" onChange={handleDocumentFileChange} />
              </CardHeader>
              <CardContent>
                {customerDocuments.length === 0 ? (
                  <div className="text-center py-16 border-2 border-dashed border-border rounded-lg">
                    <FolderOpen className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">{t("admin.customers.no_documents")}</p>
                    <Button variant="link" size="sm" className="mt-2" onClick={() => documentInputRef.current?.click()}>
                      {t("admin.customers.upload_first")}
                    </Button>
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 gap-3">
                    {customerDocuments.map(doc => {
                      const isAppForm = doc.document_type === 'application_form';
                      return (
                        <div key={doc.id} className={`p-4 border rounded-lg flex items-start gap-3 ${isAppForm ? 'border-primary/20 bg-primary/5' : ''}`}>
                          <div className={`p-2.5 rounded-lg ${isAppForm ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                            <FileText className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium truncate">{doc.file_name || (isAppForm ? "Account Application" : "Document")}</span>
                              {isAppForm && <Badge variant="outline" className="text-[9px] px-1.5 py-0">Official</Badge>}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {isAppForm ? "Generated PDF" : doc.document_type.replace('_', ' ')} · {new Date(doc.created_at).toLocaleDateString()}
                            </p>
                            <button onClick={() => setPreviewDoc(doc)}
                              className="text-xs font-medium flex items-center gap-1 mt-1.5 text-primary hover:underline bg-transparent border-none cursor-pointer p-0">
                              Preview <Eye className="h-3 w-3" />
                            </button>
                            <a href={resolveBackendUploadUrl(doc.file_url)} download
                              className="text-xs font-medium flex items-center gap-1 mt-1.5 text-muted-foreground hover:underline">
                              Download <Download className="h-3 w-3" />
                            </a>
                          </div>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                            onClick={async () => { const ok = await confirmAction({ title: t("confirm.delete_title"), message: t("confirm.delete_document"), variant: "danger" }); if (ok) deleteDocumentMutation.mutate({ documentId: doc.id, customerId: c.id }); }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* QUICKBOOKS — invoices, estimates, payments, total spent (read-only mirror) */}
          <TabsContent value="quickbooks" className="mt-4">
            <CustomerQboPanel customerId={c.id} />
          </TabsContent>
        </Tabs>

        {/* Document Preview Modal */}
        <Dialog open={!!previewDoc} onOpenChange={(open) => !open && setPreviewDoc(null)}>
          <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0">
            <DialogHeader className="px-6 pt-6 pb-3 border-b">
              <DialogTitle className="flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4" />
                {previewDoc?.file_name || "Document"}
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                {previewDoc?.document_type?.replace('_', ' ')} · {previewDoc ? new Date(previewDoc.created_at).toLocaleDateString() : ''}
              </p>
            </DialogHeader>
            <div className="flex-1 min-h-0 px-6 pb-6">
              {previewDoc && (
                <iframe
                  src={resolveBackendUploadUrl(previewDoc.file_url)}
                  className="w-full h-full rounded-lg border"
                  title={previewDoc.file_name}
                />
              )}
            </div>
            {previewDoc && (
              <div className="px-6 pb-4 flex justify-end gap-2 border-t pt-3">
                <a href={resolveBackendUploadUrl(previewDoc.file_url)} download
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90">
                  <Download className="h-3 w-3" /> Download
                </a>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════
   * CREATE MODAL
   * ═══════════════════════════════════════════════ */
  if (showCreateModal) {
    const nc = newCustomer;
    const ncu = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setNewCustomer({ ...newCustomer, [field]: e.target.value });

    return (
      <div className="space-y-6 w-full max-w-7xl">
        {/* Header — matches ProductEdit */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => setShowCreateModal(false)} className="p-1.5 hover:bg-secondary rounded-sm transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h2 className="font-display font-bold text-lg md:text-xl">{t("admin.customers.create") || "Create Customer"}</h2>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={copyFormLink}
              className="px-3 py-2 rounded-sm text-xs font-medium border border-border hover:bg-secondary transition-colors flex items-center gap-1.5"
            >
              {linkCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {linkCopied ? "Copied!" : "Copy Apply Link"}
            </button>
            <button
              type="button"
              onClick={handleCreateCustomer}
              disabled={createCustomerMutation.isPending || !nc.company_name.trim()}
              className="btn-accent px-4 py-2 rounded-sm text-sm font-medium flex items-center gap-2 disabled:opacity-50"
            >
              {createCustomerMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {t("admin.customers.create") || "Create Customer"}
            </button>
          </div>
        </div>

        <form onSubmit={handleCreateCustomer}>
          <div className="grid xl:grid-cols-4 gap-6">
            {/* Main content — 3 cols */}
            <div className="xl:col-span-3 space-y-6">
              {/* Contact Information */}
              <div className="dashboard-card space-y-4">
                <h3 className="font-display font-bold text-sm uppercase text-muted-foreground flex items-center gap-2">
                  <User className="h-4 w-4" /> Contact Information
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">{t("admin.customers.company_name")} <span className="text-destructive">*</span></label>
                    <input
                      required value={nc.company_name} onChange={ncu("company_name")}
                      className="w-full px-3 py-2 border border-border rounded-sm text-sm bg-background outline-none focus:ring-2 focus:ring-accent"
                      placeholder="ACME Industries Inc."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">{t("admin.customers.contact_person")} <span className="text-muted-foreground text-xs">(optional)</span></label>
                    <input
                      value={nc.full_name} onChange={ncu("full_name")}
                      className="w-full px-3 py-2 border border-border rounded-sm text-sm bg-background outline-none focus:ring-2 focus:ring-accent"
                      placeholder="John Doe (optional)"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Title</label>
                    <input value={nc.contact_title} onChange={ncu("contact_title")} className="w-full px-3 py-2 border border-border rounded-sm text-sm bg-background outline-none focus:ring-2 focus:ring-accent" placeholder="Mr./Mrs." />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Position / Role</label>
                    <input value={nc.contact_position} onChange={ncu("contact_position")} className="w-full px-3 py-2 border border-border rounded-sm text-sm bg-background outline-none focus:ring-2 focus:ring-accent" placeholder="e.g. Fleet Manager, Owner" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">{t("admin.email")}</label>
                    <input
                      type="email" value={nc.email} onChange={ncu("email")}
                      className="w-full px-3 py-2 border border-border rounded-sm text-sm bg-background outline-none focus:ring-2 focus:ring-accent"
                      placeholder="email@company.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">{t("admin.phone")}</label>
                    <input
                      type="tel" value={nc.phone} onChange={ncu("phone")}
                      className="w-full px-3 py-2 border border-border rounded-sm text-sm bg-background outline-none focus:ring-2 focus:ring-accent"
                      placeholder="+1 (555) 000-0000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Fax</label>
                    <input
                      type="tel" value={nc.fax} onChange={ncu("fax")}
                      className="w-full px-3 py-2 border border-border rounded-sm text-sm bg-background outline-none focus:ring-2 focus:ring-accent"
                      placeholder="+1 (555) 000-0000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">{t("admin.customers.website") || "Website"}</label>
                    <input
                      type="url" value={nc.website} onChange={ncu("website")}
                      className="w-full px-3 py-2 border border-border rounded-sm text-sm bg-background outline-none focus:ring-2 focus:ring-accent"
                      placeholder="https://example.com"
                    />
                  </div>
                </div>
              </div>

              {/* Registration & Tax */}
              <div className="dashboard-card space-y-4">
                <h3 className="font-display font-bold text-sm uppercase text-muted-foreground flex items-center gap-2">
                  <Building2 className="h-4 w-4" /> Registration & Tax
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">{t("admin.customers.neq_tva") || "NEQ / TVA"}</label>
                    <input
                      value={nc.neq} onChange={ncu("neq")}
                      className="w-full px-3 py-2 border border-border rounded-sm text-sm bg-background outline-none focus:ring-2 focus:ring-accent"
                      placeholder="NEQ or TVA number"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">{t("admin.customers.tax_number") || "Tax ID"}</label>
                    <input
                      value={nc.tax_id} onChange={ncu("tax_id")}
                      className="w-full px-3 py-2 border border-border rounded-sm text-sm bg-background outline-none focus:ring-2 focus:ring-accent"
                      placeholder="Tax registration #"
                    />
                  </div>
                </div>
              </div>

              {/* General Address (for leads without billing/shipping yet) */}
              <div className="dashboard-card space-y-4">
                <h3 className="font-display font-bold text-sm uppercase text-muted-foreground flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> General Address
                </h3>
                <p className="text-xs text-muted-foreground">Use this for leads who are not yet customers. Not billing or shipping specific.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium mb-1">Street Address</label>
                    <input value={nc.address} onChange={ncu("address")} className="w-full px-3 py-2 border border-border rounded-sm text-sm bg-background outline-none focus:ring-2 focus:ring-accent" placeholder="123 Main Street" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium mb-1">Address Line 2</label>
                    <input value={nc.address_2} onChange={ncu("address_2")} className="w-full px-3 py-2 border border-border rounded-sm text-sm bg-background outline-none focus:ring-2 focus:ring-accent" placeholder="Suite, Unit, Apt..." />
                  </div>
                  <div><label className="block text-sm font-medium mb-1">City</label><input value={nc.city} onChange={ncu("city")} className="w-full px-3 py-2 border border-border rounded-sm text-sm bg-background outline-none focus:ring-2 focus:ring-accent" placeholder="City" /></div>
                  <div><label className="block text-sm font-medium mb-1">Province</label><input value={nc.province} onChange={ncu("province")} className="w-full px-3 py-2 border border-border rounded-sm text-sm bg-background outline-none focus:ring-2 focus:ring-accent" placeholder="QC" /></div>
                  <div><label className="block text-sm font-medium mb-1">Postal Code</label><input value={nc.postal_code} onChange={ncu("postal_code")} className="w-full px-3 py-2 border border-border rounded-sm text-sm bg-background outline-none focus:ring-2 focus:ring-accent" placeholder="H1A 1A1" /></div>
                  <div><label className="block text-sm font-medium mb-1">Country</label><input value={nc.country} onChange={ncu("country")} className="w-full px-3 py-2 border border-border rounded-sm text-sm bg-background outline-none focus:ring-2 focus:ring-accent" placeholder="Canada" /></div>
                </div>
              </div>

              {/* Initial Note */}
              <div className="dashboard-card space-y-4">
                <h3 className="font-display font-bold text-sm uppercase text-muted-foreground flex items-center gap-2">
                  <MessageSquareText className="h-4 w-4" /> Initial Note
                </h3>
                <textarea
                  value={nc.initial_note} onChange={ncu("initial_note")}
                  rows={3}
                  className="w-full px-3 py-2 border border-border rounded-sm text-sm bg-background outline-none focus:ring-2 focus:ring-accent resize-y"
                  placeholder="Add an initial note for this customer/lead..."
                />
              </div>

              {/* Billing Address */}
              <div className="dashboard-card space-y-4">
                <h3 className="font-display font-bold text-sm uppercase text-muted-foreground flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> {t("checkout.billing")}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium mb-1">{t("checkout.street_address_1")}</label>
                    <input value={nc.billing_address} onChange={ncu("billing_address")} className="w-full px-3 py-2 border border-border rounded-sm text-sm bg-background outline-none focus:ring-2 focus:ring-accent" placeholder="1113 Rte Harwood" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium mb-1">{t("checkout.street_address_2")}</label>
                    <input value={nc.billing_address_2} onChange={ncu("billing_address_2")} className="w-full px-3 py-2 border border-border rounded-sm text-sm bg-background outline-none focus:ring-2 focus:ring-accent" placeholder="Suite, Unit, Apt..." />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">{t("checkout.city")}</label>
                    <input value={nc.billing_city} onChange={ncu("billing_city")} className="w-full px-3 py-2 border border-border rounded-sm text-sm bg-background outline-none focus:ring-2 focus:ring-accent" placeholder="Vaudreuil-Dorion" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">{t("checkout.province")}</label>
                    <input value={nc.billing_province} onChange={ncu("billing_province")} className="w-full px-3 py-2 border border-border rounded-sm text-sm bg-background outline-none focus:ring-2 focus:ring-accent" placeholder="QC" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">{t("checkout.postal")}</label>
                    <input value={nc.billing_postal_code} onChange={ncu("billing_postal_code")} className="w-full px-3 py-2 border border-border rounded-sm text-sm bg-background outline-none focus:ring-2 focus:ring-accent" placeholder="J7V 8P2" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">{t("checkout.country")}</label>
                    <input value={nc.billing_country} onChange={ncu("billing_country")} className="w-full px-3 py-2 border border-border rounded-sm text-sm bg-background outline-none focus:ring-2 focus:ring-accent" placeholder="CA" />
                  </div>
                </div>
              </div>

              {/* Shipping Address */}
              <div className="dashboard-card space-y-4">
                <h3 className="font-display font-bold text-sm uppercase text-muted-foreground flex items-center gap-2">
                  <Truck className="h-4 w-4" /> {t("checkout.shipping")}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium mb-1">{t("checkout.street_address_1")}</label>
                    <input value={nc.shipping_address} onChange={ncu("shipping_address")} className="w-full px-3 py-2 border border-border rounded-sm text-sm bg-background outline-none focus:ring-2 focus:ring-accent" placeholder="Street address" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium mb-1">{t("checkout.street_address_2")}</label>
                    <input value={nc.shipping_address_2} onChange={ncu("shipping_address_2")} className="w-full px-3 py-2 border border-border rounded-sm text-sm bg-background outline-none focus:ring-2 focus:ring-accent" placeholder="Suite, Unit, Apt..." />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">{t("checkout.city")}</label>
                    <input value={nc.shipping_city} onChange={ncu("shipping_city")} className="w-full px-3 py-2 border border-border rounded-sm text-sm bg-background outline-none focus:ring-2 focus:ring-accent" placeholder="City" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">{t("checkout.province")}</label>
                    <input value={nc.shipping_province} onChange={ncu("shipping_province")} className="w-full px-3 py-2 border border-border rounded-sm text-sm bg-background outline-none focus:ring-2 focus:ring-accent" placeholder="Province" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">{t("checkout.postal")}</label>
                    <input value={nc.shipping_postal_code} onChange={ncu("shipping_postal_code")} className="w-full px-3 py-2 border border-border rounded-sm text-sm bg-background outline-none focus:ring-2 focus:ring-accent" placeholder="Postal Code" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">{t("checkout.country")}</label>
                    <input value={nc.shipping_country} onChange={ncu("shipping_country")} className="w-full px-3 py-2 border border-border rounded-sm text-sm bg-background outline-none focus:ring-2 focus:ring-accent" placeholder="Country" />
                  </div>
                </div>
              </div>

              {/* Fleet & Operations */}
              <div className="dashboard-card space-y-4">
                <h3 className="font-display font-bold text-sm uppercase text-muted-foreground flex items-center gap-2">
                  <Truck className="h-4 w-4" /> Fleet & Operations
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">{t("admin.customers.fleet_details") || "Fleet Details"}</label>
                    <textarea
                      value={nc.fleet_details} onChange={ncu("fleet_details")}
                      rows={2}
                      className="w-full px-3 py-2 border border-border rounded-sm text-sm bg-background outline-none focus:ring-2 focus:ring-accent resize-y"
                      placeholder="Number of trucks, trailers, fleet size..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">{t("admin.customers.brands_serviced") || "Brands Serviced"}</label>
                    <textarea
                      value={nc.brands_serviced} onChange={ncu("brands_serviced")}
                      rows={2}
                      className="w-full px-3 py-2 border border-border rounded-sm text-sm bg-background outline-none focus:ring-2 focus:ring-accent resize-y"
                      placeholder="Freightliner, Kenworth, Peterbilt..."
                    />
                  </div>
                </div>
              </div>

              {/* Additional Contacts */}
              <div className="dashboard-card space-y-4">
                <h3 className="font-display font-bold text-sm uppercase text-muted-foreground flex items-center gap-2">
                  <Phone className="h-4 w-4" /> Additional Contacts
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Primary Contact Name</label>
                    <input
                      value={nc.primary_contact_name} onChange={ncu("primary_contact_name")}
                      className="w-full px-3 py-2 border border-border rounded-sm text-sm bg-background outline-none focus:ring-2 focus:ring-accent"
                      placeholder="Name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Primary Contact Phone</label>
                    <input
                      type="tel" value={nc.primary_contact_phone} onChange={ncu("primary_contact_phone")}
                      className="w-full px-3 py-2 border border-border rounded-sm text-sm bg-background outline-none focus:ring-2 focus:ring-accent"
                      placeholder="+1 (555) 000-0000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Primary Contact Email</label>
                    <input
                      type="email" value={nc.primary_contact_email} onChange={ncu("primary_contact_email")}
                      className="w-full px-3 py-2 border border-border rounded-sm text-sm bg-background outline-none focus:ring-2 focus:ring-accent"
                      placeholder="primary@company.com"
                    />
                  </div>
                </div>
                <div className="border-t border-border pt-4">
                  <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-3 flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5" /> Accounts Payable
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">AP Contact Name</label>
                      <input
                        value={nc.ap_contact_name} onChange={ncu("ap_contact_name")}
                        className="w-full px-3 py-2 border border-border rounded-sm text-sm bg-background outline-none focus:ring-2 focus:ring-accent"
                        placeholder="AP contact"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">AP Email</label>
                      <input
                        type="email" value={nc.ap_contact_email} onChange={ncu("ap_contact_email")}
                        className="w-full px-3 py-2 border border-border rounded-sm text-sm bg-background outline-none focus:ring-2 focus:ring-accent"
                        placeholder="ap@company.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">AP Phone</label>
                      <input
                        type="tel" value={nc.ap_phone} onChange={ncu("ap_phone")}
                        className="w-full px-3 py-2 border border-border rounded-sm text-sm bg-background outline-none focus:ring-2 focus:ring-accent"
                        placeholder="+1 (555) 000-0000"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar — 1 col */}
            <div className="space-y-6">
              <div className="dashboard-card space-y-4">
                <h3 className="font-display font-bold text-sm uppercase text-muted-foreground">Category</h3>
                <select
                  value={nc.category}
                  onChange={(e) => setNewCustomer({ ...nc, category: e.target.value as Customer["category"] })}
                  className="w-full px-3 py-2 border border-border rounded-sm text-sm bg-background outline-none"
                >
                  <option value="lead">{t("admin.lead") || "Lead"}</option>
                  <option value="customer">{t("admin.customer") || "Customer"}</option>
                </select>
              </div>

              <div className="dashboard-card space-y-4">
                <h3 className="font-display font-bold text-sm uppercase text-muted-foreground">Payment</h3>
                <div>
                  <label className="block text-sm font-medium mb-1">{t("admin.customers.payment_method") || "Payment Method"}</label>
                  <select
                    value={nc.payment_method}
                    onChange={ncu("payment_method")}
                    className="w-full px-3 py-2 border border-border rounded-sm text-sm bg-background outline-none"
                  >
                    <option value="">— Select —</option>
                    <option value="transfer">{t("admin.transfer") || "Bank Transfer"}</option>
                    <option value="credit_card">{t("admin.credit_card") || "Credit Card"}</option>
                    <option value="cheque">{t("admin.cheque") || "Cheque"}</option>
                    <option value="cod">{t("admin.cod") || "Cash on Delivery"}</option>
                    <option value="stripe">{t("admin.stripe") || "Stripe"}</option>
                  </select>
                </div>
              </div>

              <div className="dashboard-card space-y-4">
                <h3 className="font-display font-bold text-sm uppercase text-muted-foreground">Account</h3>
                <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={nc.create_account}
                    onChange={(e) => setNewCustomer({ ...nc, create_account: e.target.checked })}
                    className="rounded border-input"
                  />
                  Create login account
                </label>
                <p className="text-xs text-muted-foreground">
                  If checked, an email invitation will be sent to the customer with login credentials.
                </p>
              </div>

              <div className="dashboard-card space-y-3">
                <h3 className="font-display font-bold text-sm uppercase text-muted-foreground">Quick Info</h3>
                <div className="text-xs text-muted-foreground space-y-2">
                  <p className="flex items-center gap-1.5"><CheckCircle className="h-3 w-3 text-emerald-500" /> Required: Company Name</p>
                  <p className="flex items-center gap-1.5"><FileText className="h-3 w-3" /> Documents can be uploaded after creation</p>
                  <p className="flex items-center gap-1.5"><Edit className="h-3 w-3" /> All fields editable later</p>
                </div>
              </div>
            </div>
          </div>
        </form>

        {/* Mobile sticky save bar */}
        <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border p-3 z-40 flex gap-2">
          <button
            type="button"
            onClick={handleCreateCustomer}
            disabled={createCustomerMutation.isPending || !nc.company_name.trim()}
            className="flex-1 btn-accent py-3 rounded-sm text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {createCustomerMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {t("admin.customers.create") || "Create Customer"}
          </button>
        </div>
        <div className="sm:hidden h-16" />
      </div>
    );
  }

  /* ═══════════════════════════════════════════════
   * CUSTOMER LIST
   * ═══════════════════════════════════════════════ */

  function toggleSelectCustomer(id: string) {
    setSelectedCustomerIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleSelectAllCustomers() {
    setSelectedCustomerIds(prev => prev.size === filtered.length ? new Set() : new Set(filtered.map(c => c.id)));
  }
  function handleBulkCustomerStatusChange(status: string) {
    selectedCustomerIds.forEach(id => updateCustomerMutation.mutate({ id, data: { status } }));
    setSelectedCustomerIds(new Set());
  }
  async function handleBulkCustomerDelete() {
    const ok = await confirmAction({ title: t("confirm.delete_title"), message: `Delete ${selectedCustomerIds.size} customer(s)?`, variant: "danger" });
    if (ok) { selectedCustomerIds.forEach(id => deleteCustomerMutation.mutate(id)); setSelectedCustomerIds(new Set()); }
  }
  function handleCustomerExportCSV() {
    import("@/lib/admin-export").then(({ exportCSV: doExport }) => {
      const target = selectedCustomerIds.size > 0 ? filtered.filter(c => selectedCustomerIds.has(c.id)) : filtered;
      doExport("customers", ["Company", "Contact", "Email", "Phone", "Category", "Status", "Orders", "Spent"],
        target.map(c => [c.company_name || "", c.full_name || "", c.email, c.phone || "", c.category || "lead", c.status, String(c.total_orders || 0), String(c.total_spent || 0)]));
    });
  }
  function handleCustomerExportPDF() {
    import("@/lib/admin-export").then(({ exportPDF: doExport }) => {
      const target = selectedCustomerIds.size > 0 ? filtered.filter(c => selectedCustomerIds.has(c.id)) : filtered;
      doExport("customers", "Customers", ["Company", "Contact", "Email", "Phone", "Category", "Status", "Orders", "Spent"],
        target.map(c => [c.company_name || "", c.full_name || "", c.email, c.phone || "", c.category || "lead", c.status, String(c.total_orders || 0), `C$${(c.total_spent || 0).toLocaleString()}`]),
        { subtitle: `${target.length} customer(s) — Exported ${new Date().toLocaleDateString()}` });
    });
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={contractOnly ? "Contract Customers" : t("admin.customers.title")}
        subtitle={`${pagination?.total || 0} total`}
        actions={
          <div className="flex gap-2">
            {contractOnly && (
              <Button
                variant="outline"
                size="sm"
                title="Send a test email to erzerino2@gmail.com"
                onClick={async () => {
                  const toastId = "smtp-test";
                  try {
                    showSuccessToast("Sending test email…");
                    const { API_BASE_URL } = await import("@/config/constants");
                    const res = await fetch(`${API_BASE_URL}/test_email.php`, { method: "GET" });
                    const text = await res.text();
                    if (res.ok && /sent successfully/i.test(text)) {
                      showSuccessToast("✅ Test email sent to erzerino2@gmail.com");
                    } else {
                      showErrorToast(`SMTP test failed:\n${text.slice(0, 400)}`);
                    }
                    // Also open the raw response in a new tab for full diagnostics
                    const blob = new Blob([text], { type: "text/plain" });
                    const url = URL.createObjectURL(blob);
                    window.open(url, "_blank");
                  } catch (e: any) {
                    showErrorToast(`SMTP test error: ${e?.message || String(e)}`);
                  }
                }}
              >
                <Mail className="h-3.5 w-3.5 mr-1.5" /> Test Email
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleCustomerExportCSV} title="Export CSV">
              <Download className="h-3.5 w-3.5 mr-1.5" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={handleCustomerExportPDF} title="Export PDF">
              <FileText className="h-3.5 w-3.5 mr-1.5" /> PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => importInputRef.current?.click()}>
              <Upload className="h-3.5 w-3.5 mr-1.5" /> Import
            </Button>
            <input ref={importInputRef} type="file" className="hidden" onChange={handleImportCustomersChange} />
            <Button size="sm" onClick={() => setShowCreateModal(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />{" "}
              {contractOnly
                ? "Create Contract Customer manually"
                : leadOnly
                ? "New Lead"
                : t("admin.customers.add")}
            </Button>
          </div>
        }
      />


      {/* Bulk actions bar */}
      {selectedCustomerIds.size > 0 && (
        <div className="dashboard-card flex flex-wrap items-center gap-3 bg-accent/5 border-accent/30 animate-in slide-in-from-top-2 duration-200">
          <span className="text-sm font-semibold tabular-nums">{selectedCustomerIds.size} selected</span>
          <div className="h-4 w-px bg-border" />
          <Button variant="outline" size="sm" onClick={() => handleBulkCustomerStatusChange("active")}>Set Active</Button>
          <Button variant="outline" size="sm" onClick={() => handleBulkCustomerStatusChange("inactive")}>Set Inactive</Button>
          <Button variant="outline" size="sm" onClick={handleCustomerExportCSV}><Download className="h-3 w-3 mr-1" /> Export</Button>
          <Button variant="destructive" size="sm" onClick={handleBulkCustomerDelete}><Trash2 className="h-3 w-3 mr-1" /> Delete</Button>
          <button onClick={() => setSelectedCustomerIds(new Set())} className="ml-auto text-xs text-muted-foreground hover:text-foreground">Clear</button>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {/* Search & Filter bar */}
          <div className="flex items-center gap-3 p-4 border-b border-border">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={t("admin.customers.search")} className="pl-10" />
            </div>
            {!contractOnly && !leadOnly && (
              <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="all">{t("admin.customers.all_categories")}</option>
                <option value="customer">Customers</option>
              </select>
            )}
          </div>

          {/* Table */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8 px-3">
                  <input type="checkbox" checked={selectedCustomerIds.size === filtered.length && filtered.length > 0} onChange={toggleSelectAllCustomers} className="rounded-sm border-border accent-accent" />
                </TableHead>
                <TableHead>{t("admin.customers.company")}</TableHead>
                <TableHead>{t("admin.customers.email_phone")}</TableHead>
                <TableHead className="text-center">{t("admin.customers.category")}</TableHead>
                <TableHead className="text-right">{t("admin.customers.orders")}</TableHead>
                <TableHead className="text-right">{t("admin.customers.spent")}</TableHead>
                <TableHead className="text-center">{t("admin.status")}</TableHead>
                <TableHead className="text-right w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(c => {
                const isSelected = selectedCustomerIds.has(c.id);
                const statusColor = c.status === "active"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400"
                  : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400";
                const catColor = (c.category || "lead") === "customer"
                  ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400"
                  : (c.category || "lead") === "contract"
                  ? "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950 dark:text-teal-400"
                  : "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-400";
                const taskInfo = customersWithDueTasks.get(c.id);
                return (
                  <TableRow
                    key={c.id}
                    className={`cursor-pointer ${
                      isSelected
                        ? "bg-accent/5"
                        : taskInfo
                        ? (taskInfo.overdue > 0
                            ? "bg-destructive/5 border-l-2 border-l-destructive"
                            : "bg-amber-50/70 dark:bg-amber-950/30 border-l-2 border-l-amber-500")
                        : (c.category || "lead") === "contract"
                        ? "bg-teal-50/60 dark:bg-teal-950/30 border-l-2 border-l-teal-500"
                        : ""
                    }`}
                    onClick={() => setSelectedCustomerId(c.id)}
                  >
                    <TableCell className="px-3" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={isSelected} onChange={() => toggleSelectCustomer(c.id)} className="rounded-sm border-border accent-accent" />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <CustomerAvatar name={c.company_name || c.full_name} size="sm" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="font-medium text-sm">{c.company_name || c.full_name}</p>
                            {taskInfo && (
                              <span
                                title={`${taskInfo.count} task${taskInfo.count > 1 ? "s" : ""} due soon${taskInfo.overdue ? ` (${taskInfo.overdue} overdue)` : ""}`}
                                className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                  taskInfo.overdue > 0
                                    ? "bg-destructive text-destructive-foreground"
                                    : "bg-amber-500 text-white"
                                }`}
                              >
                                <Bell className="h-2.5 w-2.5" />
                                {taskInfo.count}
                              </span>
                            )}
                          </div>
                          {c.company_name && <p className="text-xs text-muted-foreground">{c.full_name}</p>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm">{c.email}</p>
                      {c.phone && <p className="text-xs text-muted-foreground">{c.phone}</p>}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className={`text-[10px] font-semibold ${catColor}`}>{c.category || "lead"}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{c.total_orders || 0}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">C${Number(c.total_spent || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className={statusColor}>{c.status}</Badge>
                    </TableCell>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedCustomerId(c.id)}>
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>View</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        {contractOnly && (() => {
                          const rs = resendStatus[c.id];
                          const isSending = rs?.state === "sending";
                          const tipLabel = rs
                            ? rs.state === "sending"
                              ? "Sending credentials…"
                              : rs.state === "sent"
                              ? `✅ Sent ${new Date(rs.at).toLocaleTimeString()} — ${rs.message}`
                              : `❌ Failed ${new Date(rs.at).toLocaleTimeString()} — ${rs.message}`
                            : "Resend credentials (new password)";
                          const iconClass =
                            rs?.state === "sent"
                              ? "text-emerald-600 hover:text-emerald-600"
                              : rs?.state === "failed"
                              ? "text-destructive hover:text-destructive"
                              : "text-accent hover:text-accent";
                          return (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className={`h-8 w-8 relative ${iconClass}`}
                                    disabled={isSending}
                                    onClick={async () => {
                                      if (!c.email) {
                                        showErrorToast("This customer has no email on file.");
                                        return;
                                      }
                                      const ok = await confirmAction({
                                        title: "Resend Credentials",
                                        message: `Generate a NEW password for "${c.company_name || c.full_name}" and email it to ${c.email}? The current password will no longer work.`,
                                        variant: "warning",
                                      });
                                      if (!ok) return;
                                      setRowResendStatus(c.id, { state: "sending", at: Date.now(), message: "Sending…" });
                                      try {
                                        const res: any = await api.request('POST', `/customers/${c.id}/resend-credentials`, {});
                                        if (res?.success) {
                                          const msg = res.message || `New credentials emailed to ${c.email}`;
                                          setRowResendStatus(c.id, { state: "sent", at: Date.now(), message: msg });
                                          showSuccessToast(msg);
                                        } else if (res?.data?.password) {
                                          const msg = `Email send failed. New password: ${res.data.password}`;
                                          setRowResendStatus(c.id, { state: "failed", at: Date.now(), message: msg });
                                          showErrorToast(`${msg} (copy it now)`);
                                        } else {
                                          const msg = res?.message || "Failed to resend credentials";
                                          setRowResendStatus(c.id, { state: "failed", at: Date.now(), message: msg });
                                          showErrorToast(msg);
                                        }
                                      } catch (err: any) {
                                        const payload = err?.response?.data ?? err?.data;
                                        if (payload?.details?.password) {
                                          const msg = `Email send failed. New password: ${payload.details.password}`;
                                          setRowResendStatus(c.id, { state: "failed", at: Date.now(), message: msg });
                                          showErrorToast(`${msg} (copy it now)`);
                                        } else {
                                          const msg = err?.message || "Failed to resend credentials";
                                          setRowResendStatus(c.id, { state: "failed", at: Date.now(), message: msg });
                                          showErrorToast(msg);
                                        }
                                      }
                                    }}
                                  >
                                    {isSending ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <KeyRound className="h-4 w-4" />
                                    )}
                                    {rs && rs.state !== "sending" && (
                                      <span
                                        className={`absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full flex items-center justify-center ring-2 ring-background ${
                                          rs.state === "sent" ? "bg-emerald-500" : "bg-destructive"
                                        }`}
                                        aria-label={rs.state === "sent" ? "Sent" : "Failed"}
                                      >
                                        {rs.state === "sent" ? (
                                          <CheckCircle2 className="h-2.5 w-2.5 text-white" strokeWidth={3} />
                                        ) : (
                                          <XCircle className="h-2.5 w-2.5 text-white" strokeWidth={3} />
                                        )}
                                      </span>
                                    )}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">{tipLabel}</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          );
                        })()}
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={async () => { const ok = await confirmAction({ title: t("confirm.delete_title"), message: t("confirm.delete_customer"), variant: "danger" }); if (ok) deleteCustomerMutation.mutate(c.id) }}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {filtered.length === 0 && (
            <div className="text-center py-16">
              <UserRound className="h-10 w-10 mx-auto text-muted-foreground/20 mb-3" />
              <p className="text-sm text-muted-foreground">{t("admin.customers.no_customers")}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

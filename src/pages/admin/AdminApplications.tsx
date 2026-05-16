import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api, type AccountApplication, unwrapPagination } from "@/lib/api";
import {
  FileText, Search, Check, X, Eye, Copy, ExternalLink,
  ChevronLeft, ChevronRight, Loader2, Building2, Mail,
  Phone, Clock, AlertCircle, Filter
} from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import ApplicationPdfTemplate from "@/components/ApplicationPdfTemplate";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { resolveAssetUrl } from "@/lib/resolveAssetUrl";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
const STATUS_CFG: Record<string, string> = {
  pending: "badge-warning",
  approved: "badge-success",
  rejected: "badge-destructive",
};

function StatusBadge({ status }: { status: string }) {
  const cn = STATUS_CFG[status] ?? "badge-secondary";
  return <span className={cn}>{status.charAt(0).toUpperCase() + status.slice(1)}</span>;
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex gap-2 text-sm py-2 border-b border-border last:border-0">
      <span className="text-muted-foreground w-40 flex-shrink-0 font-medium">{label}</span>
      <span className="text-foreground font-medium">{value}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */
export default function AdminApplications() {
  const navigate = useNavigate();
  const [apps, setApps] = useState<AccountApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [selected, setSelected] = useState<AccountApplication | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [approvalResult, setApprovalResult] = useState<{ email?: string | null; password?: string | null; company?: string } | null>(null);
  const [showApprovalPreview, setShowApprovalPreview] = useState(false);
  const [editableData, setEditableData] = useState<Record<string, string>>({});
  const pdfRef = useRef<HTMLDivElement>(null);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getAccountApplications(page, 20, statusFilter || undefined);
      setApps(res.data ?? []);
      const pag = unwrapPagination(res);
      setTotalPages(pag?.pages ?? 1);
    } catch (e) {
      console.error("Failed to load applications", e);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => { fetchList(); }, [fetchList]);

  const openDetail = async (id: string) => {
    setDetailLoading(true);
    try {
      const res = await api.getAccountApplication(id);
      setSelected(res.data ?? null);
    } catch { /* ignore */ } finally { setDetailLoading(false); }
  };

  const generatePdfBlob = async (): Promise<Blob | null> => {
    if (!pdfRef.current) return null;
    try {
      const pages = pdfRef.current.querySelectorAll<HTMLElement>('[data-pdf-page]');
      const targets = pages.length > 0 ? Array.from(pages) : [pdfRef.current];
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      for (let i = 0; i < targets.length; i++) {
        if (i > 0) pdf.addPage();
        const canvas = await html2canvas(targets[i], { scale: 2, useCORS: true, logging: false });
        const imgData = canvas.toDataURL("image/jpeg", 0.95);
        const imgProps = pdf.getImageProperties(imgData);
        const ratio = imgProps.width / imgProps.height;
        let w = pdfWidth;
        let h = w / ratio;
        if (h > pdfHeight) { h = pdfHeight; w = h * ratio; }
        pdf.addImage(imgData, "JPEG", 0, 0, w, h);
      }
      return pdf.output("blob");
    } catch (err) {
      console.error("PDF Generation error", err);
      return null;
    }
  };

  const handleDownloadPdf = async () => {
    if (!selected) return;
    setActionLoading(true);
    const blob = await generatePdfBlob();
    if (blob) {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Application_${selected.company_name.replace(/\s+/g, "_")}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } else {
      alert("Failed to generate PDF");
    }
    setActionLoading(false);
  };

  const handleApprove = () => {
    if (!selected) return;
    // Populate editable data from the selected application
    setEditableData({
      company_name: selected.company_name || '',
      neq_tva: selected.neq_tva || '',
      contact_person: selected.contact_person || '',
      contact_title: selected.contact_title || '',
      phone: selected.phone || '',
      email: selected.email || '',
      billing_address: selected.billing_address || '',
      shipping_address: selected.shipping_address || '',
      accounting_contact: selected.accounting_contact || '',
      accounting_phone: selected.accounting_phone || '',
      billing_email: selected.billing_email || '',
      payment_terms: selected.payment_terms || '',
      payment_method: selected.payment_method || '',
      bank_reference: selected.bank_reference || '',
      credit_limit_requested: selected.credit_limit_requested?.toString() || '',
      supplier_ref_1: selected.supplier_ref_1 || '',
      supplier_ref_2: selected.supplier_ref_2 || '',
      parts_needed: selected.parts_needed || '',
      special_requests: selected.special_requests || '',
      sales_representative: selected.sales_representative || '',
    });
    setShowApprovalPreview(true);
  };

  const confirmApprove = async () => {
    if (!selected) return;
    setActionLoading(true);
    try {
      let pdfUrl = undefined;
      
      // Silent PDF Generation & Upload
      const blob = await generatePdfBlob();
      if (blob) {
        try {
          const uploadRes = await api.uploadApplicationPdf(blob, editableData.company_name || selected.company_name);
          pdfUrl = uploadRes.data?.url;
        } catch (uploadErr) {
          console.error("Failed to upload application PDF during approval", uploadErr);
        }
      }

      const res = await api.approveApplication(selected.id, pdfUrl, editableData);
      
      if (res.data?.account_created && res.data.generated_password) {
        setApprovalResult({
          email: res.data.generated_email,
          password: res.data.generated_password,
          company: editableData.company_name || selected.company_name
        });
      }
      setShowApprovalPreview(false);
      setSelected(null);
      fetchList();
    } catch (e) {
      alert("Approval failed: " + (e as Error).message);
    } finally { setActionLoading(false); }
  };

  const handleReject = async () => {
    if (!selected) return;
    setActionLoading(true);
    try {
      await api.rejectAccountApplication(selected.id, rejectReason);
      setSelected(null);
      setShowRejectModal(false);
      setRejectReason("");
      fetchList();
    } catch (e) {
      alert("Rejection failed: " + (e as Error).message);
    } finally { setActionLoading(false); }
  };

  const copyFormLink = () => {
    const url = `${window.location.origin}/apply`;
    navigator.clipboard.writeText(url).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    });
  };

  /* ── Detail View ── */
  if (selected) {
    const a = selected;
    const distTypes = Array.isArray(a.distributor_type) ? a.distributor_type.join(", ") : a.distributor_type ?? "";
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <button onClick={() => setSelected(null)} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
            <ChevronLeft className="h-4 w-4" /> Back to list
          </button>
          <StatusBadge status={a.status} />
        </div>

        <div className="dashboard-card mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="font-display font-bold text-xl md:text-2xl">{a.company_name}</h2>
              <p className="text-sm text-muted-foreground mt-1">Submitted {new Date(a.created_at).toLocaleDateString()} · {a.contact_person}</p>
            </div>
            {a.status === "pending" && (
              <div className="flex gap-2">
                <button onClick={() => setShowRejectModal(true)} disabled={actionLoading}
                  className="px-4 py-2 border border-destructive text-destructive rounded-sm text-sm font-medium hover:bg-destructive/10 transition-colors disabled:opacity-50 flex items-center gap-2">
                  <X className="h-4 w-4" /> Reject
                </button>
                <button onClick={handleDownloadPdf} disabled={actionLoading}
                  className="px-4 py-2 border border-border text-foreground rounded-sm text-sm font-medium hover:bg-secondary transition-colors disabled:opacity-50 flex items-center gap-2">
                  <FileText className="h-4 w-4" /> Download PDF
                </button>
                <button onClick={handleApprove} disabled={actionLoading}
                  className="btn-accent px-4 py-2 rounded-sm text-sm font-medium flex items-center gap-2 disabled:opacity-50">
                  {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Approve & Create Account
                </button>
              </div>
            )}
            {a.status !== "pending" && (
              <button onClick={handleDownloadPdf} disabled={actionLoading}
                className="px-4 py-2 border border-border text-foreground rounded-sm text-sm font-medium hover:bg-secondary transition-colors disabled:opacity-50 flex items-center gap-2">
                <FileText className="h-4 w-4" /> Download Form PDF
              </button>
            )}
          </div>
        </div>

        {/* Hidden Template for PDF Generation */}
        <div style={{ position: "absolute", left: "-9999px", top: "-9999px" }}>
           <div ref={pdfRef}>
             <ApplicationPdfTemplate data={a} signatureData={a.signature_data} />
           </div>
        </div>

        {/* Sections */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Company Info */}
          <div className="dashboard-card">
            <h3 className="text-sm font-bold text-accent uppercase tracking-wider mb-4 flex items-center gap-2">
              <Building2 className="h-4 w-4" /> Company Information
            </h3>
            <InfoRow label="Company Name" value={a.company_name} />
            <InfoRow label="NEQ / TVA" value={a.neq_tva} />
            <InfoRow label="Contact Person" value={a.contact_person} />
            <InfoRow label="Title" value={a.contact_title} />
            <InfoRow label="Phone" value={a.phone} />
            <InfoRow label="Email" value={a.email} />
            <InfoRow label="Distributor Type" value={distTypes} />
            {a.distributor_type_other && <InfoRow label="Other Type" value={a.distributor_type_other} />}
            <InfoRow label="Trucks" value={a.num_trucks?.toString()} />
            <InfoRow label="Trailers" value={a.num_trailers?.toString()} />
          </div>

          {/* Addresses */}
          <div className="dashboard-card">
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4">Addresses</h3>
            <InfoRow label="Billing Address" value={a.billing_address} />
            <InfoRow label="Shipping Address" value={a.shipping_address} />
          </div>

          {/* Accounting */}
          <div className="dashboard-card">
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4">Accounting & Payment</h3>
            <InfoRow label="Accounting Contact" value={a.accounting_contact} />
            <InfoRow label="Accounting Phone" value={a.accounting_phone} />
            <InfoRow label="Billing Email" value={a.billing_email} />
            <InfoRow label="Payment Terms" value={a.payment_terms} />
            <InfoRow label="Payment Method" value={a.payment_method} />
          </div>

          {/* Credit */}
          <div className="dashboard-card">
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4">Credit References</h3>
            <InfoRow label="Bank Reference" value={a.bank_reference} />
            <InfoRow label="Credit Limit" value={a.credit_limit_requested ? `$${a.credit_limit_requested}` : undefined} />
            <InfoRow label="Supplier Ref 1" value={a.supplier_ref_1} />
            <InfoRow label="Supplier Ref 2" value={a.supplier_ref_2} />
          </div>

          {/* Needs */}
          <div className="dashboard-card">
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4">Products & Needs</h3>
            <InfoRow label="Parts Needed" value={a.parts_needed} />
            <InfoRow label="Special Requests" value={a.special_requests} />
            <InfoRow label="Sales Rep" value={a.sales_representative} />
          </div>

          {/* Signature */}
          <div className="dashboard-card">
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4">Authorization</h3>
            <InfoRow label="Signatory" value={a.signatory_name} />
            <InfoRow label="Title" value={a.signatory_title} />
            <InfoRow label="Date" value={a.signature_date} />
            { (a.signature_data || (a as any).signature_url) && (
              <div className="mt-3">
                <p className="text-xs text-muted-foreground mb-2">Signature:</p>
                <div className="bg-white rounded-lg p-3 inline-block border border-border">
                  <img
                    src={(a as any).signature_url ? resolveAssetUrl((a as any).signature_url) : a.signature_data}
                    alt="Signature"
                    className="h-20 object-contain"
                    onError={(e) => {
                      // Fallback: if URL load fails and we have inline base64 data, use it
                      const img = e.currentTarget as HTMLImageElement;
                      if (a.signature_data && img.src !== a.signature_data) {
                        img.src = a.signature_data;
                      }
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Rejection reason if rejected */}
        {a.status === "rejected" && a.rejection_reason && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-5">
            <h3 className="text-sm font-bold text-destructive mb-2">Rejection Reason</h3>
            <p className="text-sm text-foreground font-medium">{a.rejection_reason}</p>
          </div>
        )}

        {/* Approval Preview Modal */}
        {showApprovalPreview && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setShowApprovalPreview(false)}>
            <div className="bg-card border border-border rounded-xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto space-y-6 shadow-2xl" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-foreground">Review & Approve Application</h3>
              <p className="text-sm text-muted-foreground">Review and edit the information below before confirming approval. An email will be sent after confirmation.</p>
              
              <div className="grid sm:grid-cols-2 gap-4">
                {[
                  { key: 'company_name', label: 'Company Name' },
                  { key: 'neq_tva', label: 'NEQ / TVA' },
                  { key: 'contact_person', label: 'Contact Person' },
                  { key: 'contact_title', label: 'Title' },
                  { key: 'phone', label: 'Phone' },
                  { key: 'email', label: 'Email' },
                  { key: 'billing_address', label: 'Billing Address', full: true },
                  { key: 'shipping_address', label: 'Shipping Address', full: true },
                  { key: 'accounting_contact', label: 'Accounting Contact' },
                  { key: 'accounting_phone', label: 'Accounting Phone' },
                  { key: 'billing_email', label: 'Billing Email' },
                  { key: 'payment_terms', label: 'Payment Terms' },
                  { key: 'payment_method', label: 'Payment Method' },
                  { key: 'bank_reference', label: 'Bank Reference', full: true },
                  { key: 'credit_limit_requested', label: 'Credit Limit Requested' },
                  { key: 'supplier_ref_1', label: 'Supplier Ref 1', full: true },
                  { key: 'supplier_ref_2', label: 'Supplier Ref 2', full: true },
                  { key: 'parts_needed', label: 'Parts Needed', full: true },
                  { key: 'special_requests', label: 'Special Requests', full: true },
                  { key: 'sales_representative', label: 'Sales Representative' },
                ].map(({ key, label, full }) => (
                  <div key={key} className={full ? 'sm:col-span-2' : ''}>
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">{label}</label>
                    {full ? (
                      <textarea
                        className="w-full px-3 py-2 bg-background border border-border/80 rounded-lg text-sm text-foreground outline-none focus:border-accent resize-none"
                        rows={2}
                        value={editableData[key] || ''}
                        onChange={e => setEditableData(prev => ({ ...prev, [key]: e.target.value }))}
                      />
                    ) : (
                      <input
                        className="w-full px-3 py-2 bg-background border border-border/80 rounded-lg text-sm text-foreground outline-none focus:border-accent"
                        value={editableData[key] || ''}
                        onChange={e => setEditableData(prev => ({ ...prev, [key]: e.target.value }))}
                      />
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <button onClick={() => setShowApprovalPreview(false)} className="px-5 py-2 text-sm text-muted-foreground hover:text-foreground font-medium rounded-lg hover:bg-secondary transition-colors">Cancel</button>
                <button onClick={confirmApprove} disabled={actionLoading}
                  className="btn-accent px-5 py-2 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50">
                  {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {actionLoading ? "Approving..." : "Confirm & Send Email"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reject Modal */}
        {showRejectModal && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setShowRejectModal(false)}>
            <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md space-y-4 shadow-2xl" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-foreground">Reject Application</h3>
              <p className="text-sm text-muted-foreground">Optionally provide a reason for rejection:</p>
              <textarea
                className="w-full px-4 py-3 bg-background border border-border/80 rounded-lg text-foreground outline-none focus:border-destructive resize-none"
                rows={3} value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="Reason for rejection..."
              />
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setShowRejectModal(false)} className="px-5 py-2 text-sm text-muted-foreground hover:text-foreground font-medium rounded-lg hover:bg-secondary transition-colors">Cancel</button>
                <button onClick={handleReject} disabled={actionLoading}
                  className="px-5 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 disabled:opacity-50 transition-colors">
                  {actionLoading ? "Rejecting..." : "Confirm Reject"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ── List View ── */
  return (
    <div className="space-y-6">
      {/* Approved Success Modal */}
      {approvalResult && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md space-y-6 shadow-2xl">
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-success/10 border-4 border-success/20 flex items-center justify-center">
                <Check className="h-8 w-8 text-success" strokeWidth={3} />
              </div>
              <h3 className="text-xl font-bold text-foreground">Application Approved</h3>
              <p className="text-sm text-muted-foreground font-medium">
                {approvalResult.company} has been approved. A new customer and user account have been created. An email has been sent to the user with these credentials.
              </p>
            </div>
            
            <div className="bg-secondary border border-border rounded-lg p-4 space-y-3">
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Portal Email</label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 bg-background border border-border rounded px-3 py-2 text-sm text-foreground">{approvalResult.email}</code>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Default Password</label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 bg-background border border-border rounded px-3 py-2 text-sm text-foreground">{approvalResult.password}</code>
                  <button 
                    onClick={() => navigator.clipboard.writeText(approvalResult.password || '')}
                    className="p-2 bg-background border border-border rounded hover:bg-secondary transition-colors"
                    title="Copy Password"
                  >
                    <Copy className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
              </div>
            </div>
            
            <div className="flex justify-center pt-2">
              <button onClick={() => setApprovalResult(null)} className="btn-accent w-full py-2.5 rounded-lg text-sm font-medium">Done</button>
            </div>
          </div>
        </div>
      )}
      <AdminPageHeader
        title="Account Applications"
        subtitle="Review and manage customer account applications"
        actions={
          <div className="flex flex-wrap items-center gap-2 self-start">
            <button onClick={copyFormLink}
              className="px-4 py-2 border border-border rounded-sm text-sm font-medium flex items-center gap-2 hover:bg-secondary transition-colors">
              {linkCopied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
              {linkCopied ? "Copied!" : "Copy Form Link"}
            </button>
            <a href="/apply" target="_blank" rel="noopener noreferrer"
               className="btn-accent px-4 py-2 rounded-sm text-sm font-medium flex items-center gap-2">
              <ExternalLink className="h-4 w-4" /> Open Form
            </a>
          </div>
        }
      />

      {/* Filters & Table */}
      <div className="dashboard-card">
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
            {["", "pending", "approved", "rejected"].map(s => (
              <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
                className={`px-3 py-1.5 text-xs font-medium rounded-sm border whitespace-nowrap transition-colors ${
                  statusFilter === s
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border text-muted-foreground hover:bg-secondary"
                }`}>
                {s === "" ? "All Statuses" : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Table Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : apps.length === 0 ? (
          <div className="text-center py-20">
            <FileText className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No applications found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-header">
                  <th className="text-left px-3 py-2">Company</th>
                  <th className="text-left px-3 py-2">Contact</th>
                  <th className="text-left px-3 py-2">Status</th>
                  <th className="text-left px-3 py-2">Date</th>
                  <th className="text-right px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {apps.map(a => (
                  <tr key={a.id} className="hover:bg-secondary/50 transition-colors cursor-pointer" onClick={() => openDetail(a.id)}>
                    <td className="px-3 py-3">
                      <p className="font-medium text-foreground">{a.company_name}</p>
                      <p className="text-xs text-muted-foreground">{a.email}</p>
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-medium">{a.contact_person}</p>
                      {a.phone && <p className="text-xs text-muted-foreground">{a.phone}</p>}
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge status={a.status} />
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {new Date(a.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <button className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-sm transition-colors">
                        <Eye className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 mt-4 border-t border-border">
             <div className="text-xs text-muted-foreground">Showing page {page} of {totalPages}</div>
             <div className="flex items-center gap-1">
                <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1}
                  className="p-1 rounded border border-border text-muted-foreground hover:bg-secondary disabled:opacity-30">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages}
                  className="p-1 rounded border border-border text-muted-foreground hover:bg-secondary disabled:opacity-30">
                  <ChevronRight className="h-4 w-4" />
                </button>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}

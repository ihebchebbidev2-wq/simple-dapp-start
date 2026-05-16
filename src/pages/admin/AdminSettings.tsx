import React, { useEffect, useMemo, useRef, useState } from "react";
import { Save, CheckCircle, Loader2, Upload, Trash2, ExternalLink, Store, Receipt, Bell, FolderOpen } from "lucide-react";
import {
  useAdminSettingsList,
  usePatchSettingsBulk,
  useRegistryFiles,
  useUploadRegistryFile,
  useDeleteRegistryFile,
} from "@/hooks/useApi";
import { unwrapApiList, resolveBackendUploadUrl } from "@/lib/api";
import { showErrorToast, showSuccessToast } from "@/lib/toast";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminPageError, AdminPageLoading } from "@/components/admin/AdminPageState";
import { useConfirm } from "@/components/ConfirmDialog";
import { useLanguage } from "@/contexts/LanguageContext";

type SettingRow = { setting_key: string; setting_value: string | null };

function rowsToMap(rows: SettingRow[]): Record<string, string> {
  const m: Record<string, string> = {};
  for (const r of rows) {
    m[r.setting_key] = String(r.setting_value ?? "");
  }
  return m;
}

function ToggleSwitch({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="admin-toggle"
      data-checked={String(checked)}
    />
  );
}

function SectionCard({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="dashboard-card">
      <div className="flex items-center gap-3 mb-5 pb-3 border-b border-border">
        <div className="stat-icon stat-icon--accent">
          <Icon className="h-4.5 w-4.5" />
        </div>
        <h3 className="font-display font-bold text-sm uppercase tracking-wider">{title}</h3>
      </div>
      {children}
    </div>
  );
}

export default function AdminSettings() {
  const confirmAction = useConfirm();
  const { t } = useLanguage();
  const { data: adminRes, isLoading: loadingSettings, isError, refetch } = useAdminSettingsList();
  const patchBulk = usePatchSettingsBulk();
  const uploadReg = useUploadRegistryFile();
  const deleteReg = useDeleteRegistryFile();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const rows = useMemo(() => {
    const d = adminRes?.data;
    return Array.isArray(d) ? (d as SettingRow[]) : [];
  }, [adminRes]);

  const [values, setValues] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<string | null>(null);
  const seeded = useRef(false);

  useEffect(() => {
    if (rows.length === 0) return;
    if (!seeded.current) {
      setValues(rowsToMap(rows));
      seeded.current = true;
    }
  }, [rows]);

  const v = (key: string, fallback = "") => values[key] ?? fallback;
  const setK = (key: string, val: string) => setValues((prev) => ({ ...prev, [key]: val }));

  async function saveKeys(section: string, keys: string[]) {
    const payload: Record<string, string> = {};
    for (const k of keys) {
      if (values[k] !== undefined) payload[k] = values[k];
    }
    try {
      await patchBulk.mutateAsync(payload);
      showSuccessToast("Settings", "Saved successfully.");
      setSaved(section);
      setTimeout(() => setSaved(null), 2000);
      refetch();
    } catch (e) {
      showErrorToast("Settings", e instanceof Error ? e.message : "Save failed");
    }
  }

  const { data: filesRes, isLoading: filesLoading, refetch: refetchFiles } = useRegistryFiles(30, 0);
  const files = unwrapApiList<Record<string, unknown>>(filesRes, []);

  const handleRegistryFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    uploadReg.mutate(
      { file, uploadType: "admin_misc" },
      {
        onSuccess: () => {
          showSuccessToast("File", "File registered.");
          refetchFiles();
        },
        onError: (err: unknown) => showErrorToast("File", err instanceof Error ? err.message : "Upload failed"),
      }
    );
  };

  function SaveButton({ section, keys }: { section: string; keys: string[] }) {
    return (
      <button
        type="button"
        disabled={patchBulk.isPending}
        onClick={() => saveKeys(section, keys)}
        className="admin-btn--primary px-5 py-2 mt-2"
      >
        {saved === section ? (
          <><CheckCircle className="h-4 w-4" /> Saved!</>
        ) : patchBulk.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <><Save className="h-4 w-4" /> Save changes</>
        )}
      </button>
    );
  }

  if (loadingSettings && rows.length === 0) {
    return <AdminPageLoading message="Loading settings" />;
  }

  if (isError) {
    return (
      <AdminPageError
        message="Could not load settings. Ensure you are logged in as admin."
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Settings" subtitle="Configure your store preferences and integrations" />

      <div className="grid lg:grid-cols-2 gap-4 md:gap-6">
        {/* General */}
        <SectionCard title="General" icon={Store}>
          <div className="space-y-4">
            <div>
              <label className="admin-label">Store name</label>
              <input value={v("store_name", "REMQUIP")} onChange={(e) => setK("store_name", e.target.value)} className="admin-input" />
            </div>
            <div>
              <label className="admin-label">Contact email</label>
              <input type="email" value={v("contact_email")} onChange={(e) => setK("contact_email", e.target.value)} className="admin-input" />
            </div>
            <div>
              <label className="admin-label">Phone</label>
              <input value={v("contact_phone")} onChange={(e) => setK("contact_phone", e.target.value)} className="admin-input" />
            </div>
            <div>
              <label className="admin-label">Address</label>
              <textarea value={v("store_address")} onChange={(e) => setK("store_address", e.target.value)} rows={2} className="admin-input resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="admin-label">Currency</label>
                <select value={v("default_currency", "CAD")} onChange={(e) => setK("default_currency", e.target.value)} className="admin-input">
                  <option>CAD</option>
                  <option>USD</option>
                  <option>EUR</option>
                </select>
              </div>
              <div>
                <label className="admin-label">Language</label>
                <select value={v("default_language", "en")} onChange={(e) => setK("default_language", e.target.value)} className="admin-input">
                  <option value="en">English</option>
                  <option value="fr">Français</option>
                  <option value="es">Español</option>
                  <option value="de">Deutsch</option>
                </select>
              </div>
            </div>
            <div>
              <label className="admin-label">Supported locales</label>
              <input
                value={(() => {
                  const raw = v("supported_locales", '["en","fr"]');
                  try {
                    const arr = JSON.parse(raw);
                    return Array.isArray(arr) ? arr.map((x: unknown) => String(x)).join(", ") : raw;
                  } catch { return raw; }
                })()}
                onChange={(e) => {
                  const s = e.target.value.trim();
                  const arr = s ? s.split(/[\s,]+/).map((x) => x.trim().toLowerCase()).filter(Boolean) : ["en", "fr"];
                  setK("supported_locales", JSON.stringify([...new Set(arr)]));
                }}
                placeholder="en, fr, es, de"
                className="admin-input font-mono"
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                Comma-separated locale codes for CMS, categories, and banners.
              </p>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm">Portal email notifications default</span>
              <ToggleSwitch
                checked={v("portal_email_notifications_default", "1") === "1"}
                onChange={(c) => setK("portal_email_notifications_default", c ? "1" : "0")}
              />
            </div>
            <SaveButton section="general" keys={["store_name", "contact_email", "contact_phone", "store_address", "default_currency", "default_language", "supported_locales", "portal_email_notifications_default"]} />
          </div>
        </SectionCard>

        {/* Tax & Shipping */}
        <SectionCard title="Tax & Shipping" icon={Receipt}>
          <div className="space-y-4">
            <div>
              <label className="admin-label">GST rate (%)</label>
              <input type="text" value={v("tax_gst_rate", "5.0")} onChange={(e) => setK("tax_gst_rate", e.target.value)} className="admin-input" />
            </div>
            <div>
              <label className="admin-label">QST rate (%)</label>
              <input type="text" value={v("tax_qst_rate", "9.975")} onChange={(e) => setK("tax_qst_rate", e.target.value)} className="admin-input" />
            </div>
            <div>
              <label className="admin-label">Free shipping threshold (CAD)</label>
              <input type="text" value={v("free_shipping_threshold", "500")} onChange={(e) => setK("free_shipping_threshold", e.target.value)} className="admin-input" />
            </div>
            <div>
              <label className="admin-label">Flat shipping rate (CAD)</label>
              <input type="text" value={v("flat_shipping_rate", "25")} onChange={(e) => setK("flat_shipping_rate", e.target.value)} className="admin-input" />
            </div>
            <SaveButton section="tax" keys={["tax_gst_rate", "tax_qst_rate", "free_shipping_threshold", "flat_shipping_rate"]} />
          </div>
        </SectionCard>

        {/* Email Notifications */}
        <SectionCard title="Email Notifications" icon={Bell}>
          <p className="text-xs text-muted-foreground mb-4">
            Outbound mail uses OVH SMTP (HTML templates). Shipped and status updates go to the customer.
          </p>
          <div className="grid sm:grid-cols-2 gap-3 mb-5">
            <div>
              <label className="admin-label">Alert recipient</label>
              <input type="email" className="admin-input" placeholder="Uses contact email if empty" value={v("notif_recipient_email", "")} onChange={(e) => setK("notif_recipient_email", e.target.value)} />
            </div>
            <div>
              <label className="admin-label">From address</label>
              <input type="email" className="admin-input" placeholder="Uses contact email if empty" value={v("notif_from_email", "")} onChange={(e) => setK("notif_from_email", e.target.value)} />
            </div>
          </div>
          
          <div className="grid sm:grid-cols-2 gap-3 mb-5 border-t border-border pt-4">
            <div>
              <label className="admin-label">SMTP Host</label>
              <input className="admin-input" placeholder="e.g. ssl0.ovh.net" value={v("smtp_host", "")} onChange={(e) => setK("smtp_host", e.target.value)} />
            </div>
            <div>
              <label className="admin-label">SMTP Port</label>
              <input className="admin-input" placeholder="465 or 587" value={v("smtp_port", "")} onChange={(e) => setK("smtp_port", e.target.value)} />
            </div>
            <div>
              <label className="admin-label">SMTP User</label>
              <input className="admin-input" value={v("smtp_user", "")} onChange={(e) => setK("smtp_user", e.target.value)} />
            </div>
            <div>
              <label className="admin-label">SMTP Password</label>
              <input type="password" title="SMTP Password" name="smtp_pass" id="smtp_pass" className="admin-input" value={v("smtp_pass", "")} onChange={(e) => setK("smtp_pass", e.target.value)} />
              <p className="text-[10px] text-muted-foreground mt-1">
                Defaults to "Dadouhibou2025" if empty.
              </p>
            </div>
            <div>
              <label className="admin-label">Encryption</label>
              <select className="admin-input" value={v("smtp_encryption", "ssl")} onChange={(e) => setK("smtp_encryption", e.target.value)}>
                <option value="ssl">SSL (Port 465)</option>
                <option value="tls">TLS/STARTTLS (Port 587)</option>
              </select>
            </div>
          </div>
          <div className="space-y-0.5">
            {[
              { key: "notif_new_order", label: "New order confirmation" },
              { key: "notif_order_shipped", label: "Order shipped" },
              { key: "notif_order_status", label: "Order status updates" },
              { key: "notif_low_stock", label: "Low stock alert" },
              { key: "notif_new_customer", label: "New customer registration" },
              { key: "notif_weekly_summary", label: "Weekly sales summary" },
            ].map((n) => (
              <div key={n.key} className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
                <span className="text-sm">{n.label}</span>
                <ToggleSwitch
                  checked={v(n.key, "0") === "1"}
                  onChange={(c) => setK(n.key, c ? "1" : "0")}
                />
              </div>
            ))}
          </div>
          <SaveButton section="notif" keys={["notif_recipient_email", "notif_from_email", "notif_new_order", "notif_order_shipped", "notif_order_status", "notif_low_stock", "notif_new_customer", "notif_weekly_summary", "smtp_host", "smtp_port", "smtp_user", "smtp_pass", "smtp_encryption"]} />
        </SectionCard>

        {/* File Registry */}
        <SectionCard title="File Registry" icon={FolderOpen}>
          <p className="text-xs text-muted-foreground mb-4">
            Generic uploads (file_uploads). Product images use separate upload.
          </p>
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleRegistryFile} />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadReg.isPending}
            className="admin-btn--secondary mb-4"
          >
            {uploadReg.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Upload file
          </button>
          {filesLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : files.length === 0 ? (
            <p className="text-sm text-muted-foreground">No files in registry yet.</p>
          ) : (
            <ul className="space-y-2 max-h-64 overflow-y-auto admin-scroll">
              {files.map((f) => {
                const id = String(f.id ?? "");
                const path = String(f.file_path ?? "");
                const name = String(f.original_filename ?? path);
                return (
                  <li key={id} className="flex items-center justify-between gap-2 text-sm border border-border rounded-lg px-3 py-2 hover:bg-muted/30 transition-colors">
                    <a
                      href={resolveBackendUploadUrl(path)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent hover:underline truncate flex items-center gap-1.5 min-w-0 font-medium"
                    >
                      {name}
                      <ExternalLink className="h-3 w-3 flex-shrink-0" />
                    </a>
                    <button
                      type="button"
                      title="Remove"
                      disabled={deleteReg.isPending}
                      onClick={async () => {
                        const ok = await confirmAction({ title: t("confirm.delete_title"), message: t("confirm.delete_file"), variant: "danger" });
                        if (!ok) return;
                        deleteReg.mutate(id, {
                          onSuccess: () => { showSuccessToast("File", "Removed."); refetchFiles(); },
                          onError: (err: unknown) => showErrorToast("File", err instanceof Error ? err.message : "Delete failed"),
                        });
                      }}
                      className="p-1.5 text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

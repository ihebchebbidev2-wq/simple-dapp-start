import React, { useState, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import SignatureCanvas from "react-signature-canvas";
import { api } from "@/lib/api";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Building2, User, Phone, Mail, MapPin, CreditCard, FileText, PenTool,
  ChevronRight, ChevronLeft, Check, Loader2, Truck, AlertCircle, Copy
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface FormData {
  company_name: string;
  neq_tva: string;
  contact_person: string;
  contact_title: string;
  phone: string;
  email: string;
  distributor_type: string[];
  distributor_type_other: string;
  num_trucks: string;
  num_trailers: string;
  billing_address: string;
  shipping_address: string;
  accounting_contact: string;
  accounting_phone: string;
  billing_email: string;
  payment_terms: string;
  payment_method: string;
  bank_reference: string;
  credit_limit_requested: string;
  supplier_ref_1: string;
  supplier_ref_2: string;
  parts_needed: string;
  special_requests: string;
  sales_representative: string;
  signatory_name: string;
  signatory_title: string;
  signature_date: string;
  signature_url: string;
}

const INITIAL_FORM: FormData = {
  company_name: "", neq_tva: "", contact_person: "", contact_title: "",
  phone: "", email: "", distributor_type: [], distributor_type_other: "",
  num_trucks: "", num_trailers: "", billing_address: "", shipping_address: "",
  accounting_contact: "", accounting_phone: "", billing_email: "",
  payment_terms: "", payment_method: "", bank_reference: "",
  credit_limit_requested: "", supplier_ref_1: "", supplier_ref_2: "",
  parts_needed: "", special_requests: "", sales_representative: "",
  signatory_name: "", signatory_title: "",
  signature_date: new Date().toISOString().slice(0, 10),
  signature_url: "",
};

const STEPS = [
  { label: "Company", icon: Building2 },
  { label: "Addresses", icon: MapPin },
  { label: "Payment", icon: CreditCard },
  { label: "Credit", icon: FileText },
  { label: "Products", icon: Truck },
  { label: "Signature", icon: PenTool },
];

const DISTRIBUTOR_OPTIONS = [
  { value: "reseller", label: "Revendeur / Reseller" },
  { value: "logistics", label: "Logistique / Logistics Co." },
  { value: "garage", label: "Garage / Repair Shop" },
  { value: "other", label: "Autre / Other" },
];

const PAYMENT_TERMS_OPTIONS = [
  { value: "on_delivery", label: "Paiement à la livraison / On Delivery" },
  { value: "net_15", label: "Net 15 jours / Net 15 Days" },
  { value: "net_30", label: "Net 30 jours / Net 30 Days" },
  { value: "on_order", label: "Paiement à la commande / On Order" },
];

const PAYMENT_METHOD_OPTIONS = [
  { value: "transfer", label: "Virement / Transfer" },
  { value: "cheque", label: "Chèque / Cheque" },
  { value: "credit_card", label: "Carte de crédit / Credit Card" },
  { value: "other", label: "Autre / Other" },
];

/* ------------------------------------------------------------------ */
/*  Shared Input Components                                            */
/* ------------------------------------------------------------------ */
function FormField({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div className="space-y-1.5 font-medium">
      <label className="block text-xs font-display font-black uppercase tracking-widest text-muted-foreground">
        {label} {required && <span className="text-accent">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputClass = "w-full bg-background border-2 border-border/60 hover:border-border rounded-xl px-4 py-3.5 text-sm font-medium text-foreground outline-none focus:border-accent transition-all shadow-sm";
const textareaClass = inputClass + " resize-none";

function SectionTitle({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-4 mb-8">
      <div className="w-12 h-12 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center">
        <Icon className="h-6 w-6 text-accent" />
      </div>
      <h3 className="text-xl font-display font-black tracking-tight text-foreground">{title}</h3>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */
export default function CustomerApplicationPage() {
  const { t } = useLanguage();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploadingSignature, setUploadingSignature] = useState(false);
  const sigRef = useRef<SignatureCanvas | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const set = useCallback((field: keyof FormData, value: string | string[]) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => { const next = { ...prev }; delete next[field]; return next; });
  }, []);

  /* Validation per step */
  const validateStep = (s: number): Record<string, string> => {
    const e: Record<string, string> = {};
    if (s === 0) {
      if (!form.company_name.trim()) e.company_name = "Required";
      if (!form.contact_person.trim()) e.contact_person = "Required";
      if (!form.phone.trim()) e.phone = "Required";
      if (!form.email.trim()) e.email = "Required";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Invalid email";
    }
    if (s === 5) {
      if (!form.signatory_name.trim()) e.signatory_name = "Required";
      if (!signatureData && !form.signature_url) e.signature = "Please sign or upload a signature";
    }
    return e;
  };

  const goNext = () => {
    const errs = validateStep(step);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setStep(Math.min(step + 1, STEPS.length - 1));
  };
  const goBack = () => setStep(Math.max(step - 1, 0));

  const handleSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploadingSignature(true);
    setErrors(prev => ({ ...prev, signature: "" }));
    try {
      const res = await api.uploadSignature(file);
      if (res.data?.url) {
        set("signature_url", res.data.url);
        // Clear manual signature if an image is uploaded
        sigRef.current?.clear();
        setSignatureData(null);
      }
    } catch (err: any) {
      setErrors(prev => ({ ...prev, signature: "Upload failed: " + (err.userMessage || "Error") }));
    } finally {
      setUploadingSignature(false);
    }
  };

  const handleSubmit = async () => {
    const errs = validateStep(step);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = { ...form };
      payload.signature_data = signatureData;
      if (form.num_trucks) payload.num_trucks = parseInt(form.num_trucks, 10);
      if (form.num_trailers) payload.num_trailers = parseInt(form.num_trailers, 10);
      if (form.credit_limit_requested) payload.credit_limit_requested = parseFloat(form.credit_limit_requested);
      const res = await api.submitAccountApplication(payload as any);
      setSubmittedId(res.data?.id ?? null);
      setSubmitted(true);
    } catch (err: any) {
      setErrors({ _submit: err?.userMessage || err?.message || "Submission failed. Please try again." });
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Success screen ── */
  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-lg text-center space-y-6">
          <div className="w-24 h-24 mx-auto rounded-full bg-success/10 border-4 border-success/20 flex items-center justify-center">
            <Check className="h-12 w-12 text-success" strokeWidth={3} />
          </div>
          <h1 className="text-4xl font-display font-black tracking-tight text-foreground uppercase">{t("application.submitted_title")}</h1>
          <p className="text-muted-foreground text-lg font-medium">
            {t("application.submitted_message")} <strong className="text-foreground">{form.email}</strong>.
          </p>
          {submittedId && (
            <p className="text-sm text-muted-foreground font-bold">{t("application.ref")}: <code className="text-accent">{submittedId.slice(0, 8)}</code></p>
          )}
          <Link to="/" className="inline-block mt-8 px-10 py-4 bg-foreground text-background font-display font-black uppercase tracking-widest text-sm rounded-xl hover:bg-accent hover:text-white transition-all shadow-xl hover:-translate-y-1">
            {t("application.return_home")}
          </Link>
        </div>
      </div>
    );
  }

  /* ── Form steps ── */
  return (
    <div className="bg-background min-h-screen">
      {/* Decorative background */}
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-[radial-gradient(circle_at_100%_0%,hsl(var(--accent)/0.03),transparent_60%)] pointer-events-none" />

      <div className="container mx-auto max-w-4xl px-4 py-20 md:py-32 relative z-10">
        
        <header className="mb-12 text-center max-w-3xl mx-auto">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="h-px w-8 bg-accent/40" />
            <span className="font-display font-black uppercase tracking-[0.2em] text-[10px] text-accent">
              Application
            </span>
            <div className="h-px w-8 bg-accent/40" />
          </div>
          <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-black uppercase tracking-tighter text-foreground leading-[0.95] mb-4">
            Ouverture de compte
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base font-medium leading-relaxed max-w-xl mx-auto">
            Veuillez compléter le formulaire de demande d'ouverture de compte client. / Please complete the customer account application form.
          </p>
        </header>

        {/* Step indicators */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-12">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const isActive = i === step;
            const isDone = i < step;
            return (
              <React.Fragment key={i}>
                <button
                  type="button"
                  onClick={() => { if (isDone) setStep(i); }}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-display font-black uppercase tracking-widest transition-all duration-300 ${
                    isActive ? "bg-accent/10 border-2 border-accent text-accent shadow-sm"
                    : isDone ? "bg-success/10 border-2 border-success/30 text-success cursor-pointer hover:bg-success/20"
                    : "bg-muted/50 border-2 border-border/50 text-muted-foreground opacity-70"
                  }`}
                >
                  {isDone ? <Check className="h-4 w-4" strokeWidth={3} /> : <Icon className="h-4 w-4" />}
                  <span className="hidden sm:inline">{s.label}</span>
                </button>
                {i < STEPS.length - 1 && (
                  <div className={`hidden sm:block w-8 h-0.5 rounded-full ${isDone ? "bg-success/40" : "bg-border/60"}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Form card */}
        <div className="bg-card border border-border/80 rounded-3xl p-6 sm:p-10 md:p-12 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[radial-gradient(circle_at_100%_0%,hsl(var(--accent)/0.05),transparent_70%)] pointer-events-none" />
          
          <div className="relative z-10 space-y-8">

          {/* Step 0: Company Information */}
          {step === 0 && (
            <>
              <SectionTitle icon={Building2} title="1. Informations de l'entreprise / Company Information" />
              <div className="grid sm:grid-cols-2 gap-5">
                <FormField label="Raison sociale / Company Name" required>
                  <input className={inputClass} value={form.company_name} onChange={e => set("company_name", e.target.value)} placeholder="Company Name" />
                  {errors.company_name && <p className="text-xs text-red-400 mt-1">{errors.company_name}</p>}
                </FormField>
                <FormField label="No d'entreprise / NEQ / TVA">
                  <input className={inputClass} value={form.neq_tva} onChange={e => set("neq_tva", e.target.value)} placeholder="NEQ / TVA" />
                </FormField>
                <FormField label="Personne contact / Contact Person" required>
                  <input className={inputClass} value={form.contact_person} onChange={e => set("contact_person", e.target.value)} placeholder="Full Name" />
                  {errors.contact_person && <p className="text-xs text-red-400 mt-1">{errors.contact_person}</p>}
                </FormField>
                <FormField label="Titre / Fonction / Title">
                  <input className={inputClass} value={form.contact_title} onChange={e => set("contact_title", e.target.value)} placeholder="Title / Position" />
                </FormField>
                <FormField label="Téléphone / Phone" required>
                  <input className={inputClass} type="tel" value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="+1 (xxx) xxx-xxxx" />
                  {errors.phone && <p className="text-xs text-red-400 mt-1">{errors.phone}</p>}
                </FormField>
                <FormField label="Courriel / Email" required>
                  <input className={inputClass} type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="email@company.com" />
                  {errors.email && <p className="text-xs text-red-400 mt-1">{errors.email}</p>}
                </FormField>
              </div>

              <FormField label="Type de distributeur / Distributor Type">
                <div className="flex flex-wrap gap-3 mt-1">
                  {DISTRIBUTOR_OPTIONS.map(opt => (
                    <label key={opt.value} className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 cursor-pointer transition-all text-sm font-semibold ${
                      form.distributor_type.includes(opt.value)
                        ? "border-accent bg-accent/5 text-accent"
                        : "border-border/60 bg-transparent text-muted-foreground hover:border-border hover:bg-muted/20"
                    }`}>
                      <input
                        type="checkbox"
                        className="hidden"
                        checked={form.distributor_type.includes(opt.value)}
                        onChange={() => {
                          const arr = form.distributor_type.includes(opt.value)
                            ? form.distributor_type.filter(v => v !== opt.value)
                            : [...form.distributor_type, opt.value];
                          set("distributor_type", arr);
                        }}
                      />
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                        form.distributor_type.includes(opt.value) ? "border-accent bg-accent" : "border-muted-foreground/30"
                      }`}>
                        {form.distributor_type.includes(opt.value) && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
                      </div>
                      {opt.label}
                    </label>
                  ))}
                </div>
              </FormField>

              {form.distributor_type.includes("other") && (
                <FormField label="Préciser / Specify">
                  <input className={inputClass} value={form.distributor_type_other} onChange={e => set("distributor_type_other", e.target.value)} placeholder="Please specify..." />
                </FormField>
              )}

              <div className="grid sm:grid-cols-2 gap-5">
                <FormField label="Nombre de camions / Number of Trucks">
                  <input className={inputClass} type="number" min="0" value={form.num_trucks} onChange={e => set("num_trucks", e.target.value)} placeholder="0" />
                </FormField>
                <FormField label="Nombre de remorques / Number of Trailers">
                  <input className={inputClass} type="number" min="0" value={form.num_trailers} onChange={e => set("num_trailers", e.target.value)} placeholder="0" />
                </FormField>
              </div>
            </>
          )}

          {/* Step 1: Addresses */}
          {step === 1 && (
            <>
              <SectionTitle icon={MapPin} title="2. Adresses / Addresses" />
              <FormField label="Adresse de facturation / Billing Address">
                <textarea className={textareaClass} rows={3} value={form.billing_address} onChange={e => set("billing_address", e.target.value)} placeholder="Full billing address..." />
              </FormField>
              <FormField label="Adresse de livraison / Shipping Address">
                <textarea className={textareaClass} rows={3} value={form.shipping_address} onChange={e => set("shipping_address", e.target.value)} placeholder="Full shipping address (leave empty if same as billing)..." />
              </FormField>
              <button type="button" className="text-xs font-bold uppercase tracking-widest text-accent hover:underline flex items-center gap-1 mt-2"
                onClick={() => set("shipping_address", form.billing_address)}>
                ↳ Same as billing address
              </button>
            </>
          )}

          {/* Step 2: Accounting & Payment */}
          {step === 2 && (
            <>
              <SectionTitle icon={CreditCard} title="3. Comptabilité et paiement / Accounting & Payment" />
              <div className="grid sm:grid-cols-2 gap-5">
                <FormField label="Contact comptabilité / Accounting Contact">
                  <input className={inputClass} value={form.accounting_contact} onChange={e => set("accounting_contact", e.target.value)} placeholder="Name" />
                </FormField>
                <FormField label="Téléphone / Accounting Phone">
                  <input className={inputClass} type="tel" value={form.accounting_phone} onChange={e => set("accounting_phone", e.target.value)} placeholder="+1 (xxx) xxx-xxxx" />
                </FormField>
              </div>
              <FormField label="Courriel de facturation / Billing Email">
                <input className={inputClass} type="email" value={form.billing_email} onChange={e => set("billing_email", e.target.value)} placeholder="accounting@company.com" />
              </FormField>

              <FormField label="Conditions de paiement / Payment Terms">
                <div className="grid sm:grid-cols-2 gap-3 mt-1">
                  {PAYMENT_TERMS_OPTIONS.map(opt => (
                    <label key={opt.value} className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 cursor-pointer transition-all text-sm font-semibold ${
                      form.payment_terms === opt.value ? "border-accent bg-accent/5 text-accent" : "border-border/60 bg-transparent text-muted-foreground hover:border-border hover:bg-muted/20"
                    }`}>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${form.payment_terms === opt.value ? "border-accent" : "border-muted-foreground/30"}`}>
                        {form.payment_terms === opt.value && <div className="w-2.5 h-2.5 rounded-full bg-accent" />}
                      </div>
                      <input type="radio" className="hidden" name="payment_terms" value={opt.value} checked={form.payment_terms === opt.value}
                        onChange={e => set("payment_terms", e.target.value)} />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </FormField>

              <FormField label="Mode de paiement préféré / Payment Method">
                <div className="grid sm:grid-cols-2 gap-3 mt-1">
                  {PAYMENT_METHOD_OPTIONS.map(opt => (
                    <label key={opt.value} className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 cursor-pointer transition-all text-sm font-semibold ${
                      form.payment_method === opt.value ? "border-accent bg-accent/5 text-accent" : "border-border/60 bg-transparent text-muted-foreground hover:border-border hover:bg-muted/20"
                    }`}>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${form.payment_method === opt.value ? "border-accent" : "border-muted-foreground/30"}`}>
                        {form.payment_method === opt.value && <div className="w-2.5 h-2.5 rounded-full bg-accent" />}
                      </div>
                      <input type="radio" className="hidden" name="payment_method" value={opt.value} checked={form.payment_method === opt.value}
                        onChange={e => set("payment_method", e.target.value)} />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </FormField>
            </>
          )}

          {/* Step 3: Credit References */}
          {step === 3 && (
            <>
              <SectionTitle icon={FileText} title="4. Références de crédit / Credit References" />
              <div className="grid sm:grid-cols-2 gap-5">
                <FormField label="Référence bancaire / Bank Reference">
                  <input className={inputClass} value={form.bank_reference} onChange={e => set("bank_reference", e.target.value)} placeholder="Bank name & account details" />
                </FormField>
                <FormField label="Limite de crédit demandée / Credit Limit Requested">
                  <input className={inputClass} type="number" min="0" step="0.01" value={form.credit_limit_requested} onChange={e => set("credit_limit_requested", e.target.value)} placeholder="$0.00" />
                </FormField>
              </div>
              <FormField label="Référence fournisseur 1 / Supplier Reference 1">
                <textarea className={textareaClass} rows={2} value={form.supplier_ref_1} onChange={e => set("supplier_ref_1", e.target.value)} placeholder="Supplier name, contact, phone..." />
              </FormField>
              <FormField label="Référence fournisseur 2 / Supplier Reference 2">
                <textarea className={textareaClass} rows={2} value={form.supplier_ref_2} onChange={e => set("supplier_ref_2", e.target.value)} placeholder="Supplier name, contact, phone..." />
              </FormField>
            </>
          )}

          {/* Step 4: Products & Needs */}
          {step === 4 && (
            <>
              <SectionTitle icon={Truck} title="5. Besoins / Products & Needs" />
              <FormField label="Types de pièces recherchées / Types of Parts Needed">
                <textarea className={textareaClass} rows={3} value={form.parts_needed} onChange={e => set("parts_needed", e.target.value)}
                  placeholder="Brakes, suspension, axles, lighting, body parts..." />
              </FormField>
              <FormField label="Demandes particulières / Special Requests">
                <textarea className={textareaClass} rows={3} value={form.special_requests} onChange={e => set("special_requests", e.target.value)}
                  placeholder="Any specific requirements or notes..." />
              </FormField>
              <FormField label="Représentant / Sales Representative">
                <input className={inputClass} value={form.sales_representative} onChange={e => set("sales_representative", e.target.value)}
                  placeholder="If you were referred by a specific sales rep..." />
              </FormField>
            </>
          )}

          {/* Step 5: Validation / Signature */}
          {step === 5 && (
            <>
              <SectionTitle icon={PenTool} title="6. Validation / Authorization" />

              {/* Review Summary */}
              <div className="bg-muted/30 border-2 border-border/60 rounded-xl p-6 mb-8 space-y-4">
                <h4 className="font-display font-black text-xs text-foreground uppercase tracking-widest mb-4">Application Summary</h4>
                <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3 justify-between text-sm">
                  <div className="flex items-center justify-between border-b border-border/40 pb-2"><span className="text-muted-foreground font-medium">Company:</span> <span className="font-bold text-foreground text-right">{form.company_name}</span></div>
                  <div className="flex items-center justify-between border-b border-border/40 pb-2"><span className="text-muted-foreground font-medium">NEQ/TVA:</span> <span className="font-bold text-foreground text-right">{form.neq_tva || "—"}</span></div>
                  <div className="flex items-center justify-between border-b border-border/40 pb-2"><span className="text-muted-foreground font-medium">Contact:</span> <span className="font-bold text-foreground text-right">{form.contact_person}</span></div>
                  <div className="flex items-center justify-between border-b border-border/40 pb-2"><span className="text-muted-foreground font-medium">Email:</span> <span className="font-bold text-foreground text-right">{form.email}</span></div>
                  <div className="flex items-center justify-between border-b border-border/40 pb-2"><span className="text-muted-foreground font-medium">Phone:</span> <span className="font-bold text-foreground text-right">{form.phone || "—"}</span></div>
                  <div className="flex items-center justify-between border-b border-border/40 pb-2"><span className="text-muted-foreground font-medium">Payment:</span> <span className="font-bold text-foreground text-right">{form.payment_terms || "—"}</span></div>
                  <div className="flex items-center justify-between border-b border-border/40 pb-2"><span className="text-muted-foreground font-medium">Credit Limit:</span> <span className="font-bold text-foreground text-right">{form.credit_limit_requested ? `$${form.credit_limit_requested}` : "—"}</span></div>
                  <div className="flex items-center justify-between border-b border-border/40 pb-2"><span className="text-muted-foreground font-medium">Trucks/Trailers:</span> <span className="font-bold text-foreground text-right">{form.num_trucks || 0} / {form.num_trailers || 0}</span></div>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-5">
                <FormField label="Nom du signataire / Signatory Name" required>
                  <input className={inputClass} value={form.signatory_name} onChange={e => set("signatory_name", e.target.value)} placeholder="Full name of signatory" />
                  {errors.signatory_name && <p className="text-xs text-red-500 mt-1">{errors.signatory_name}</p>}
                </FormField>
                <FormField label="Titre / Fonction / Title">
                  <input className={inputClass} value={form.signatory_title} onChange={e => set("signatory_title", e.target.value)} placeholder="Title / Position" />
                </FormField>
              </div>

              <FormField label="Date">
                <input className={inputClass} type="date" value={form.signature_date} onChange={e => set("signature_date", e.target.value)} />
              </FormField>

              <FormField label="Signature" required>
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Drawing Canvas */}
                  <div className="space-y-3">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">A. Signer ici / Draw Signature</p>
                    <div className="border-2 border-border/60 rounded-xl overflow-hidden bg-white shadow-sm hover:border-border transition-colors">
                      <SignatureCanvas
                        ref={sigRef}
                        penColor="#090a0f"
                        canvasProps={{ className: "w-full", style: { height: 180, width: "100%" } }}
                        onBegin={() => set("signature_url", "")} // Clear upload if start drawing
                        onEnd={() => {
                          if (sigRef.current) setSignatureData(sigRef.current.toDataURL("image/png"));
                        }}
                      />
                    </div>
                    <button type="button" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => { sigRef.current?.clear(); setSignatureData(null); }}>
                      Clear Drawing
                    </button>
                  </div>

                  {/* Image Upload */}
                  <div className="space-y-3">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">B. Téléverser image / Upload Image</p>
                    <div className={`border-2 border-dashed rounded-xl h-[180px] flex flex-col items-center justify-center p-4 transition-all ${form.signature_url ? 'border-success bg-success/5' : 'border-border/60 hover:border-accent hover:bg-accent/5'}`}>
                      {uploadingSignature ? (
                        <Loader2 className="h-8 w-8 text-accent animate-spin" />
                      ) : form.signature_url ? (
                        <>
                          <img src={form.signature_url} alt="Signature" className="max-h-[120px] object-contain mb-2" />
                          <button type="button" onClick={() => set("signature_url", "")} className="text-destructive font-bold text-[10px] uppercase tracking-widest hover:underline">Remove</button>
                        </>
                      ) : (
                        <>
                          <button type="button" onClick={() => fileInputRef.current?.click()} className="p-3 rounded-full bg-accent/10 text-accent mb-2 hover:bg-accent/20 transition-all">
                            <PenTool className="h-6 w-6" />
                          </button>
                          <p className="text-xs font-medium text-muted-foreground text-center">PNG, JPG allowed</p>
                        </>
                      )}
                      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleSignatureUpload} />
                    </div>
                  </div>
                </div>
                {errors.signature && <p className="text-xs font-bold text-destructive mt-3">{errors.signature}</p>}
              </FormField>
            </>
          )}

          {/* Error message */}
          {errors._submit && (
            <div className="flex items-center gap-3 p-5 bg-destructive/10 border border-destructive/20 rounded-xl text-sm font-medium text-destructive mt-6">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              {errors._submit}
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between pt-8 mt-8 border-t-2 border-border/40">
            <button type="button" onClick={goBack} disabled={step === 0}
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-display font-black uppercase tracking-widest border-2 border-border/60 text-muted-foreground hover:border-foreground hover:text-foreground transition-all disabled:opacity-30 disabled:cursor-not-allowed">
              <ChevronLeft className="h-4 w-4" /> Previous
            </button>

            <span className="text-[10px] font-display font-black uppercase tracking-[0.2em] text-muted-foreground hidden sm:block">Step {step + 1} of {STEPS.length}</span>

            {step < STEPS.length - 1 ? (
              <button type="button" onClick={goNext}
                className="flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-display font-black uppercase tracking-widest bg-foreground text-background hover:bg-accent hover:text-white transition-all shadow-md hover:-translate-y-0.5">
                Next <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button type="button" onClick={handleSubmit} disabled={submitting}
                className="flex items-center gap-2 px-8 py-3 rounded-xl text-xs font-display font-black uppercase tracking-widest bg-accent text-white hover:bg-accent/90 transition-all shadow-md hover:-translate-y-0.5 disabled:opacity-50 disabled:translate-y-0 disabled:shadow-none">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" strokeWidth={3} />}
                {submitting ? "Submitting..." : "Submit"}
              </button>
            )}
          </div>
          </div>
        </div>

        {/* Footer note */}
        <p className="text-center text-[10px] font-display font-black uppercase tracking-widest text-muted-foreground mt-12 opacity-60">
          Merci de nous retourner ce formulaire complété / Please complete this application form
          <br />© 2025 REMQUIP — Pièces de remorques & camions | Trailer & Truck Parts
        </p>
      </div>
    </div>
  );
}

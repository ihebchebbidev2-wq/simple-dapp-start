import React, { useMemo, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { MapPin, Phone, Mail, Clock, Send, ArrowRight, ShieldCheck } from "lucide-react";
import ContactMap from "@/components/contact/ContactMap";
import { useContactMap } from "@/hooks/useApi";
import { useCMSPageContent } from "@/hooks/useCMS";
import type { ContactSectionRow } from "@/lib/contactCms";
import { api } from "@/lib/api";
import {
  getSection,
  introFromSection,
  mapCopyFromSection,
  parseLabelsJson,
  parseSidebarJson,
} from "@/lib/contactCms";
import { showSuccessToast, showErrorToast } from "@/lib/toast";

const FALLBACK = {
  latitude: 45.5017,
  longitude: -73.5673,
  zoom: 13,
  marker_title: "REMQUIP",
  address_line: "1000 Rue de la Gauchetière O, Montréal, QC H3B 4W5, Canada",
};

export default function ContactPage() {
  const { t, lang } = useLanguage();
  const { data: mapRes, isLoading: mapLoading } = useContactMap();
  const { data: sections = [] } = useCMSPageContent("contact", lang);
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const row = mapRes?.success && mapRes.data ? mapRes.data : null;
  const lat = row?.latitude ?? FALLBACK.latitude;
  const lng = row?.longitude ?? FALLBACK.longitude;
  const zm = row?.zoom ?? FALLBACK.zoom;
  const markerTitle = row?.marker_title ?? FALLBACK.marker_title;
  const addressLine = row?.address_line ?? FALLBACK.address_line;

  const copy = useMemo(() => {
    const rows = sections as ContactSectionRow[];
    const introFb = {
      eyebrow: t("contact.eyebrow"),
      heading: t("contact.title"),
      body: t("contact.intro"),
    };
    const formFb = {
      name: t("contact.name"),
      email: t("contact.email"),
      subject: t("contact.subject"),
      message: t("contact.message"),
      send: t("contact.send"),
    };
    const sideFb = {
      address_label: t("contact.address_label"),
      phone_label: t("contact.phone_label"),
      phone: "(514) 359-3366",
      email_label: t("contact.email_label"),
      email: "info@remquip.ca",
      hours_label: t("contact.hours_label"),
      hours: t("contact.hours_value"),
    };
    const mapFb = {
      heading: t("contact.map_heading"),
      subtitle: t("contact.map_subtitle"),
    };

    return {
      intro: introFromSection(getSection(rows, "intro"), introFb),
      formLabels: parseLabelsJson(getSection(rows, "form_labels")?.content, formFb),
      sidebar: parseSidebarJson(getSection(rows, "sidebar")?.content, sideFb),
      map: mapCopyFromSection(getSection(rows, "map"), mapFb),
    };
  }, [sections, t]);

  return (
    <div className="bg-background min-h-screen">
      {/* Decorative background elements */}
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-[radial-gradient(circle_at_100%_0%,hsl(var(--accent)/0.03),transparent_60%)] pointer-events-none" />
      
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 md:py-32 relative z-10">
        <header className="mb-16 md:mb-24 text-center max-w-3xl mx-auto">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="h-px w-8 bg-accent/40" />
            <span className="font-display font-black uppercase tracking-[0.3em] text-[10px] text-accent">
                {copy.intro.eyebrow}
            </span>
            <div className="h-px w-8 bg-accent/40" />
          </div>
          <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-black uppercase tracking-tighter text-foreground leading-[0.95] mb-6">
            {copy.intro.heading}
          </h1>
          <p className="text-muted-foreground text-lg font-medium leading-relaxed max-w-2xl mx-auto">
            {copy.intro.body}
          </p>
        </header>

        <div className="grid gap-16 lg:gap-24 lg:grid-cols-12 items-start">
          
          {/* Left: Interactive Form */}
          <div className="lg:col-span-7">
            <div className="bg-card border border-border/80 rounded-3xl p-8 sm:p-12 shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[radial-gradient(circle_at_100%_0%,hsl(var(--accent)/0.05),transparent_70%)] pointer-events-none transition-opacity group-focus-within:opacity-100 opacity-60" />
              
              <form
                className="space-y-8 relative z-10"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (submitting) return;
                  const name = form.name.trim();
                  const email = form.email.trim();
                  const subject = form.subject.trim();
                  const message = form.message.trim();

                  if (!name) return showErrorToast("Form Error", "Name is required");
                  if (!email || !/^\S+@\S+\.\S+$/.test(email)) return showErrorToast("Form Error", "Valid email is required");
                  if (!message) return showErrorToast("Form Error", "Message is required");

                  setSubmitting(true);
                  try {
                    await api.submitContactLead({ name, email, subject, message });
                    setSent(true);
                    setForm({ name: "", email: "", subject: "", message: "" });
                    showSuccessToast("Success", "Inquiry received. We'll be in touch.");
                  } catch (err) {
                    showErrorToast("Submission Failed", err instanceof Error ? err.message : "Submission failure. Please retry.");
                  } finally {
                    setSubmitting(false);
                  }
                }}
              >
                <div className="grid sm:grid-cols-2 gap-8">
                  <div className="group relative">
                    <label htmlFor="contact-name" className="absolute -top-3 left-4 bg-card px-2 text-[10px] font-display font-black uppercase tracking-widest text-muted-foreground group-focus-within:text-accent transition-colors z-10">
                      {copy.formLabels.name}
                    </label>
                    <input
                      id="contact-name"
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      className="w-full bg-transparent border-2 border-border/60 hover:border-border rounded-xl px-4 py-4 text-sm font-medium text-foreground outline-none focus:border-accent transition-all shadow-sm"
                      placeholder="Enter full name"
                    />
                  </div>
                  <div className="group relative">
                    <label htmlFor="contact-email" className="absolute -top-3 left-4 bg-card px-2 text-[10px] font-display font-black uppercase tracking-widest text-muted-foreground group-focus-within:text-accent transition-colors z-10">
                      {copy.formLabels.email}
                    </label>
                    <input
                      id="contact-email"
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                      className="w-full bg-transparent border-2 border-border/60 hover:border-border rounded-xl px-4 py-4 text-sm font-medium text-foreground outline-none focus:border-accent transition-all shadow-sm"
                      placeholder="name@company.com"
                    />
                  </div>
                </div>

                <div className="group relative">
                  <label htmlFor="contact-subject" className="absolute -top-3 left-4 bg-card px-2 text-[10px] font-display font-black uppercase tracking-widest text-muted-foreground group-focus-within:text-accent transition-colors z-10">
                    {copy.formLabels.subject}
                  </label>
                  <input
                    id="contact-subject"
                    type="text"
                    value={form.subject}
                    onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                    className="w-full bg-transparent border-2 border-border/60 hover:border-border rounded-xl px-4 py-4 text-sm font-medium text-foreground outline-none focus:border-accent transition-all shadow-sm"
                    placeholder="General Inquiry / Parts Request"
                  />
                </div>

                <div className="group relative">
                  <label htmlFor="contact-message" className="absolute -top-3 left-4 bg-card px-2 text-[10px] font-display font-black uppercase tracking-widest text-muted-foreground group-focus-within:text-accent transition-colors z-10">
                    {copy.formLabels.message}
                  </label>
                  <textarea
                    id="contact-message"
                    rows={6}
                    value={form.message}
                    onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                    className="w-full bg-transparent border-2 border-border/60 hover:border-border rounded-xl px-4 py-4 text-sm font-medium text-foreground outline-none focus:border-accent resize-none transition-all shadow-sm"
                    placeholder="Describe your requirements in detail..."
                  />
                </div>

                {sent ? (
                  <div className="flex items-center gap-4 p-5 bg-success/10 border border-success/20 rounded-2xl animate-in fade-in zoom-in-95">
                    <div className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center shrink-0">
                        <ShieldCheck className="h-5 w-5 text-success" />
                    </div>
                    <p className="text-sm font-bold text-success uppercase tracking-wide">
                        Inquiry transmitted successfully. We'll contact you within 24 hours.
                    </p>
                  </div>
                ) : (
                  <button
                    type="submit"
                    disabled={submitting}
                    className="group w-full bg-foreground text-background py-5 px-8 rounded-xl font-display font-black text-[11px] uppercase tracking-[0.2em] flex items-center justify-between disabled:opacity-50 hover:bg-accent hover:shadow-xl transition-all active:scale-[0.98]"
                  >
                    {submitting ? (
                        <span className="flex items-center gap-3"><Clock className="h-4 w-4 animate-spin" /> DISPATCHING...</span>
                    ) : (
                        <>
                            <span>{copy.formLabels.send}</span>
                            <Send className="h-4 w-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" strokeWidth={2.5} />
                        </>
                    )}
                  </button>
                )}
              </form>
            </div>
          </div>

          {/* Right: Info Sidebar + Map */}
          <div className="lg:col-span-5 space-y-10">
            
            {/* Premium Map Container */}
            <section className="relative group overflow-hidden" aria-labelledby="contact-map-heading">
              <div className="absolute top-0 right-0 p-4 z-10 pointer-events-none">
                  <div className="bg-background/80 backdrop-blur-md rounded-xl p-3 border border-border shadow-lg">
                      <h2 id="contact-map-heading" className="font-display text-xs font-black uppercase tracking-widest text-foreground">
                        {copy.map.heading}
                      </h2>
                      <p className="text-[10px] text-muted-foreground font-medium mt-1 uppercase tracking-tighter opacity-80">{copy.map.subtitle}</p>
                  </div>
              </div>
              <div className="rounded-[2.5rem] border-4 border-card overflow-hidden shadow-2xl relative">
                  <ContactMap
                    layout="sidebar"
                    latitude={lat}
                    longitude={lng}
                    zoom={zm}
                    markerTitle={markerTitle}
                    addressLine={addressLine}
                    className="grayscale hover:grayscale-0 transition-all duration-700"
                  />
                  {/* Subtle dark overlay for premium look */}
                  <div className="absolute inset-0 bg-accent/5 pointer-events-none mix-blend-multiply" />
              </div>
            </section>

            {/* Contact Grid */}
            <div className="grid sm:grid-cols-2 gap-6">
                <div className="group p-5 bg-card border border-border/60 rounded-3xl hover:border-accent/40 transition-colors">
                    <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center mb-4 border border-border group-hover:bg-accent group-hover:border-accent transition-all shadow-sm">
                        <MapPin className="h-4 w-4 text-muted-foreground group-hover:text-white transition-colors" />
                    </div>
                    <h3 className="font-display font-black text-[9px] uppercase tracking-widest text-muted-foreground mb-1.5">{copy.sidebar.address_label}</h3>
                    <p className="text-xs font-bold text-foreground leading-snug">{mapLoading ? "…" : addressLine}</p>
                </div>
                <div className="group p-5 bg-card border border-border/60 rounded-3xl hover:border-accent/40 transition-colors">
                    <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center mb-4 border border-border group-hover:bg-accent group-hover:border-accent transition-all shadow-sm">
                        <Phone className="h-4 w-4 text-muted-foreground group-hover:text-white transition-colors" />
                    </div>
                    <h3 className="font-display font-black text-[9px] uppercase tracking-widest text-muted-foreground mb-1.5">{copy.sidebar.phone_label}</h3>
                    <a href={`tel:${copy.sidebar.phone}`} className="text-xs font-bold text-foreground hover:text-accent transition-colors">{copy.sidebar.phone}</a>
                </div>
                <div className="group p-5 bg-card border border-border/60 rounded-3xl hover:border-accent/40 transition-colors">
                    <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center mb-4 border border-border group-hover:bg-accent group-hover:border-accent transition-all shadow-sm">
                        <Mail className="h-4 w-4 text-muted-foreground group-hover:text-white transition-colors" />
                    </div>
                    <h3 className="font-display font-black text-[9px] uppercase tracking-widest text-muted-foreground mb-1.5">{copy.sidebar.email_label}</h3>
                    <a href={`mailto:${copy.sidebar.email}`} className="text-xs font-bold text-foreground hover:text-accent transition-colors truncate block">{copy.sidebar.email}</a>
                </div>
                <div className="group p-5 bg-card border border-border/60 rounded-3xl hover:border-accent/40 transition-colors">
                    <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center mb-4 border border-border group-hover:bg-accent group-hover:border-accent transition-all shadow-sm">
                        <Clock className="h-4 w-4 text-muted-foreground group-hover:text-white transition-colors" />
                    </div>
                    <h3 className="font-display font-black text-[9px] uppercase tracking-widest text-muted-foreground mb-1.5">{copy.sidebar.hours_label}</h3>
                    <p className="text-xs font-bold text-foreground leading-snug">{copy.sidebar.hours}</p>
                </div>
            </div>

          </div>
        </div>
      </div>

      {/* Trust bar or CTA at bottom? */}
      <div className="bg-muted/30 border-t border-border mt-32">
        <div className="container mx-auto px-4 py-16 flex flex-col md:flex-row items-center justify-between gap-8 text-center md:text-left">
            <div>
                <h4 className="font-display font-black uppercase tracking-tight text-xl text-foreground">Technical Support Desk</h4>
                <p className="text-sm text-muted-foreground font-medium mt-1">Our specialists are available for high-complexity fleet queries.</p>
            </div>
            <Link to="/products" className="group flex items-center gap-3 text-xs font-display font-black uppercase tracking-widest text-foreground hover:text-accent transition-colors">
                View Available Inventory <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>
        </div>
      </div>
    </div>
  );
}

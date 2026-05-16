import React, { useEffect, useMemo, useState } from "react";
import { Globe, Loader2, Save } from "lucide-react";
import { RemquipLoadingScreen } from "@/components/RemquipLoadingScreen";
import { useStorefrontRates, useCMSPage } from "@/hooks/useApi";
import { useCMSPageContent, useUpdateCMSContent } from "@/hooks/useCMS";
import { localeLabel } from "@/contexts/LanguageContext";
import { showSuccessToast, showErrorToast } from "@/lib/toast";
import type { ContactSectionRow } from "@/lib/contactCms";
import {
  getSection,
  introFromSection,
  mapCopyFromSection,
  parseLabelsJson,
  parseSidebarJson,
} from "@/lib/contactCms";

/** Defaults when CMS row missing (matches translations/en.json + fr.json). */
function fallbacksForLocale(loc: string) {
  if (loc === "fr") {
    return {
      intro: {
        eyebrow: "Écrivez-nous",
        heading: "Nous contacter",
        body: "Des questions sur nos produits ou nos programmes de gros? Écrivez-nous; nous répondons sous 24 h.",
      },
      form: parseLabelsJson("", {
        name: "Votre Nom",
        email: "Adresse Courriel",
        subject: "Sujet",
        message: "Message",
        send: "Envoyer le message",
      }),
      sidebar: parseSidebarJson("", {
        address_label: "Adresse",
        phone_label: "Téléphone",
        phone: "(514) 359-3366",
        email_label: "Courriel",
        email: "info@remquip.ca",
        hours_label: "Heures",
        hours: "Lun - Ven: 8h00 - 17h00 HNE",
      }),
      map: { heading: "Nous trouver", subtitle: "La position et l'adresse se configurent dans Admin - CMS (carte Contact)." },
    };
  }
  return {
    intro: {
      eyebrow: "Get in touch",
      heading: "Contact Us",
      body: "Have questions about our products or wholesale programs? Reach out and we will respond within 24 hours.",
    },
    form: parseLabelsJson("", {
      name: "Your Name",
      email: "Email Address",
      subject: "Subject",
      message: "Message",
      send: "Send Message",
    }),
    sidebar: parseSidebarJson("", {
      address_label: "Address",
      phone_label: "Phone",
      phone: "(514) 359-3366",
      email_label: "Email",
      email: "info@remquip.ca",
      hours_label: "Hours",
      hours: "Mon - Fri: 8:00 AM - 5:00 PM EST",
    }),
    map: { heading: "Find us", subtitle: "Pin and address are set in Admin - CMS (Contact map)." },
  };
}

export default function AdminContactCopy() {
  const { data: storefront } = useStorefrontRates();
  const supportedLocales =
    (storefront as { data?: { supported_locales?: string[] } } | undefined)?.data?.supported_locales ?? ["en", "fr"];
  const defaultLocale = supportedLocales[0] ?? "en";
  const [activeLocale, setActiveLocale] = useState(defaultLocale);

  useEffect(() => {
    if (supportedLocales.length && !supportedLocales.includes(activeLocale)) {
      setActiveLocale(supportedLocales[0]);
    }
  }, [supportedLocales, activeLocale]);

  const { data: pageApi } = useCMSPage("contact");
  const pageId = useMemo(() => {
    const d = pageApi?.data as { id?: string } | undefined;
    return d?.id ?? null;
  }, [pageApi]);

  const { data: sections = [], isLoading } = useCMSPageContent("contact", activeLocale);
  const updateMutation = useUpdateCMSContent();

  const fb = useMemo(() => fallbacksForLocale(activeLocale), [activeLocale]);

  const [intro, setIntro] = useState(fb.intro);
  const [formLabels, setFormLabels] = useState(fb.form);
  const [sidebar, setSidebar] = useState(fb.sidebar);
  const [mapCopy, setMapCopy] = useState(fb.map);

  useEffect(() => {
    const rows = sections as ContactSectionRow[];
    const f = fallbacksForLocale(activeLocale);
    const introRow = getSection(rows, "intro");
    const formRow = getSection(rows, "form_labels");
    const sideRow = getSection(rows, "sidebar");
    const mapRow = getSection(rows, "map");

    setIntro(introFromSection(introRow, f.intro));
    setFormLabels(parseLabelsJson(formRow?.content, f.form));
    setSidebar(parseSidebarJson(sideRow?.content, f.sidebar));
    setMapCopy(mapCopyFromSection(mapRow, f.map));
  }, [sections, activeLocale]);

  const handleSave = async () => {
    if (!pageId) {
      showErrorToast("Contact CMS page not found. Run database migration (contact CMS seed).");
      return;
    }
    const loc = activeLocale !== defaultLocale ? activeLocale : undefined;

    try {
      await updateMutation.mutateAsync({
        id: `${pageId}:intro`,
        data: {
          title: intro.eyebrow,
          description: intro.heading,
          content: intro.body,
          image_url: "",
        },
        locale: loc,
      });
      await updateMutation.mutateAsync({
        id: `${pageId}:form_labels`,
        data: {
          title: "",
          description: "",
          content: JSON.stringify(formLabels),
          image_url: "",
        },
        locale: loc,
      });
      await updateMutation.mutateAsync({
        id: `${pageId}:sidebar`,
        data: {
          title: "",
          description: "",
          content: JSON.stringify(sidebar),
          image_url: "",
        },
        locale: loc,
      });
      await updateMutation.mutateAsync({
        id: `${pageId}:map`,
        data: {
          title: mapCopy.heading,
          description: mapCopy.subtitle,
          content: "",
          image_url: "",
        },
        locale: loc,
      });
      showSuccessToast("Contact page copy saved");
    } catch {
      showErrorToast("Failed to save contact copy");
    }
  };

  const inputCls =
    "w-full px-3 py-2 border border-border rounded-sm text-sm bg-background outline-none focus:ring-2 focus:ring-accent";

  return (
    <div className="dashboard-card">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
        <div>
          <h3 className="font-display font-bold text-sm uppercase tracking-wide flex items-center gap-2">
            <Globe className="h-4 w-4 text-accent" />
            Contact page copy
          </h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
            English and French text for the public <code className="text-[11px]">/contact</code> page (headline, form labels,
            sidebar, map captions). Map coordinates stay under Contact map below.
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {supportedLocales.map((loc) => (
            <button
              key={loc}
              type="button"
              onClick={() => setActiveLocale(loc)}
              className={`px-3 py-1.5 rounded-sm text-xs font-medium border transition-colors ${
                activeLocale === loc ? "border-accent bg-accent/10 text-foreground" : "border-border hover:bg-muted/50"
              }`}
            >
              {localeLabel(loc)}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <RemquipLoadingScreen variant="panel" message="Loading sections" />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="rounded-md border border-border bg-muted/20 p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase">Intro</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium mb-1">Eyebrow</label>
                <input className={inputCls} value={intro.eyebrow} onChange={(e) => setIntro({ ...intro, eyebrow: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium mb-1">Page title (H1)</label>
                <input className={inputCls} value={intro.heading} onChange={(e) => setIntro({ ...intro, heading: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium mb-1">Intro paragraph</label>
                <textarea
                  className={inputCls}
                  rows={3}
                  value={intro.body}
                  onChange={(e) => setIntro({ ...intro, body: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="rounded-md border border-border bg-muted/20 p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase">Form labels</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {(["name", "email", "subject", "message", "send"] as const).map((k) => (
                <div key={k} className={k === "message" ? "sm:col-span-2" : ""}>
                  <label className="block text-xs font-medium mb-1 capitalize">{k}</label>
                  <input
                    className={inputCls}
                    value={formLabels[k]}
                    onChange={(e) => setFormLabels({ ...formLabels, [k]: e.target.value })}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-md border border-border bg-muted/20 p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase">Sidebar</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium mb-1">Address label</label>
                <input
                  className={inputCls}
                  value={sidebar.address_label}
                  onChange={(e) => setSidebar({ ...sidebar, address_label: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Phone label</label>
                <input
                  className={inputCls}
                  value={sidebar.phone_label}
                  onChange={(e) => setSidebar({ ...sidebar, phone_label: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Phone number</label>
                <input
                  className={inputCls}
                  value={sidebar.phone}
                  onChange={(e) => setSidebar({ ...sidebar, phone: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Email label</label>
                <input
                  className={inputCls}
                  value={sidebar.email_label}
                  onChange={(e) => setSidebar({ ...sidebar, email_label: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Email address</label>
                <input
                  className={inputCls}
                  value={sidebar.email}
                  onChange={(e) => setSidebar({ ...sidebar, email: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Hours label</label>
                <input
                  className={inputCls}
                  value={sidebar.hours_label}
                  onChange={(e) => setSidebar({ ...sidebar, hours_label: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium mb-1">Hours text</label>
                <input
                  className={inputCls}
                  value={sidebar.hours}
                  onChange={(e) => setSidebar({ ...sidebar, hours: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="rounded-md border border-border bg-muted/20 p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase">Map section (copy only)</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium mb-1">Heading</label>
                <input
                  className={inputCls}
                  value={mapCopy.heading}
                  onChange={(e) => setMapCopy({ ...mapCopy, heading: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Subtitle</label>
                <input
                  className={inputCls}
                  value={mapCopy.subtitle}
                  onChange={(e) => setMapCopy({ ...mapCopy, subtitle: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={updateMutation.isPending || !pageId}
              className="btn-accent px-4 py-2 rounded-sm text-sm font-medium inline-flex items-center gap-2 disabled:opacity-50"
            >
              {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save contact copy ({localeLabel(activeLocale)})
            </button>
            <a href="/contact" target="_blank" rel="noopener noreferrer" className="text-sm text-accent hover:underline">
              Open contact page
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import {
  Loader2,
  Globe,
  Save,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  LayoutTemplate,
  Plus,
  Trash2,
} from "lucide-react";
import { useCMSPageContent, useUpdateCMSContent, useCreateCMSContent } from "@/hooks/useCMS";
import { useStorefrontRates } from "@/hooks/useApi";
import { localeLabel } from "@/contexts/LanguageContext";
import { showSuccessToast, showErrorToast } from "@/lib/toast";
import AdminLandingTheme from "./AdminLandingTheme";
import { RemquipLoadingScreen } from "@/components/RemquipLoadingScreen";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminPageError, AdminPageLoading } from "@/components/admin/AdminPageState";

const SECTION_LABELS: Record<string, string> = {
  site_header:
    "Site header — top bar (emails, social links), announcement, urgency banner, marquee — all configurable per locale",
  hero: "Hero (title — use a line break for two-line headline; description; CTAs; slides / layout)",
  value_props:
    "Trust bar & hero chips (JSON object: hero_secondary[], trust_bar{headline,logos[]}, or legacy [] array)",
  categories_intro: "Categories section intro & “View all” label (bento grid uses live categories)",
  featured_intro: "Featured products intro & “View all” label",
  why_remquip: "Testimonials (cards with title, desc, role) or feature cards (icon, title, desc)",
  wholesale_cta: "Wholesale CTA (JSON: bullets[{title,text}], badge_label; copy & banner image)",
};

function parseJson<T>(raw: string, fallback: T): T {
  if (!raw?.trim()) return fallback;
  try {
    const v = JSON.parse(raw);
    return (v ?? fallback) as T;
  } catch {
    return fallback;
  }
}

function SectionCard({
  id,
  title,
  children,
  defaultOpen = false,
}: {
  id?: string;
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const { hash } = useLocation();
  const hashMatch = Boolean(id && hash === `#${id}`);
  const [open, setOpen] = useState(() => defaultOpen || hashMatch);
  useEffect(() => {
    if (hashMatch) setOpen(true);
  }, [hashMatch]);
  return (
    <div id={id} className="border border-border rounded-lg overflow-hidden bg-card scroll-mt-24">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-left font-medium hover:bg-muted/50 transition-colors"
      >
        <span>{title}</span>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      {open && <div className="p-4 pt-0 space-y-4 border-t border-border">{children}</div>}
    </div>
  );
}

export default function AdminLanding() {
  const { data: storefront } = useStorefrontRates();
  const supportedLocales =
    (storefront as { data?: { supported_locales?: string[] } } | undefined)?.data?.supported_locales ?? [
      "en",
      "fr",
      "es",
    ];
  const defaultLocale = supportedLocales[0] ?? "en";
  const [activeLocale, setActiveLocale] = useState(defaultLocale);

  const location = useLocation();
  const { data: sections = [], isLoading, isError, refetch } = useCMSPageContent("home", activeLocale);
  const updateMutation = useUpdateCMSContent();
  const createMutation = useCreateCMSContent();

  // Scroll to section when hash is present (e.g. from landing page Edit links)
  useEffect(() => {
    const hash = location.hash?.slice(1);
    if (!hash?.startsWith("section-")) return;
    const scroll = () => {
      document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    scroll();
    const t = window.setTimeout(scroll, 120);
    return () => window.clearTimeout(t);
  }, [location.hash, sections.length]);

  const sectionMap = Object.fromEntries(
    sections.map((s: { section_key: string }) => [s.section_key, s])
  ) as Record<string, { id: string; title: string; description: string; image_url: string; content: string }>;

  const handleSave = async (
    sectionKey: string,
    payload: { title?: string; description?: string; image_url?: string; content?: string }
  ) => {
    const s = sectionMap[sectionKey];
    if (!s?.id) return;
    try {
      await updateMutation.mutateAsync({
        id: s.id,
        data: payload,
        locale: activeLocale !== defaultLocale ? activeLocale : undefined,
      });
      showSuccessToast("Section updated");
    } catch {
      showErrorToast("Failed to update");
    }
  };

  if (isLoading) {
    return <AdminPageLoading message="Loading landing content" />;
  }

  if (isError) {
    return (
      <AdminPageError
        message="Failed to load landing content."
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Landing Page Content"
        subtitle="Edit all texts on the homepage. Changes apply per language."
        icon={LayoutTemplate}
        actions={
          supportedLocales.length > 1 ? (
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <select
                value={activeLocale}
                onChange={(e) => setActiveLocale(e.target.value)}
                className="px-3 py-2 border border-border rounded-sm text-sm bg-background"
              >
                {supportedLocales.map((l) => (
                  <option key={l} value={l}>
                    {localeLabel(l)}
                  </option>
                ))}
              </select>
            </div>
          ) : undefined
        }
      />

      <AdminLandingTheme />

      <div className="space-y-4">
        {/* Site header (global) */}
        {sectionMap.site_header && (
          <SectionCard id="section-site_header" title={SECTION_LABELS.site_header} defaultOpen>
            <HeaderSectionForm
              section={sectionMap.site_header}
              onSave={(d) => handleSave("site_header", d)}
              loading={updateMutation.isPending}
            />
          </SectionCard>
        )}

        {/* Hero */}
        {sectionMap.hero && (
          <SectionCard id="section-hero" title={SECTION_LABELS.hero} defaultOpen>
            <HeroSectionForm section={sectionMap.hero} onSave={(d) => handleSave("hero", d)} loading={updateMutation.isPending} />
          </SectionCard>
        )}

        {/* Value props */}
        {sectionMap.value_props && (
          <SectionCard id="section-value_props" title={SECTION_LABELS.value_props}>
            <ValuePropsSectionForm section={sectionMap.value_props} onSave={(d) => handleSave("value_props", d)} loading={updateMutation.isPending} />
          </SectionCard>
        )}

        {/* Categories intro */}
        {sectionMap.categories_intro && (
          <SectionCard id="section-categories_intro" title={SECTION_LABELS.categories_intro}>
            <IntroSectionForm section={sectionMap.categories_intro} onSave={(d) => handleSave("categories_intro", d)} loading={updateMutation.isPending} />
          </SectionCard>
        )}

        {/* Featured intro */}
        {sectionMap.featured_intro && (
          <SectionCard id="section-featured_intro" title={SECTION_LABELS.featured_intro}>
            <IntroSectionForm section={sectionMap.featured_intro} onSave={(d) => handleSave("featured_intro", d)} loading={updateMutation.isPending} />
          </SectionCard>
        )}

        {/* Why REMQUIP */}
        {sectionMap.why_remquip && (
          <SectionCard id="section-why_remquip" title={SECTION_LABELS.why_remquip}>
            <WhyRemquipSectionForm section={sectionMap.why_remquip} onSave={(d) => handleSave("why_remquip", d)} loading={updateMutation.isPending} />
          </SectionCard>
        )}

        {/* Wholesale CTA */}
        {sectionMap.wholesale_cta && (
          <SectionCard id="section-wholesale_cta" title={SECTION_LABELS.wholesale_cta}>
            <WholesaleCtaSectionForm section={sectionMap.wholesale_cta} onSave={(d) => handleSave("wholesale_cta", d)} loading={updateMutation.isPending} />
          </SectionCard>
        )}

        {sections.length > 0 && !sectionMap.site_header && (
          <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <span>
              <strong className="text-foreground">Site header</strong> (announcement bar &amp; logo) is not in your CMS yet. Add it without resetting other sections.
            </span>
            <button
              type="button"
              onClick={async () => {
                try {
                  await createMutation.mutateAsync({
                    page_name: "home",
                    section_key: "site_header",
                    title: "",
                    description: "",
                    image_url: "",
                    content: JSON.stringify({
                      announcement:
                        "Free shipping on qualifying orders · Same-day dispatch on in-stock parts",
                      announcement_link_url: "/products",
                      announcement_link_label: "Shop catalog",
                      trust_chips: ["Secure checkout", "CAD & USD", "Fleet accounts", "15+ years"],
                    }),
                  });
                  showSuccessToast("Site header section added");
                  refetch();
                } catch {
                  showErrorToast("Failed to add section");
                }
              }}
              disabled={createMutation.isPending}
              className="shrink-0 px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm font-medium hover:bg-muted disabled:opacity-50"
            >
              {createMutation.isPending ? "Adding…" : "Add site header section"}
            </button>
          </div>
        )}

        {sections.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">No landing sections found.</p>
            <button
              type="button"
              onClick={async () => {
                const defaults = [
                  {
                    section_key: "site_header",
                    title: "",
                    description: "",
                    image_url: "",
                    content: JSON.stringify({
                      announcement:
                        "Free shipping on qualifying orders · Same-day dispatch on in-stock parts",
                      announcement_link_url: "/products",
                      announcement_link_label: "Shop catalog",
                      trust_chips: ["Secure checkout", "CAD & USD", "Fleet accounts", "15+ years"],
                    }),
                  },
                  {
                    section_key: "hero",
                    title: "Industrial-Grade Parts For North American Fleets",
                    description:
                      "500+ SKUs in stock. 48-hour delivery. Trusted by fleet operators across North America for 15+ years.",
                    image_url: "",
                    content: JSON.stringify({
                      eyebrow: "Fleet-grade industrial supply",
                      hero_layout: "auto",
                      carousel_interval_ms: 6000,
                      cta_primary_label: "Browse Catalog",
                      cta_primary_link: "/products",
                      cta_secondary_label: "Wholesale Program",
                      cta_secondary_link: "/register",
                      hero_image_alt: "Industrial truck parts",
                      slides: [
                        { image_url: "", alt: "", caption: "" },
                        { image_url: "", alt: "", caption: "" },
                        { image_url: "", alt: "", caption: "" },
                      ],
                    }),
                  },
                  { section_key: "value_props", content: JSON.stringify([{ icon: "Shield", text: "Certified & Tested" }, { icon: "Truck", text: "Fast Delivery" }, { icon: "Wrench", text: "Expert Support" }, { icon: "CheckCircle", text: "In Stock" }]) },
                  { section_key: "categories_intro", title: "Browse Solutions", description: "Explore Product Categories", content: JSON.stringify({ view_all_label: "View all products" }) },
                  { section_key: "featured_intro", title: "In High Demand", description: "Popular Products", content: JSON.stringify({ view_all_label: "View all products" }) },
                  { section_key: "why_remquip", title: "Why Choose REMQUIP", description: "Built for Fleet Operations", content: JSON.stringify({ subtitle: "We specialize in quality parts, competitive pricing, and customer service that keeps your fleet running smoothly.", cards: [{ icon: "Package", title: "Extensive Inventory", desc: "500+ SKUs ready to ship. Most items in stock for immediate delivery to fleets across North America." }, { icon: "Users", title: "Dedicated Support", desc: "Expert team standing by. Get technical guidance, bulk quotes, and personalized service for your fleet needs." }, { icon: "BarChart3", title: "Proven Track Record", desc: "15+ years serving trucking operations. Trusted by fleet managers for reliability and competitive pricing." }] }) },
                  { section_key: "wholesale_cta", title: "Fleet Solutions", description: "Wholesale Programs for Fleet Operators", image_url: "", content: JSON.stringify({ body: "Get competitive bulk pricing, dedicated account support, and streamlined ordering for your fleet operation.", cta_primary_label: "Join Wholesale", cta_primary_link: "/register", cta_secondary_label: "Contact Sales", cta_secondary_link: "/contact" }) },
                ];
                try {
                  for (const d of defaults) {
                    await createMutation.mutateAsync({ page_name: "home", section_key: d.section_key, ...d });
                  }
                  showSuccessToast("Default sections created");
                  refetch();
                } catch {
                  showErrorToast("Failed to create sections");
                }
              }}
              disabled={createMutation.isPending}
              className="btn-accent px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 mx-auto disabled:opacity-50"
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Create default sections
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const fieldClass =
  "w-full px-3 py-2 border border-border rounded-sm text-sm bg-background outline-none focus:ring-2 focus:ring-accent";

function Field({
  label,
  value,
  onChange,
  placeholder,
  rows,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      {rows ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className={fieldClass}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={fieldClass}
        />
      )}
    </div>
  );
}

type HeroSlideRow = { image_url: string; alt: string; caption: string };

function normalizeHeroSlides(raw: unknown): HeroSlideRow[] {
  if (!Array.isArray(raw)) {
    return [{ image_url: "", alt: "", caption: "" }];
  }
  const rows = raw
    .map((x) => {
      const o = x as Record<string, unknown>;
      return {
        image_url: String(o.image_url ?? ""),
        alt: String(o.alt ?? ""),
        caption: String(o.caption ?? ""),
      };
    })
    .slice(0, 5);
  if (rows.length === 0) {
    return [{ image_url: "", alt: "", caption: "" }];
  }
  return rows;
}

type HeaderCmsShape = {
  announcement?: string;
  announcement_link_url?: string;
  announcement_link_label?: string;
  trust_chips?: string[];
  urgency_text?: string;
  urgency_cta_label?: string;
  urgency_cta_href?: string;
  marquee_items?: string[];
  top_email?: string;
  social_facebook?: string;
  social_instagram?: string;
  social_linkedin?: string;
  professional_email?: string;
};

function HeaderSectionForm({
  section,
  onSave,
  loading,
}: {
  section: { title: string; description: string; content: string; image_url?: string };
  onSave: (d: { title?: string; description?: string; content?: string; image_url?: string }) => void;
  loading: boolean;
}) {
  const c = parseJson<HeaderCmsShape>(section.content, {});
  const [announcement, setAnnouncement] = useState(c.announcement ?? "");
  const [linkUrl, setLinkUrl] = useState(c.announcement_link_url ?? "");
  const [linkLabel, setLinkLabel] = useState(c.announcement_link_label ?? "");
  const [chipsLines, setChipsLines] = useState(() => (c.trust_chips?.length ? c.trust_chips.join("\n") : ""));
  const [logoUrl, setLogoUrl] = useState(section.image_url ?? "");
  const [urgencyText, setUrgencyText] = useState(c.urgency_text ?? "");
  const [urgencyCtaLabel, setUrgencyCtaLabel] = useState(c.urgency_cta_label ?? "");
  const [urgencyCtaHref, setUrgencyCtaHref] = useState(c.urgency_cta_href ?? "/products");
  const [marqueeLines, setMarqueeLines] = useState(() => (c.marquee_items?.length ? c.marquee_items.join("\n") : ""));
  const [topEmail, setTopEmail] = useState(c.top_email ?? "");
  const [socialFacebook, setSocialFacebook] = useState(c.social_facebook ?? "");
  const [socialInstagram, setSocialInstagram] = useState(c.social_instagram ?? "");
  const [socialLinkedin, setSocialLinkedin] = useState(c.social_linkedin ?? "");
  const [professionalEmail, setProfessionalEmail] = useState(c.professional_email ?? "");

  useEffect(() => {
    const n = parseJson<HeaderCmsShape>(section.content, {});
    setAnnouncement(n.announcement ?? "");
    setLinkUrl(n.announcement_link_url ?? "");
    setLinkLabel(n.announcement_link_label ?? "");
    setChipsLines(n.trust_chips?.length ? n.trust_chips.join("\n") : "");
    setLogoUrl(section.image_url ?? "");
    setUrgencyText(n.urgency_text ?? "");
    setUrgencyCtaLabel(n.urgency_cta_label ?? "");
    setUrgencyCtaHref(n.urgency_cta_href ?? "/products");
    setMarqueeLines(n.marquee_items?.length ? n.marquee_items.join("\n") : "");
    setTopEmail(n.top_email ?? "");
    setSocialFacebook(n.social_facebook ?? "");
    setSocialInstagram(n.social_instagram ?? "");
    setSocialLinkedin(n.social_linkedin ?? "");
    setProfessionalEmail(n.professional_email ?? "");
  }, [section.content, section.image_url]);

  const save = () => {
    const trust_chips = chipsLines
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 4);
    const marquee_items = marqueeLines
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    onSave({
      image_url: logoUrl.trim(),
      content: JSON.stringify({
        announcement: announcement.trim() || undefined,
        announcement_link_url: linkUrl.trim() || undefined,
        announcement_link_label: linkLabel.trim() || undefined,
        trust_chips: trust_chips.length ? trust_chips : undefined,
        urgency_text: urgencyText.trim() || undefined,
        urgency_cta_label: urgencyCtaLabel.trim() || undefined,
        urgency_cta_href: urgencyCtaHref.trim() || undefined,
        marquee_items: marquee_items.length ? marquee_items : undefined,
        top_email: topEmail.trim() || undefined,
        social_facebook: socialFacebook.trim() || undefined,
        social_instagram: socialInstagram.trim() || undefined,
        social_linkedin: socialLinkedin.trim() || undefined,
        professional_email: professionalEmail.trim() || undefined,
      }),
    });
  };

  return (
    <div className="space-y-6">
      <p className="text-xs text-muted-foreground">
        Top header bar, announcement bar, and scrolling marquee settings. Use the locale selector above to edit per language.
      </p>

      <div className="space-y-4 rounded-lg border border-border bg-muted/20 p-4">
        <h4 className="text-sm font-semibold">🔗 Top Header Bar (contact info & social links)</h4>
        <p className="text-xs text-muted-foreground">Displayed at the very top of the landing page. Leave fields empty to use defaults.</p>
        <Field label="Sales / Contact Email (left side)" value={topEmail} onChange={setTopEmail} placeholder="sales@remquip.ca" />
        <Field label="Professional Email (right side)" value={professionalEmail} onChange={setProfessionalEmail} placeholder="info@remquip.ca" />
        <div className="grid sm:grid-cols-3 gap-4">
          <Field label="Facebook URL" value={socialFacebook} onChange={setSocialFacebook} placeholder="https://facebook.com/remquip" />
          <Field label="Instagram URL" value={socialInstagram} onChange={setSocialInstagram} placeholder="https://instagram.com/remquip" />
          <Field label="LinkedIn URL" value={socialLinkedin} onChange={setSocialLinkedin} placeholder="https://linkedin.com/company/remquip" />
        </div>
      </div>

      <div className="space-y-4 rounded-lg border border-border bg-muted/20 p-4">
        <h4 className="text-sm font-semibold">Logo</h4>
        <Field
          label="Logo image URL (optional)"
          value={logoUrl}
          onChange={setLogoUrl}
          placeholder="/Backend/uploads/... — shown next to store name"
        />
      </div>

      <div className="space-y-4 rounded-lg border border-border bg-muted/20 p-4">
        <h4 className="text-sm font-semibold">Announcement bar</h4>
        <p className="text-xs text-muted-foreground">Top strip on every page. Content is per locale.</p>
        <Field label="Announcement line" value={announcement} onChange={setAnnouncement} placeholder="Free shipping on orders over C$500" />
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Link path" value={linkUrl} onChange={setLinkUrl} placeholder="/products" />
          <Field label="Link label" value={linkLabel} onChange={setLinkLabel} placeholder="Shop catalog" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Trust chips (desktop, max 4 — one per line)</label>
          <textarea
            value={chipsLines}
            onChange={(e) => setChipsLines(e.target.value)}
            rows={3}
            placeholder={"Secure checkout\nCAD & USD"}
            className={fieldClass}
          />
        </div>
      </div>

      <div className="space-y-4 rounded-lg border border-border bg-muted/20 p-4">
        <h4 className="text-sm font-semibold">Landing page strips (homepage only)</h4>
        <p className="text-xs text-muted-foreground">Urgency banner and marquee below the main nav, on the homepage.</p>
        <Field label="Urgency text (red banner)" value={urgencyText} onChange={setUrgencyText} placeholder="Limited stock — order before Friday" />
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Urgency CTA label" value={urgencyCtaLabel} onChange={setUrgencyCtaLabel} placeholder="Shop now" />
          <Field label="Urgency CTA link" value={urgencyCtaHref} onChange={setUrgencyCtaHref} placeholder="/products" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Marquee items (scrolling text — one per line)</label>
          <textarea
            value={marqueeLines}
            onChange={(e) => setMarqueeLines(e.target.value)}
            rows={4}
            placeholder={"FREE SHIPPING OVER C$500 • 500+ SKUS IN STOCK • WHOLESALE PRICING AVAILABLE"}
            className={fieldClass}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={save}
        disabled={loading}
        className="btn-accent px-4 py-2 rounded-sm text-sm font-medium flex items-center gap-2 disabled:opacity-50"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        <Save className="h-4 w-4" /> Save
      </button>
    </div>
  );
}

function HeroSectionForm({
  section,
  onSave,
  loading,
}: {
  section: { title: string; description: string; content: string; image_url?: string };
  onSave: (d: { title?: string; description?: string; content?: string; image_url?: string }) => void;
  loading: boolean;
}) {
  type HeroCta = {
    cta_primary_label?: string;
    cta_primary_link?: string;
    cta_secondary_label?: string;
    cta_secondary_link?: string;
    hero_image_alt?: string;
    eyebrow?: string;
    hero_layout?: string;
    carousel_interval_ms?: number;
    slides?: { image_url?: string; alt?: string; caption?: string }[];
  };

  const cta = parseJson<HeroCta>(section.content, {});
  const [title, setTitle] = useState(section.title);
  const [desc, setDesc] = useState(section.description);
  const [imageUrl, setImageUrl] = useState(section.image_url ?? "");
  const [heroImageAlt, setHeroImageAlt] = useState(cta.hero_image_alt ?? "");
  const [eyebrow, setEyebrow] = useState(cta.eyebrow ?? "");
  const [heroLayout, setHeroLayout] = useState(cta.hero_layout ?? "auto");
  const [carouselMs, setCarouselMs] = useState(String(cta.carousel_interval_ms ?? 6000));
  const [primaryLabel, setPrimaryLabel] = useState(cta.cta_primary_label ?? "Browse Catalog");
  const [primaryLink, setPrimaryLink] = useState(cta.cta_primary_link ?? "/products");
  const [secondaryLabel, setSecondaryLabel] = useState(cta.cta_secondary_label ?? "Wholesale Program");
  const [secondaryLink, setSecondaryLink] = useState(cta.cta_secondary_link ?? "/register");
  const [slides, setSlides] = useState<HeroSlideRow[]>(() => normalizeHeroSlides(cta.slides));

  useEffect(() => {
    const c = parseJson<HeroCta>(section.content, {});
    setTitle(section.title);
    setDesc(section.description);
    setImageUrl(section.image_url ?? "");
    setHeroImageAlt(c.hero_image_alt ?? "");
    setEyebrow(c.eyebrow ?? "");
    setHeroLayout(c.hero_layout ?? "auto");
    setCarouselMs(String(c.carousel_interval_ms ?? 6000));
    setPrimaryLabel(c.cta_primary_label ?? "Browse Catalog");
    setPrimaryLink(c.cta_primary_link ?? "/products");
    setSecondaryLabel(c.cta_secondary_label ?? "Wholesale Program");
    setSecondaryLink(c.cta_secondary_link ?? "/register");
    setSlides(normalizeHeroSlides(c.slides));
  }, [section.title, section.description, section.content, section.image_url]);

  const updateSlide = (i: number, patch: Partial<HeroSlideRow>) => {
    setSlides((prev) => prev.map((row, j) => (j === i ? { ...row, ...patch } : row)));
  };

  const addSlide = () => {
    setSlides((prev) => (prev.length >= 5 ? prev : [...prev, { image_url: "", alt: "", caption: "" }]));
  };

  const removeSlide = (i: number) => {
    setSlides((prev) => (prev.length <= 1 ? prev : prev.filter((_, j) => j !== i)));
  };

  const save = () => {
    const ms = parseInt(carouselMs, 10);
    onSave({
      title,
      description: desc,
      image_url: imageUrl.trim(),
      content: JSON.stringify({
        eyebrow: eyebrow.trim() || undefined,
        hero_layout: heroLayout || "auto",
        carousel_interval_ms: Number.isFinite(ms) ? ms : 6000,
        cta_primary_label: primaryLabel,
        cta_primary_link: primaryLink,
        cta_secondary_label: secondaryLabel,
        cta_secondary_link: secondaryLink,
        hero_image_alt: heroImageAlt.trim() || undefined,
        slides,
      }),
    });
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Add image URLs in the gallery below. With two or more images, the hero uses a split layout with a carousel (
        <strong>auto</strong>
        ). Use &quot;Spotlight&quot; for a single full-bleed background (first image or fallback URL).
      </p>
      <Field label="Headline" value={title} onChange={setTitle} placeholder="Industrial-Grade Parts..." />
      <Field label="Subtitle" value={desc} onChange={setDesc} placeholder="500+ SKUs in stock..." rows={2} />
      <Field label="Eyebrow (small line above headline)" value={eyebrow} onChange={setEyebrow} placeholder="Fleet-grade industrial supply" />
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Layout</label>
          <select
            value={heroLayout}
            onChange={(e) => setHeroLayout(e.target.value)}
            className={fieldClass}
          >
            <option value="auto">Auto (split if 2+ gallery images)</option>
            <option value="split">Split (text + gallery)</option>
            <option value="spotlight">Spotlight (full background)</option>
          </select>
        </div>
        <Field
          label="Carousel interval (ms)"
          value={carouselMs}
          onChange={setCarouselMs}
          placeholder="6000"
        />
      </div>
      <Field
        label="Fallback / single image URL (optional)"
        value={imageUrl}
        onChange={setImageUrl}
        placeholder="Used when gallery slots are empty, or as first spotlight image"
      />
      <Field label="Default alt text (accessibility)" value={heroImageAlt} onChange={setHeroImageAlt} placeholder="Industrial truck parts" />

      <div className="border border-border rounded-md p-3 space-y-3 bg-muted/20">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium">Image gallery (up to 5)</span>
          <button
            type="button"
            onClick={addSlide}
            disabled={slides.length >= 5}
            className="text-xs font-medium flex items-center gap-1 px-2 py-1 rounded border border-border hover:bg-muted disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" /> Add slide
          </button>
        </div>
        {slides.map((row, i) => (
          <div key={i} className="border border-border rounded-sm p-3 space-y-2 bg-background">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">Slide {i + 1}</span>
              {slides.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeSlide(i)}
                  className="text-xs text-destructive flex items-center gap-1 hover:underline"
                >
                  <Trash2 className="h-3 w-3" /> Remove
                </button>
              )}
            </div>
            <Field
              label="Image URL"
              value={row.image_url}
              onChange={(v) => updateSlide(i, { image_url: v })}
              placeholder="/Backend/uploads/..."
            />
            <div className="grid sm:grid-cols-2 gap-2">
              <Field label="Alt text" value={row.alt} onChange={(v) => updateSlide(i, { alt: v })} placeholder="Alt" />
              <Field label="Caption (optional)" value={row.caption} onChange={(v) => updateSlide(i, { caption: v })} placeholder="Short caption" />
            </div>
          </div>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Primary CTA label" value={primaryLabel} onChange={setPrimaryLabel} />
        <Field label="Primary CTA link" value={primaryLink} onChange={setPrimaryLink} />
        <Field label="Secondary CTA label" value={secondaryLabel} onChange={setSecondaryLabel} />
        <Field label="Secondary CTA link" value={secondaryLink} onChange={setSecondaryLink} />
      </div>
      <button
        type="button"
        onClick={save}
        disabled={loading}
        className="btn-accent px-4 py-2 rounded-sm text-sm font-medium flex items-center gap-2 disabled:opacity-50"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        <Save className="h-4 w-4" /> Save
      </button>
    </div>
  );
}

function ValuePropsSectionForm({
  section,
  onSave,
  loading,
}: {
  section: { content: string };
  onSave: (d: { content?: string }) => void;
  loading: boolean;
}) {
  type ValuePropItem = { icon: string; text: string };
  type TrustBar = { headline?: string; logos?: string[] };

  const DEFAULT_VALUE_PROPS: ValuePropItem[] = [
    { icon: "Shield", text: "Certified & Tested" },
    { icon: "Truck", text: "Fast Delivery" },
    { icon: "Wrench", text: "Expert Support" },
    { icon: "CheckCircle", text: "In Stock" },
  ];

  const DEFAULT_TRUST: { headline: string; logos: string[] } = {
    headline: "Trusted by operators in mining, construction & transportation",
    logos: ["TERRA-CON", "NORSE MARITIME", "ORE-CORP", "HEAVY-CO", "GLOBAL-MIN"],
  };

  function parseValueProps(raw: string): { props: ValuePropItem[]; trustBar: TrustBar } {
    const trimmed = raw?.trim() ?? "";
    if (!trimmed) return { props: DEFAULT_VALUE_PROPS, trustBar: DEFAULT_TRUST };

    try {
      const j = JSON.parse(trimmed) as unknown;
      if (Array.isArray(j)) {
        return { props: j as ValuePropItem[], trustBar: DEFAULT_TRUST };
      }
      if (j && typeof j === "object") {
        const o = j as Record<string, unknown>;
        const parsedProps = Array.isArray(o.props)
          ? (o.props as ValuePropItem[])
          : Array.isArray(o.value_props)
            ? (o.value_props as ValuePropItem[])
            : DEFAULT_VALUE_PROPS;
        const tb = o.trust_bar as TrustBar | undefined;
        return {
          props: parsedProps?.length ? parsedProps : DEFAULT_VALUE_PROPS,
          trustBar: {
            headline: typeof tb?.headline === "string" ? tb.headline : DEFAULT_TRUST.headline,
            logos: Array.isArray(tb?.logos) ? tb.logos.map(String) : DEFAULT_TRUST.logos,
          },
        };
      }
    } catch {
      // ignore parsing errors; fall back to defaults
    }

    return { props: DEFAULT_VALUE_PROPS, trustBar: DEFAULT_TRUST };
  }

  const parsedInitial = parseValueProps(section.content);
  const [props, setProps] = useState<ValuePropItem[]>(parsedInitial.props);
  const [trustHeadline, setTrustHeadline] = useState<string>(String(parsedInitial.trustBar.headline ?? DEFAULT_TRUST.headline));
  const [trustLogosLines, setTrustLogosLines] = useState<string>(
    (parsedInitial.trustBar.logos ?? DEFAULT_TRUST.logos).join("\n")
  );
  const icons = ["Shield", "Truck", "Wrench", "CheckCircle", "Package", "Users", "BarChart3"];

  useEffect(() => {
    const next = parseValueProps(section.content);
    setProps(next.props);
    setTrustHeadline(String(next.trustBar.headline ?? DEFAULT_TRUST.headline));
    setTrustLogosLines((next.trustBar.logos ?? DEFAULT_TRUST.logos).join("\n"));
  }, [section.content]);

  const update = (i: number, key: "icon" | "text", v: string) => {
    const next = [...props];
    next[i] = { ...next[i], [key]: v };
    setProps(next);
  };

  const save = () => {
    const trustLogos = trustLogosLines
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 12);

    onSave({
      content: JSON.stringify({
        props,
        trust_bar: {
          headline: trustHeadline.trim() || undefined,
          logos: trustLogos.length ? trustLogos : undefined,
        },
      }),
    });
  };

  return (
    <div className="space-y-4">
      <Field
        label="Trust bar headline"
        value={trustHeadline}
        onChange={setTrustHeadline}
        placeholder={DEFAULT_TRUST.headline}
      />
      <Field
        label="Trust bar logos (one per line)"
        value={trustLogosLines}
        onChange={setTrustLogosLines}
        rows={4}
        placeholder={"TERRA-CON\nNORSE MARITIME\nORE-CORP\nHEAVY-CO"}
      />

      {props.map((p, i) => (
        <div key={i} className="flex gap-3 items-center">
          <select
            value={p.icon}
            onChange={(e) => update(i, "icon", e.target.value)}
            className="w-32 px-3 py-2 border border-border rounded-sm text-sm bg-background"
          >
            {icons.map((ic) => (
              <option key={ic} value={ic}>{ic}</option>
            ))}
          </select>
          <input
            value={p.text}
            onChange={(e) => update(i, "text", e.target.value)}
            placeholder="Certified & Tested"
            className="flex-1 px-3 py-2 border border-border rounded-sm text-sm bg-background"
          />
        </div>
      ))}
      <button
        type="button"
        onClick={save}
        disabled={loading}
        className="btn-accent px-4 py-2 rounded-sm text-sm font-medium flex items-center gap-2 disabled:opacity-50"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        <Save className="h-4 w-4" /> Save
      </button>
    </div>
  );
}

function IntroSectionForm({
  section,
  onSave,
  loading,
}: {
  section: { title: string; description: string; content?: string };
  onSave: (d: { title?: string; description?: string; content?: string }) => void;
  loading: boolean;
}) {
  const extras = parseJson<{ view_all_label?: string }>(section.content ?? "", {});
  const [title, setTitle] = useState(section.title);
  const [desc, setDesc] = useState(section.description);
  const [viewAllLabel, setViewAllLabel] = useState(extras.view_all_label ?? "");

  useEffect(() => {
    const ex = parseJson<{ view_all_label?: string }>(section.content ?? "", {});
    setTitle(section.title);
    setDesc(section.description);
    setViewAllLabel(ex.view_all_label ?? "");
  }, [section.title, section.description, section.content]);

  const save = () =>
    onSave({
      title,
      description: desc,
      content: JSON.stringify({
        view_all_label: viewAllLabel.trim() || undefined,
      }),
    });

  return (
    <div className="space-y-4">
      <Field label="Eyebrow / small label" value={title} onChange={setTitle} />
      <Field label="Heading" value={desc} onChange={setDesc} />
      <Field
        label="“View all” link label (optional; overrides site default)"
        value={viewAllLabel}
        onChange={setViewAllLabel}
        placeholder="View all products"
      />
      <button
        type="button"
        onClick={save}
        disabled={loading}
        className="btn-accent px-4 py-2 rounded-sm text-sm font-medium flex items-center gap-2 disabled:opacity-50"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        <Save className="h-4 w-4" /> Save
      </button>
    </div>
  );
}

function WhyRemquipSectionForm({
  section,
  onSave,
  loading,
}: {
  section: { title: string; description: string; content: string };
  onSave: (d: { title?: string; description?: string; content?: string }) => void;
  loading: boolean;
}) {
  const data = parseJson<{ subtitle?: string; cards?: { icon: string; title: string; desc: string }[] }>(
    section.content,
    { subtitle: "", cards: [] }
  );
  const [title, setTitle] = useState(section.title);
  const [desc, setDesc] = useState(section.description);
  const [subtitle, setSubtitle] = useState(data.subtitle ?? "");
  const [cards, setCards] = useState(
    data.cards?.length ? data.cards : [
      { icon: "Package", title: "Extensive Inventory", desc: "500+ SKUs ready to ship..." },
      { icon: "Users", title: "Dedicated Support", desc: "Expert team standing by..." },
      { icon: "BarChart3", title: "Proven Track Record", desc: "15+ years serving..." },
    ]
  );
  const icons = ["Package", "Users", "BarChart3", "Shield", "Truck", "Wrench", "CheckCircle"];

  useEffect(() => {
    const d = parseJson<{ subtitle?: string; cards?: { icon: string; title: string; desc: string }[] }>(
      section.content,
      { subtitle: "", cards: [] }
    );
    setTitle(section.title);
    setDesc(section.description);
    setSubtitle(d.subtitle ?? "");
    setCards(
      d.cards?.length
        ? d.cards
        : [
            { icon: "Package", title: "Extensive Inventory", desc: "500+ SKUs ready to ship..." },
            { icon: "Users", title: "Dedicated Support", desc: "Expert team standing by..." },
            { icon: "BarChart3", title: "Proven Track Record", desc: "15+ years serving..." },
          ]
    );
  }, [section.title, section.description, section.content]);

  const updateCard = (i: number, key: "icon" | "title" | "desc", v: string) => {
    const next = [...cards];
    next[i] = { ...next[i], [key]: v };
    setCards(next);
  };

  const save = () =>
    onSave({
      title,
      description: desc,
      content: JSON.stringify({ subtitle, cards }),
    });

  return (
    <div className="space-y-4">
      <Field label="Eyebrow" value={title} onChange={setTitle} />
      <Field label="Heading" value={desc} onChange={setDesc} />
      <Field label="Subtitle" value={subtitle} onChange={setSubtitle} rows={2} />
      {cards.map((c, i) => (
        <div key={i} className="p-3 rounded border border-border space-y-2">
          <div className="flex gap-2">
            <select
              value={c.icon}
              onChange={(e) => updateCard(i, "icon", e.target.value)}
              className="w-28 px-2 py-1.5 border border-border rounded-sm text-sm bg-background"
            >
              {icons.map((ic) => (
                <option key={ic} value={ic}>{ic}</option>
              ))}
            </select>
            <input
              value={c.title}
              onChange={(e) => updateCard(i, "title", e.target.value)}
              placeholder="Card title"
              className="flex-1 px-3 py-2 border border-border rounded-sm text-sm bg-background"
            />
          </div>
          <textarea
            value={c.desc}
            onChange={(e) => updateCard(i, "desc", e.target.value)}
            placeholder="Card description"
            rows={2}
            className="w-full px-3 py-2 border border-border rounded-sm text-sm bg-background"
          />
        </div>
      ))}
      <button
        type="button"
        onClick={save}
        disabled={loading}
        className="btn-accent px-4 py-2 rounded-sm text-sm font-medium flex items-center gap-2 disabled:opacity-50"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        <Save className="h-4 w-4" /> Save
      </button>
    </div>
  );
}

function WholesaleCtaSectionForm({
  section,
  onSave,
  loading,
}: {
  section: { title: string; description: string; content: string; image_url?: string };
  onSave: (d: { title?: string; description?: string; content?: string; image_url?: string }) => void;
  loading: boolean;
}) {
  const data = parseJson<{
    body?: string;
    cta_primary_label?: string;
    cta_primary_link?: string;
    cta_secondary_label?: string;
    cta_secondary_link?: string;
  }>(section.content, {});
  const [title, setTitle] = useState(section.title);
  const [desc, setDesc] = useState(section.description);
  const [bannerUrl, setBannerUrl] = useState(section.image_url ?? "");
  const [body, setBody] = useState(data.body ?? "");
  const [primaryLabel, setPrimaryLabel] = useState(data.cta_primary_label ?? "Join Wholesale");
  const [primaryLink, setPrimaryLink] = useState(data.cta_primary_link ?? "/register");
  const [secondaryLabel, setSecondaryLabel] = useState(data.cta_secondary_label ?? "Contact Sales");
  const [secondaryLink, setSecondaryLink] = useState(data.cta_secondary_link ?? "/contact");

  useEffect(() => {
    const d = parseJson<{
      body?: string;
      cta_primary_label?: string;
      cta_primary_link?: string;
      cta_secondary_label?: string;
      cta_secondary_link?: string;
    }>(section.content, {});
    setTitle(section.title);
    setDesc(section.description);
    setBannerUrl(section.image_url ?? "");
    setBody(d.body ?? "");
    setPrimaryLabel(d.cta_primary_label ?? "Join Wholesale");
    setPrimaryLink(d.cta_primary_link ?? "/register");
    setSecondaryLabel(d.cta_secondary_label ?? "Contact Sales");
    setSecondaryLink(d.cta_secondary_link ?? "/contact");
  }, [section.title, section.description, section.content, section.image_url]);

  const save = () =>
    onSave({
      title,
      description: desc,
      image_url: bannerUrl.trim(),
      content: JSON.stringify({
        body,
        cta_primary_label: primaryLabel,
        cta_primary_link: primaryLink,
        cta_secondary_label: secondaryLabel,
        cta_secondary_link: secondaryLink,
      }),
    });

  return (
    <div className="space-y-4">
      <Field label="Eyebrow" value={title} onChange={setTitle} />
      <Field label="Heading" value={desc} onChange={setDesc} />
      <Field
        label="Banner image URL (optional)"
        value={bannerUrl}
        onChange={setBannerUrl}
        placeholder="Leave empty for default warehouse image; or /Backend/uploads/images/..."
      />
      <Field label="Body text" value={body} onChange={setBody} rows={3} />
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Primary CTA label" value={primaryLabel} onChange={setPrimaryLabel} />
        <Field label="Primary CTA link" value={primaryLink} onChange={setPrimaryLink} />
        <Field label="Secondary CTA label" value={secondaryLabel} onChange={setSecondaryLabel} />
        <Field label="Secondary CTA link" value={secondaryLink} onChange={setSecondaryLink} />
      </div>
      <button
        type="button"
        onClick={save}
        disabled={loading}
        className="btn-accent px-4 py-2 rounded-sm text-sm font-medium flex items-center gap-2 disabled:opacity-50"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        <Save className="h-4 w-4" /> Save
      </button>
    </div>
  );
}

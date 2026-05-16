import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Shield, Truck, Wrench, CheckCircle, ArrowRight, Package, Phone,
  Users, BarChart3, ShoppingCart, Star, CheckCircle2, ShieldCheck, PackageCheck,
  Facebook, Instagram, Linkedin, Mail, Plus, Minus,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { categories } from "@/config/products";
import { api, ProductCategory, unwrapApiList, resolveUploadImageUrl } from "@/lib/api";
import { apiProductToStorefront, productDetailHref, type StorefrontProduct } from "@/lib/storefront-product";
import { PriceDisplay, AuthGatedCartButton } from "@/components/PriceDisplay";
import { useCMSPageContent } from "@/hooks/useCMS";
import { EditableSection } from "@/components/EditableSection";
import LandingThemeScope from "@/components/landing/LandingThemeScope";
import LandingHero, { type HeroCtaContent } from "@/components/landing/LandingHero";
import warehouseImage from "@/assets/images/warehouse-banner.jpg";

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw?.trim()) return fallback;
  try {
    const v = JSON.parse(raw);
    return (v ?? fallback) as T;
  } catch {
    return fallback;
  }
}

const DEFAULT_VALUE_PROPS: any[] = [];

const DEFAULT_HERO_SECONDARY = [];

const DEFAULT_TRUST = {
  headline: "Trusted by operators in mining, construction & transportation",
  logos: ["TERRA-CON", "NORSE MARITIME", "ORE-CORP", "HEAVY-CO", "GLOBAL-MIN"],
};

function parseValuePropsContent(content?: string) {
  if (!content?.trim()) {
    return { row: DEFAULT_VALUE_PROPS, heroSecondary: DEFAULT_HERO_SECONDARY, trustBar: DEFAULT_TRUST };
  }
  try {
    const v = JSON.parse(content) as any;
    if (Array.isArray(v)) {
      return {
        row: v.length ? v : DEFAULT_VALUE_PROPS,
        heroSecondary: DEFAULT_HERO_SECONDARY,
        trustBar: DEFAULT_TRUST,
      };
    }
    if (v && typeof v === "object") {
      const row = Array.isArray(v.props) ? v.props : Array.isArray(v.value_props) ? v.value_props : DEFAULT_VALUE_PROPS;
      const heroSecondary = Array.isArray(v.hero_secondary) ? v.hero_secondary : DEFAULT_HERO_SECONDARY;
      const tb = v.trust_bar;
      const trustBar = tb && typeof tb === "object" ? {
        headline: typeof tb.headline === "string" && tb.headline.trim() ? tb.headline.trim() : DEFAULT_TRUST.headline,
        logos: Array.isArray(tb.logos) && tb.logos.length ? tb.logos.map(String) : DEFAULT_TRUST.logos,
      } : DEFAULT_TRUST;
      return { row: row.length ? row : DEFAULT_VALUE_PROPS, heroSecondary: heroSecondary.length ? heroSecondary : DEFAULT_HERO_SECONDARY, trustBar };
    }
  } catch {}
  return { row: DEFAULT_VALUE_PROPS, heroSecondary: DEFAULT_HERO_SECONDARY, trustBar: DEFAULT_TRUST };
}

type SiteHeaderCms = {
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

const ICON_MAP: Record<string, React.ComponentType<any>> = {
  Shield, Truck, Wrench, CheckCircle, Package, Users, BarChart3, ShieldCheck, PackageCheck,
};

type WhyCard = { icon?: string; title: string; desc: string; role?: string };

/** Featured product card with inline +/- quantity controls */
function FeaturedProductCard({ product, isOutOfStock, addItem, formatPrice, t }: {
  product: StorefrontProduct;
  isOutOfStock: boolean;
  addItem: (p: StorefrontProduct, qty?: number) => void;
  formatPrice: (n: number) => string;
  t: (k: string) => string;
}) {
  const [qty, setQty] = useState(1);
  return (
    <div className="group relative flex flex-col bg-card rounded-2xl overflow-hidden shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 border border-border/60">
      <Link to={productDetailHref(product.id, product.slug)} className="block aspect-[4/3] overflow-hidden bg-muted/30 relative">
        {product.image ? (
          <img src={product.image} alt={product.name} className={`w-full h-full object-cover mix-blend-multiply dark:mix-blend-normal group-hover:scale-110 transition-transform duration-700 ease-out ${isOutOfStock ? "opacity-40 grayscale" : ""}`} loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground/30"><Package className="h-10 w-10 opacity-20" /></div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
        {product.discountPercent > 0 && (
          <div className="absolute top-4 left-4 bg-destructive text-destructive-foreground text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded shadow-md">
            -{product.discountPercent}%
          </div>
        )}
        {isOutOfStock ? (
          <div className="absolute top-4 right-4 bg-background/90 backdrop-blur-md text-foreground text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded shadow-sm border border-border">
            {t("products.out_of_stock")}
          </div>
        ) : (
          <div className="absolute top-4 right-4 bg-accent text-accent-foreground text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded shadow-md">
            {t("products.in_stock")}
          </div>
        )}
      </Link>
      <div className="p-6 flex flex-col flex-1 relative bg-card z-10">
        <p className="text-[10px] text-muted-foreground font-display font-black uppercase tracking-widest mb-2 opacity-60 group-hover:opacity-100 transition-opacity">SKU: {product.sku}</p>
        <Link to={productDetailHref(product.id, product.slug)} className="text-lg font-display font-bold text-foreground hover:text-accent transition-colors line-clamp-2 leading-tight mb-auto">
          {product.name}
        </Link>
        <PriceDisplay>
          <div className="mt-6 flex items-end justify-between">
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-display font-black text-foreground">{formatPrice(product.salePrice)}</p>
              {product.discountPercent > 0 && (
                <p className="text-sm font-display font-semibold text-muted-foreground line-through opacity-60">{formatPrice(product.price)}</p>
              )}
            </div>
            {product.discountPercent > 0 && (
              <span className="text-[10px] font-black uppercase tracking-widest text-destructive bg-destructive/10 px-2 py-1 rounded">
                -{product.discountPercent}%
              </span>
            )}
          </div>
        </PriceDisplay>
        {/* Quantity selector above Add to cart */}
        <div className="mt-5 flex flex-col gap-2">
          <div className="flex items-center justify-center border border-border rounded-lg overflow-hidden self-stretch">
            <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={isOutOfStock} className="px-3 py-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              <Minus className="h-3.5 w-3.5" strokeWidth={2.5} />
            </button>
            <span className="min-w-[36px] text-center text-sm font-display font-bold text-foreground select-none">{qty}</span>
            <button type="button" onClick={() => setQty((q) => q + 1)} disabled={isOutOfStock} className="px-3 py-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
            </button>
          </div>
          <button type="button" onClick={() => { addItem(product, qty); setQty(1); }} disabled={isOutOfStock} className="w-full bg-primary text-primary-foreground text-[11px] py-3 rounded-lg font-display font-black uppercase tracking-widest hover:bg-accent hover:text-accent-foreground active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm">
            <ShoppingCart className="h-[16px] w-[16px]" strokeWidth={2.5} /> {t("products.add_to_cart")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const { t, lang } = useLanguage();
  const { formatPrice } = useCurrency();
  const { addItem } = useCart();
  const { user, priceAugmentationPercent, productAugmentations } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin" || user?.role === "manager";
  const [featuredProducts, setFeaturedProducts] = useState<StorefrontProduct[]>([]);
  const [featuredLoaded, setFeaturedLoaded] = useState(false);
  const [categoriesList, setCategoriesList] = useState<ProductCategory[]>([]);

  const { data: sectionRows = [] } = useCMSPageContent("home", lang);
  const sections = useMemo(() => {
    return Object.fromEntries(sectionRows.map((s: any) => [s.section_key, s]));
  }, [sectionRows]);

  const hero = sections.hero ?? {};
  const heroCta = useMemo(() => parseJson<HeroCtaContent>(hero.content, {}), [hero.content]);
  const valuePropsParsed = useMemo(() => parseValuePropsContent(sections.value_props?.content), [sections.value_props?.content]);
  const rawValuePropsContent = sections.value_props?.content?.trim() ?? "";
  const catIntro = sections.categories_intro ?? {};
  const featIntro = sections.featured_intro ?? {};
  const catIntroExtras = parseJson<{ view_all_label?: string }>(catIntro.content, {});
  const featIntroExtras = parseJson<{ view_all_label?: string }>(featIntro.content, {});
  const viewAllCategories = catIntroExtras.view_all_label?.trim() || t("products.view_all");
  const viewAllFeatured = featIntroExtras.view_all_label?.trim() || t("products.view_all");
  const whyRemquip = sections.why_remquip ?? {};
  const whyData = parseJson<{ subtitle?: string; cards?: WhyCard[] }>(whyRemquip.content, { subtitle: "", cards: [] });
  const wholesaleCta = sections.wholesale_cta ?? {};
  const wholesaleData = parseJson<any>(wholesaleCta.content, {});
  
  const wholesaleBannerSrc = wholesaleCta.image_url?.trim() ? resolveUploadImageUrl(wholesaleCta.image_url.trim()) : warehouseImage;
  const wholesaleBannerAlt = wholesaleCta.description?.trim() ? `${wholesaleCta.title || "Fleet"} — ${wholesaleCta.description.slice(0, 80)}` : "Industrial warehouse";
  const siteHeader = sections.site_header ?? {};
  const siteHeaderCms = useMemo(() => parseJson<SiteHeaderCms>(siteHeader.content, {}), [siteHeader.content]);
  const urgencyText = siteHeaderCms.urgency_text?.trim() ?? "";
  const urgencyCtaLabel = siteHeaderCms.urgency_cta_label?.trim() ?? "";
  const urgencyCtaHref = siteHeaderCms.urgency_cta_href?.trim() ?? "/products";
  const marqueeItems = (siteHeaderCms.marquee_items ?? []).map((s) => String(s).trim()).filter(Boolean);

  const defaultWhyCards: WhyCard[] = [
    { title: "Marcus Weber", role: "Fleet Manager, Global Mining Inc.", desc: "Reduced our fleet downtime after switching to REMQUIP assemblies. Technical support is responsive and knowledgeable." },
    { title: "Sarah Jensen", role: "Procurement Director, Norse Maritime", desc: "Inventory visibility and bulk pricing helped us consolidate suppliers. Ordering through the portal is straightforward." },
    { title: "Robert Kovic", role: "Chief Engineer, Terra-Con Projects", desc: "Quality parts and consistent availability keep our heavy equipment running. REMQUIP is a key supplier for our operation." },
  ];

  const wholesaleBullets = wholesaleData.bullets && wholesaleData.bullets.length >= 2
    ? wholesaleData.bullets.slice(0, 2)
    : [
        { title: "Logistics & fulfillment", text: "Coordinated shipping and tracking for fleet-scale orders." },
        { title: "Account programs", text: "Wholesale tiers and dedicated support for qualified partners." },
      ];

  const defaultCatalogCategories: ProductCategory[] = useMemo(() => {
    return categories.map((c, idx) => ({
      id: c.id, name: c.name, slug: c.slug, description: c.description, image_url: c.image, display_order: idx + 1, is_active: true,
    } as unknown as ProductCategory));
  }, []);

  const defaultImageBySlug = useMemo(() => {
    const map: Record<string, string> = {};
    defaultCatalogCategories.forEach((c) => {
      const img = String(c.image_url ?? "").trim();
      if (c.slug && img) map[c.slug] = img;
    });
    return map;
  }, [defaultCatalogCategories]);

  const cats = categoriesList.length > 0 ? categoriesList : defaultCatalogCategories;

  useEffect(() => {
    const fetchData = async () => {
      try {
        try {
          const featuredResponse = await api.getFeaturedProducts();
          if (featuredResponse.data) {
            const products = (featuredResponse.data as any[]).map((row) => apiProductToStorefront(row, priceAugmentationPercent, productAugmentations));
            // Shuffle and pick 8
            const shuffled = [...products].sort(() => Math.random() - 0.5);
            setFeaturedProducts(shuffled.slice(0, 8));
          } else {
            setFeaturedProducts([]);
          }
        } catch { setFeaturedProducts([]); } finally { setFeaturedLoaded(true); }

        try {
          const categoriesResponse = await api.getCategories(1, 100, { locale: lang });
          const list = unwrapApiList<ProductCategory>(categoriesResponse, defaultCatalogCategories);
          
          const merged = list.map((cat) => {
            const img = String(cat.image_url ?? "").trim();
            if (img) return cat;

            // Try fuzzy match with defaults if no uploaded image
            const defaultMatch = defaultCatalogCategories.find(d => 
              d.slug === cat.slug || 
              (cat.slug && d.slug && (cat.slug.includes(d.slug) || d.slug.includes(cat.slug))) ||
              (cat.name && d.name && (cat.name.toLowerCase().includes(d.name.toLowerCase()) || d.name.toLowerCase().includes(cat.name.toLowerCase())))
            );

            return { ...cat, image_url: defaultMatch?.image_url || cat.image_url };
          });
          
          // Sort to prioritize categories with images, then by display order
          const sorted = [...merged].sort((a, b) => {
            const hasA = Boolean(a.image_url);
            const hasB = Boolean(b.image_url);
            if (hasA && !hasB) return -1;
            if (!hasA && hasB) return 1;
            return (a.display_order ?? 99) - (b.display_order ?? 99);
          });

          setCategoriesList(sorted);
        } catch { setCategoriesList(defaultCatalogCategories); }
      } catch {}
    };
    fetchData();
  }, [lang, defaultCatalogCategories, defaultImageBySlug, priceAugmentationPercent, productAugmentations]);

  const rawWhyCards = (whyData.cards ?? []).filter((c) => c.desc?.trim());
  const useTestimonialLayout = rawWhyCards.length === 0 || rawWhyCards.some((c) => Boolean(c.role?.trim()));
  const displayWhyCards = rawWhyCards.length ? rawWhyCards : defaultWhyCards;

  return (
    <LandingThemeScope>
      <EditableSection sectionKey="site_header" showEdit={isAdmin}>
        {/* Top Header Bar */}
        <div className="bg-[#0f172a] text-white border-b border-white/5 py-2 px-4 sm:px-8 flex flex-col sm:flex-row justify-between items-center gap-2 sm:gap-4 relative z-50">
          <div className="flex items-center gap-2 font-display text-[10px] font-bold uppercase tracking-widest text-[#94a3b8]">
            <Mail className="h-3 w-3 text-accent" />
            <a href={`mailto:${siteHeaderCms.top_email || "info@remquip.ca"}`} className="hover:text-white transition-colors">
              {siteHeaderCms.top_email || "info@remquip.ca"}
            </a>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-4">
              {siteHeaderCms.social_facebook ? (
                <a href={siteHeaderCms.social_facebook} target="_blank" rel="noopener noreferrer" className="text-white hover:text-accent transition-all transform hover:scale-110">
                  <Facebook className="h-3.5 w-3.5" />
                  <span className="sr-only">Facebook</span>
                </a>
              ) : (
                <span className="text-white cursor-not-allowed"><Facebook className="h-3.5 w-3.5" /></span>
              )}
              {siteHeaderCms.social_instagram ? (
                <a href={siteHeaderCms.social_instagram} target="_blank" rel="noopener noreferrer" className="text-white hover:text-accent transition-all transform hover:scale-110">
                  <Instagram className="h-3.5 w-3.5" />
                  <span className="sr-only">Instagram</span>
                </a>
              ) : (
                 <span className="text-white cursor-not-allowed"><Instagram className="h-3.5 w-3.5" /></span>
              )}
              {siteHeaderCms.social_linkedin ? (
                <a href={siteHeaderCms.social_linkedin} target="_blank" rel="noopener noreferrer" className="text-white hover:text-accent transition-all transform hover:scale-110">
                  <Linkedin className="h-3.5 w-3.5" />
                  <span className="sr-only">LinkedIn</span>
                </a>
              ) : (
                 <span className="text-white cursor-not-allowed"><Linkedin className="h-3.5 w-3.5" /></span>
              )}
            </div>
            <div className="h-3 w-[1px] bg-white/10 hidden sm:block" />
            <div className="flex items-center gap-2 font-display text-[10px] font-bold uppercase tracking-widest text-white hover:text-accent transition-colors">
               <span className="text-[#94a3b8]">{t("header.professional_email_label")}:</span>
               <a href={`mailto:${siteHeaderCms.professional_email || "info@remquip.ca"}`}>
                 {siteHeaderCms.professional_email || "info@remquip.ca"}
               </a>
            </div>
          </div>
        </div>

        {urgencyText ? (
          <div className="bg-destructive text-destructive-foreground py-3 px-4 sm:px-8 flex flex-wrap justify-center items-center gap-4 shadow-sm z-40 relative">
            <div className="flex items-center gap-2 font-display text-[11px] sm:text-xs font-black uppercase tracking-widest text-center">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive-foreground opacity-50" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-destructive-foreground" />
              </span>
              {urgencyText}
            </div>
            {urgencyCtaLabel ? (
              <Link
                to={urgencyCtaHref}
                className="bg-background text-foreground px-5 py-2 rounded font-display text-[10px] font-black uppercase tracking-widest hover:bg-background/90 transition-all shadow-sm active:scale-95"
              >
                {urgencyCtaLabel}
              </Link>
            ) : null}
          </div>
        ) : null}
        {marqueeItems.length > 0 ? (
          <aside className="bg-muted text-foreground py-2.5 text-center overflow-hidden border-b border-border shadow-sm z-30 relative backdrop-blur-sm">
            <div className="landing-marquee-track inline-flex items-center gap-6 whitespace-nowrap px-4 font-display text-[11px] sm:text-xs font-black uppercase tracking-[0.25em]">
              {[...marqueeItems, ...marqueeItems].map((line, i) => (
                <React.Fragment key={`${line}-${i}`}>
                  <span className="opacity-80">{line}</span>
                  <span className="opacity-20 text-accent mx-2">✦</span>
                </React.Fragment>
              ))}
            </div>
          </aside>
        ) : null}
      </EditableSection>

      <EditableSection sectionKey="hero" showEdit={isAdmin}>
        {/* We keep LandingHero to preserve the inner CMS integration but it will naturally inherit our updated LandingThemeScope CSS */}
        <div className="relative isolate">
          <LandingHero hero={hero} heroCta={heroCta} heroSecondary={valuePropsParsed.heroSecondary} />
          {/* Subtle glow underneath hero */}
          <div className="absolute inset-x-0 bottom-0 -z-10 h-24 bg-gradient-to-t from-background to-transparent" />
        </div>
      </EditableSection>

      {/* COMMENTED OUT: Trusted by Operators section */}
      {/* <EditableSection sectionKey="value_props" showEdit={isAdmin}>
        <section className="bg-background py-16 md:py-24 border-b border-border/40 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-[radial-gradient(circle_at_50%_50%,hsl(var(--accent)/0.03),transparent_60%)] pointer-events-none -translate-y-1/2 translate-x-1/3" />
          
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <p className="font-display text-[11px] font-black uppercase tracking-[0.4em] text-center text-muted-foreground/80 mb-10 md:mb-14">
              {valuePropsParsed.trustBar.headline}
            </p>
            <div className="relative overflow-hidden logo-marquee-mask">
              <div className="logo-marquee-track flex items-center gap-12 md:gap-24 py-4 whitespace-nowrap">
                {[...valuePropsParsed.trustBar.logos, ...valuePropsParsed.trustBar.logos, ...valuePropsParsed.trustBar.logos, ...valuePropsParsed.trustBar.logos].map((name, i) => (
                  <div key={`${name}-${i}`} className="font-display text-xl md:text-3xl font-black tracking-tighter text-foreground/30 hover:text-foreground transition-all duration-700 drop-shadow-sm flex-shrink-0">
                    {name}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </EditableSection> */}

      <EditableSection sectionKey="categories_intro" showEdit={isAdmin} id="categories">
        <section className="py-24 md:py-32 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-6 mb-12 md:mb-16">
            <div className="max-w-2xl">
              <span className="font-display text-accent font-black tracking-[0.25em] text-[11px] uppercase mb-3 block">
                {catIntro.title || "Catalog"}
              </span>
              <h2 className="font-display text-4xl md:text-6xl font-black uppercase tracking-tight text-foreground leading-none">
                {catIntro.description || "Core inventory"}
              </h2>
            </div>
            <Link
              to="/products"
              className="group font-display text-accent uppercase tracking-widest text-xs font-black inline-flex items-center gap-2 transition-all shrink-0 hover:text-foreground bg-accent/10 hover:bg-accent px-5 py-3 rounded-lg"
            >
              {viewAllCategories} <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" strokeWidth={2.5} />
            </Link>
          </div>

          {cats.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-20 rounded-3xl border border-dashed border-border/60 bg-muted/10">
              No categories available. Please configure your catalog.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-4 md:grid-rows-2 gap-4 md:gap-5 md:min-h-[640px] lg:min-h-[720px] auto-rows-fr">
              {cats[0] ? (
                <Link key={cats[0].id} to={`/products/${cats[0].slug || ""}`} className="md:col-span-2 md:row-span-2 bg-muted/20 group relative overflow-hidden rounded-2xl min-h-[320px] md:min-h-0 border border-border/50 shadow-sm hover:shadow-2xl transition-all duration-500">
                  {cats[0].image_url && (
                    <img src={resolveUploadImageUrl(cats[0].image_url)} alt={cats[0].name} className="absolute inset-0 w-full h-full object-cover mix-blend-multiply dark:mix-blend-normal opacity-80 group-hover:scale-110 transition-transform duration-1000 ease-out" loading="lazy" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />
                  <div className="absolute inset-0 p-8 flex flex-col justify-end">
                    <span className="font-display text-accent bg-accent/20 backdrop-blur-md w-fit px-3 py-1.5 rounded text-[10px] font-black tracking-widest mb-4 uppercase inline-flex items-center gap-2">
                       {t("cat.shop_all")} <ArrowRight className="h-3 w-3" strokeWidth={3} />
                    </span>
                    <h3 className="font-display text-3xl md:text-5xl font-black uppercase text-white drop-shadow-md">
                      {cats[0].name}
                    </h3>
                  </div>
                </Link>
              ) : null}
              {cats[1] ? (
                <Link key={cats[1].id} to={`/products/${cats[1].slug || ""}`} className="md:col-span-2 md:row-span-1 bg-muted/20 group relative overflow-hidden rounded-2xl min-h-[240px] border border-border/50 shadow-sm hover:shadow-xl transition-all duration-500">
                  {cats[1].image_url && (
                    <img src={resolveUploadImageUrl(cats[1].image_url)} alt={cats[1].name} className="absolute inset-0 w-full h-full object-cover mix-blend-multiply dark:mix-blend-normal opacity-60 group-hover:opacity-80 group-hover:scale-105 transition-all duration-700 ease-out" loading="lazy" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
                  <div className="absolute inset-0 p-6 sm:p-8 flex flex-col justify-end">
                    <h3 className="font-display text-2xl md:text-3xl font-black uppercase text-white drop-shadow-md mb-4">{cats[1].name}</h3>
                    <span className="w-fit px-5 py-2.5 rounded-lg font-display text-[10px] font-black tracking-widest uppercase border border-white/20 bg-white/10 backdrop-blur-md text-white hover:bg-white hover:text-black transition-colors shadow-sm">
                      {t("cat.shop_all")}
                    </span>
                  </div>
                </Link>
              ) : null}
              {cats.slice(2, 4).map((cat) => (
                <Link key={cat.id} to={`/products/${cat.slug || ""}`} className="md:col-span-1 md:row-span-1 bg-muted/20 group relative overflow-hidden rounded-2xl min-h-[220px] border border-border/50 shadow-sm hover:shadow-md transition-all duration-500">
                  {cat.image_url && (
                    <img src={resolveUploadImageUrl(cat.image_url)} alt={cat.name} className="absolute inset-0 w-full h-full object-cover mix-blend-multiply dark:mix-blend-normal opacity-50 group-hover:opacity-70 group-hover:scale-105 transition-all duration-700 ease-out" loading="lazy" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent pointer-events-none" />
                  <div className="absolute inset-0 p-6 flex flex-col justify-end">
                    <h3 className="font-display text-xl font-black uppercase text-white drop-shadow-md mb-4">{cat.name}</h3>
                    <span className="w-fit px-4 py-2 rounded-lg font-display text-[10px] font-black tracking-widest uppercase border border-white/20 bg-white/10 backdrop-blur-md text-white hover:bg-white hover:text-[#1f354d] transition-colors shadow-sm">
                      Explore
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </EditableSection>

      <EditableSection sectionKey="featured_intro" showEdit={isAdmin} id="products">
        <section className="bg-muted/10 py-24 md:py-32 relative overflow-hidden">
          <div className="absolute top-0 right-1/4 w-[1000px] h-[1000px] bg-[radial-gradient(circle_at_50%_0%,hsl(var(--accent)/0.04),transparent_50%)] pointer-events-none -translate-y-1/2" />
          
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="mb-12 md:mb-16 text-center max-w-3xl mx-auto">
              <span className="font-display text-accent font-black tracking-[0.25em] text-[11px] uppercase mb-3 block">
                {featIntro.title || t("products.popular")}
              </span>
              <h2 className="font-display text-3xl md:text-5xl font-black uppercase tracking-tight text-foreground leading-none">
                {featIntro.description || t("home.popular.description")}
              </h2>
            </div>

            {!featuredLoaded ? (
              <div className="flex justify-center items-center h-64 border border-dashed border-border/60 rounded-3xl bg-muted/10">
                <p className="text-sm font-display font-medium text-muted-foreground uppercase tracking-widest">{t("products.loading")}...</p>
              </div>
            ) : featuredProducts.length === 0 ? (
              <div className="flex justify-center items-center h-64 border border-dashed border-border/60 rounded-3xl bg-muted/10">
                <p className="text-sm text-muted-foreground font-display max-w-sm text-center">No featured products. Mark products as featured in the admin panel.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
                {featuredProducts.map((product) => {
                  const isOutOfStock = product.stock <= 0;
                  return (
                    <FeaturedProductCard key={product.id} product={product} isOutOfStock={isOutOfStock} addItem={addItem} formatPrice={formatPrice} t={t} />
                  );
                })}
              </div>
            )}

            <div className="mt-12 md:mt-16 text-center lg:hidden">
              <Link to="/products" className="inline-flex items-center gap-2 text-sm font-display font-bold uppercase tracking-widest text-accent hover:text-foreground transition-colors bg-accent/10 px-6 py-3.5 rounded-lg border border-transparent hover:border-border/50">
                {viewAllFeatured} <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </EditableSection>

      <EditableSection sectionKey="why_remquip" showEdit={isAdmin} id="about">
        <section className="py-24 md:py-32 px-4 sm:px-6 lg:px-8 bg-background relative overflow-hidden">
          <div className="max-w-7xl mx-auto relative z-10">
            <div className="text-center mb-16 md:mb-20 max-w-3xl mx-auto">
              <span className="font-display text-accent font-black tracking-[0.25em] text-[11px] uppercase mb-4 block">
                {whyRemquip.title || "Field reports"}
              </span>
              <h2 className="font-display text-3xl md:text-5xl font-black uppercase tracking-tight text-foreground leading-tight">
                {whyRemquip.description || "Why operators choose REMQUIP"}
              </h2>
              {whyData.subtitle ? (
                <p className="text-base text-muted-foreground mt-6 leading-relaxed max-w-2xl mx-auto">{whyData.subtitle}</p>
              ) : null}
            </div>

            {useTestimonialLayout ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
                {displayWhyCards.map((card, i) => (
                  <div key={`${card.title}-${i}`} className="bg-card p-8 md:p-10 rounded-3xl border border-border/60 shadow-md hover:shadow-xl transition-shadow relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-5">
                       <Package className="w-32 h-32 -rotate-12 group-hover:rotate-0 transition-transform duration-700" />
                    </div>
                    <div className="flex text-accent mb-6 gap-1" aria-hidden>
                      {Array.from({ length: 5 }).map((_, si) => <Star key={si} className="h-5 w-5 fill-current text-accent" strokeWidth={0} />)}
                    </div>
                    <p className="text-foreground/90 font-medium mb-8 leading-relaxed text-lg lg:text-xl relative z-10">&ldquo;{card.desc}&rdquo;</p>
                    <div className="flex items-center gap-5 mt-auto relative z-10">
                      <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center font-display font-black text-sm text-accent shadow-sm border border-accent/20">
                        {card.title.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-display font-bold text-sm uppercase tracking-wide text-foreground">{card.title}</h4>
                        {card.role && <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1 font-display font-semibold">{card.role}</p>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 lg:gap-8">
                {displayWhyCards.map(({ icon: iconKey, title, desc }, i) => {
                  const Icon = ICON_MAP[iconKey ?? "Package"] ?? Package;
                  return (
                    <div key={i} className="h-full p-8 md:p-10 border border-border/60 rounded-3xl bg-card hover:border-accent/30 shadow-sm hover:shadow-xl transition-all group">
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6 bg-accent/10 border border-accent/20 group-hover:scale-110 transition-transform duration-500">
                        <Icon className="h-6 w-6 text-accent" strokeWidth={2} />
                      </div>
                      <h3 className="font-display text-xl font-black text-foreground mb-4 uppercase tracking-tight">{title}</h3>
                      <p className="text-base text-muted-foreground leading-relaxed font-medium">{desc}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </EditableSection>

      <EditableSection sectionKey="wholesale_cta" showEdit={isAdmin} id="wholesale">
        <section className="py-24 md:py-32 bg-background relative overflow-hidden">
          <div className="absolute inset-0 z-0 pointer-events-none">
            <div className="absolute top-1/2 left-1/2 w-full max-w-5xl h-[800px] bg-[radial-gradient(ellipse_at_center,hsl(var(--accent)/0.1),transparent_70%)] -translate-x-1/2 -translate-y-1/2" />
          </div>
          
          <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-12 gap-0 rounded-[2rem] overflow-hidden border border-border/50 bg-card shadow-2xl relative">
              <div className="absolute inset-0 bg-gradient-to-r from-background/95 to-background/50 pointer-events-none z-10" />
              
              <div className="p-8 md:p-16 lg:p-24 lg:col-span-7 flex flex-col justify-center relative z-20">
                <span className="font-display text-accent font-black uppercase tracking-[0.3em] text-[11px] mb-6 block">
                  {wholesaleCta.title || "Partnership"}
                </span>
                <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-black uppercase mb-8 tracking-tight text-foreground leading-[1.1]">
                  {wholesaleCta.description || "Wholesale programs for fleet operators."}
                </h2>
                <p className="text-lg md:text-xl text-muted-foreground mb-10 leading-relaxed font-medium max-w-xl">
                  {wholesaleData.body || "Competitive bulk pricing, account support, and streamlined ordering for your operation."}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mb-10">
                  {wholesaleBullets.map((b) => (
                    <div key={b.title} className="flex items-start gap-4">
                      <div className="p-1.5 rounded-full bg-accent/20 text-accent mt-0.5"><CheckCircle2 className="h-4 w-4" strokeWidth={3} /></div>
                      <div>
                        <h4 className="font-display font-black text-sm uppercase text-foreground mb-1.5">{b.title}</h4>
                        <p className="text-sm text-muted-foreground leading-relaxed">{b.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex flex-col sm:flex-row gap-4 mt-4">
                  <Link to={wholesaleData.cta_primary_link || "/register"} className="inline-flex items-center justify-center gap-3 px-8 py-4 rounded-xl font-display font-black text-sm uppercase tracking-widest text-primary-foreground bg-primary hover:bg-accent transition-colors shadow-xl hover:shadow-2xl hover:-translate-y-1">
                    {wholesaleData.cta_primary_label || "Join wholesale"} <ArrowRight className="h-4 w-4" strokeWidth={3} />
                  </Link>
                  <Link to={wholesaleData.cta_secondary_link || "/contact"} className="inline-flex items-center justify-center gap-3 px-8 py-4 rounded-xl font-display font-black text-sm uppercase tracking-widest text-foreground bg-transparent border-2 border-border hover:border-foreground transition-all">
                    <Phone className="h-4 w-4" strokeWidth={2.5} /> {wholesaleData.cta_secondary_label || "Contact sales"}
                  </Link>
                </div>
              </div>
              
              <div className="relative min-h-[400px] lg:min-h-full lg:col-span-5 hidden md:block">
                <img src={wholesaleBannerSrc} alt={wholesaleBannerAlt} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-r from-card to-transparent w-2/3 lg:w-1/2" />
                
                {wholesaleData.badge_label && (
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-background/80 backdrop-blur-xl border border-white/10 rounded-full flex items-center justify-center p-4 text-center shadow-2xl animate-spin-slow pointer-events-none">
                    <div className="absolute inset-2 border border-dashed border-foreground/20 rounded-full" />
                    <span className="font-display font-black text-[10px] leading-tight uppercase text-foreground">
                      {wholesaleData.badge_label}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </EditableSection>

    </LandingThemeScope>
  );
}

import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Truck,
  Package,
  Wrench,
  CheckCircle,
  Shield,
  Users,
  BarChart3,
} from "lucide-react";
import { resolveUploadImageUrl } from "@/lib/api";
import { useLanguage } from "@/contexts/LanguageContext";
import heroImage from "@/assets/hero-truck-remquip.png";
import heroMobileImage from "@/assets/images/hero-mobile.jpg";

export type HeroSlideInput = { image_url?: string; alt?: string; caption?: string };

export type HeroCtaContent = {
  cta_primary_label?: string;
  cta_primary_link?: string;
  cta_secondary_label?: string;
  cta_secondary_link?: string;
  hero_image_alt?: string;
  eyebrow?: string;
  hero_layout?: string;
  carousel_interval_ms?: number;
  slides?: HeroSlideInput[];
};

type ResolvedSlide = { src: string; alt: string; caption: string };

const HERO_SECONDARY_ICONS: Record<string, React.ComponentType<{ className?: string; strokeWidth?: number | string }>> = {
  Truck,
  Package,
  Wrench,
  CheckCircle,
  Shield,
  Users,
  BarChart3,
  local_shipping: Truck,
  inventory_2: Package,
};

function buildSlides(
  heroImageUrl: string | undefined,
  fallbackAlt: string,
  cta: HeroCtaContent,
  fallbackAsset: string
): ResolvedSlide[] {
  const fromSlides = (cta.slides ?? [])
    .map((s) => ({
      url: s.image_url?.trim() ?? "",
      alt: s.alt?.trim() || fallbackAlt,
      caption: s.caption?.trim() ?? "",
    }))
    .filter((s) => s.url.length > 0);

  if (fromSlides.length > 0) {
    return fromSlides.map((s) => ({
      src: resolveUploadImageUrl(s.url),
      alt: s.alt,
      caption: s.caption,
    }));
  }

  if (heroImageUrl?.trim()) {
    return [
      {
        src: resolveUploadImageUrl(heroImageUrl.trim()),
        alt: fallbackAlt,
        caption: "",
      },
    ];
  }

  return [{ src: fallbackAsset, alt: fallbackAlt, caption: "" }];
}

function resolveLayout(cta: HeroCtaContent, slideCount: number): "split" | "spotlight" {
  const raw = cta.hero_layout?.toLowerCase()?.trim();
  if (raw === "spotlight") return "spotlight";
  if (raw === "split") return "split";
  return slideCount >= 2 ? "split" : "spotlight";
}

function clampInterval(ms: number | undefined): number {
  const n = typeof ms === "number" && !Number.isNaN(ms) ? ms : 6000;
  return Math.min(90000, Math.max(4000, n));
}

type HeroSection = {
  title?: string;
  description?: string;
  image_url?: string;
};

export default function LandingHero({
  hero,
  heroCta,
  heroSecondary = [],
}: {
  hero: HeroSection;
  heroCta: HeroCtaContent;
  /** Optional row under hero CTAs (e.g. shipping / bulk); icon keys match lucide or aliases */
  heroSecondary?: { icon: string; text: string }[];
}) {
  const fallbackAlt = heroCta.hero_image_alt?.trim() || "Commercial semi-truck on the highway — fleet and parts";
  const slides = useMemo(
    () => buildSlides(hero.image_url, fallbackAlt, heroCta, heroImage),
    [hero.image_url, fallbackAlt, heroCta]
  );
  const layout = useMemo(() => resolveLayout(heroCta, slides.length), [heroCta, slides.length]);
  const intervalMs = useMemo(() => clampInterval(heroCta.carousel_interval_ms), [heroCta.carousel_interval_ms]);

  const [index, setIndex] = useState(0);
  const safeIndex = slides.length ? index % slides.length : 0;

  useEffect(() => {
    setIndex(0);
  }, [slides.length]);

  useEffect(() => {
    if (layout !== "split" || slides.length <= 1) return;
    const t = window.setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, intervalMs);
    return () => window.clearInterval(t);
  }, [layout, slides.length, intervalMs]);

  const { t } = useLanguage();
  const title = t("hero.title");
  const titleLines = title.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const titlePrimary = titleLines[0] ?? title;
  const titleAccentLine = titleLines.length > 1 ? titleLines.slice(1).join(" ") : null;

  const description = hero.description?.trim() || "";
  const eyebrow = heroCta.eyebrow?.trim();

  const primary = {
    label: heroCta.cta_primary_label?.trim() || "Browse Catalog",
    href: heroCta.cta_primary_link?.trim() || "/products",
  };
  const secondary = {
    label: heroCta.cta_secondary_label?.trim() || "Wholesale Program",
    href: heroCta.cta_secondary_link?.trim() || "/register",
  };

  const go = (dir: -1 | 1) => {
    setIndex((i) => (i + dir + slides.length) % slides.length);
  };

  const secondaryRow = heroSecondary;

  /* ── Mobile hero (visible < md) ── */
  const MobileHero = () => {
    const bg = slides[safeIndex];
    return (
      <section className="lg:hidden relative overflow-hidden bg-background">
        {/* Compact image area */}
        <div className="relative h-[55vw] min-h-[220px] max-h-[320px] overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.img
              key={safeIndex}
              src={bg.src}
              alt={bg.alt}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="absolute inset-0 w-full h-full object-cover"
              loading="eager"
              fetchPriority="high"
            />
          </AnimatePresence>
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />
          {/* Slide dots */}
          {slides.length > 1 && (
            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5 z-10">
              {slides.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setIndex(i)}
                  className={`h-1.5 rounded-full transition-all ${
                    i === safeIndex ? "w-5 bg-accent" : "w-1.5 bg-white/50"
                  }`}
                  aria-label={`Slide ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Text content below image */}
        <div className="px-5 pb-8 pt-2 space-y-4">
          {eyebrow && (
            <span className="inline-block font-display text-accent uppercase tracking-[0.25em] text-[9px] font-bold border border-accent/30 bg-accent/5 px-3 py-1 rounded-full">
              {eyebrow}
            </span>
          )}
          <h1 className="font-display font-black text-foreground uppercase tracking-tight text-[7vw] leading-[1.05]" style={{ fontSize: "clamp(1.5rem, 7vw, 2.2rem)" }}>
            {titleAccentLine ? (
              <>
                <span className="block">{titlePrimary}</span>
                <span className="block text-accent/80 mt-0.5">{titleAccentLine}</span>
              </>
            ) : (
              titlePrimary
            )}
          </h1>
          {description && (
            <p className="text-muted-foreground text-sm leading-relaxed line-clamp-3">
              {description}
            </p>
          )}
          <div className="flex gap-3 pt-1">
            <Link
              to={primary.href}
              className="landing-machined-cta flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-md font-display font-bold uppercase tracking-wider text-xs shadow-md active:scale-[0.97] transition-transform"
            >
              {primary.label}
              <ArrowRight className="h-4 w-4 shrink-0" strokeWidth={2.5} />
            </Link>
            <Link
              to={secondary.href}
              className="flex-1 inline-flex items-center justify-center gap-2 border border-border bg-card px-5 py-3 rounded-md font-display font-bold uppercase tracking-wider text-xs text-foreground active:scale-[0.97] transition-transform"
            >
              {secondary.label}
            </Link>
          </div>
        </div>
      </section>
    );
  };

  if (layout === "spotlight") {
    const bg = slides[0];
    return (
      <>
        <MobileHero />
        <section className="hidden lg:flex relative min-h-[min(780px,88vh)] items-center overflow-hidden bg-background">
          {/* Background image */}
          <div className="absolute inset-0 z-0">
            <img
              src={bg.src}
              alt={bg.alt}
              className="w-full h-full object-cover object-right"
              loading="eager"
              fetchPriority="high"
              decoding="async"
              width={1920}
              height={1080}
            />
          </div>
          {/* Stronger left-side gradient for text readability */}
          <div className="absolute inset-0 z-[1] bg-gradient-to-r from-background/60 via-transparent via-25% to-transparent" />

          <div className="relative z-10 w-full max-w-[1440px] mx-auto px-6 sm:px-8 lg:px-12 py-16 md:py-24">
            <div className="max-w-2xl">
              <motion.div
                initial={{ opacity: 0, y: 28 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="space-y-6 md:space-y-8"
              >
                {eyebrow && (
                  <span className="inline-block font-display text-accent uppercase tracking-[0.3em] text-[10px] sm:text-xs font-bold border border-accent/30 bg-accent/5 px-4 py-1.5 rounded-full">
                    {eyebrow}
                  </span>
                )}
                <h1 className="font-display landing-hero-title-industrial font-black text-foreground uppercase tracking-tighter text-lg sm:text-xl md:text-2xl leading-[1.1]">
                  {titleAccentLine ? (
                    <>
                      <span className="block">{titlePrimary}</span>
                      <span className="block text-accent/80 mt-1">{titleAccentLine}</span>
                    </>
                  ) : (
                    titlePrimary
                  )}
                </h1>
                {description && (
                  <p className="landing-hero-subtitle text-muted-foreground max-w-lg leading-relaxed font-normal text-sm md:text-[15px]">
                    {description}
                  </p>
                )}
                <div className="flex flex-wrap gap-3 md:gap-4 pt-2">
                  <Link
                    to={primary.href}
                    className="landing-machined-cta inline-flex items-center justify-center gap-2.5 px-7 py-3.5 md:px-9 md:py-4 rounded-md font-display font-bold uppercase tracking-widest text-xs sm:text-sm shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all"
                  >
                    {primary.label}
                    <ArrowRight className="h-4 w-4 shrink-0" strokeWidth={2.5} />
                  </Link>
                  <Link
                    to={secondary.href}
                    className="inline-flex items-center justify-center gap-2 border border-border bg-card/90 backdrop-blur-sm px-7 py-3.5 md:px-9 md:py-4 rounded-md font-display font-bold uppercase tracking-widest text-xs sm:text-sm text-foreground hover:bg-muted/80 transition-all shadow-sm"
                  >
                    {secondary.label}
                  </Link>
                </div>
              </motion.div>
            </div>
          </div>
        </section>
      </>
    );
  }

  /* Split layout — copy left, gallery / carousel right */
  return (
    <>
      <MobileHero />
      <section className="hidden lg:block relative overflow-hidden bg-muted/30 min-h-[520px] lg:min-h-[640px]">
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-muted/40" />
        <div className="absolute inset-0 opacity-[0.06] bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-accent via-transparent to-transparent" />

        <div className="relative max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-14 md:py-20 lg:py-24">
          <div className="grid lg:grid-cols-12 gap-10 lg:gap-14 items-center">
            <div className="lg:col-span-5 text-foreground">
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              >
                {eyebrow && (
                  <p className="text-muted-foreground text-xs font-semibold uppercase tracking-[0.2em] mb-4">{eyebrow}</p>
                )}
                <h1 className="font-display landing-hero-title font-bold mb-5 md:mb-7 tracking-tight" style={{ letterSpacing: "-0.02em" }}>
                  {titleAccentLine ? (
                    <>
                      <span className="block">{titlePrimary}</span>
                      <span className="block text-muted-foreground mt-1">{titleAccentLine}</span>
                    </>
                  ) : (
                    titlePrimary
                  )}
                </h1>
                <p className="landing-hero-subtitle text-muted-foreground mb-9 md:mb-10 font-normal leading-relaxed">{description}</p>
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                  <Link
                    to={primary.href}
                    className="landing-machined-cta inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-sm font-display font-semibold text-sm uppercase tracking-wider shadow-md hover:scale-[1.02] active:scale-[0.98] transition-transform"
                  >
                    {primary.label}
                    <ArrowRight className="h-5 w-5" />
                  </Link>
                  <Link
                    to={secondary.href}
                    className="inline-flex items-center justify-center gap-2 border border-border bg-card px-8 py-3.5 rounded-sm font-display font-semibold text-sm uppercase tracking-wider hover:bg-muted/80 transition-colors"
                  >
                    {secondary.label}
                  </Link>
                </div>
              </motion.div>
            </div>

            <div className="lg:col-span-7">
              <div className="relative mx-auto max-w-xl lg:max-w-none">
                <div className="relative aspect-[4/3] sm:aspect-[16/10] rounded-xl overflow-hidden shadow-2xl ring-1 ring-border bg-muted">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={safeIndex}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.45 }}
                      className="absolute inset-0"
                    >
                      <img
                        src={slides[safeIndex].src}
                        alt={slides[safeIndex].alt}
                        className="w-full h-full object-cover"
                        loading={safeIndex === 0 ? "eager" : "lazy"}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-foreground/20 via-transparent to-transparent pointer-events-none" />
                      {slides[safeIndex].caption && (
                        <p className="absolute bottom-4 left-4 right-4 text-sm text-background font-medium drop-shadow-md">
                          {slides[safeIndex].caption}
                        </p>
                      )}
                    </motion.div>
                  </AnimatePresence>

                  {slides.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={() => go(-1)}
                        className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-foreground/30 hover:bg-foreground/45 text-background p-2 backdrop-blur-sm transition-colors"
                        aria-label="Previous slide"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => go(1)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-foreground/30 hover:bg-foreground/45 text-background p-2 backdrop-blur-sm transition-colors"
                        aria-label="Next slide"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </button>
                      <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
                        {slides.map((_, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setIndex(i)}
                            className={`h-1.5 rounded-full transition-all ${
                              i === safeIndex ? "w-6 bg-background" : "w-1.5 bg-background/40 hover:bg-background/60"
                            }`}
                            aria-label={`Go to slide ${i + 1}`}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {slides.length > 1 && (
                  <div className="hidden sm:flex gap-3 mt-4 justify-end pr-1">
                    {slides.slice(0, 3).map((s, i) => (
                      <button
                        key={`${s.src}-${i}`}
                        type="button"
                        onClick={() => setIndex(i)}
                        className={`relative w-20 h-14 md:w-24 md:h-16 rounded-lg overflow-hidden ring-2 transition-all ${
                          i === safeIndex ? "ring-accent opacity-100" : "ring-transparent opacity-70 hover:opacity-100"
                        }`}
                      >
                        <img src={s.src} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

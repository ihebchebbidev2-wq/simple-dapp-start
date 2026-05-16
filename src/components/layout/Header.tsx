import React, { useState, useEffect, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { ShoppingCart, User, Menu, X, ChevronDown, Pencil } from "lucide-react";
import { useLanguage, localeLabel, localeFlag } from "@/contexts/LanguageContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import FlagIcon from "@/components/FlagIcon";
import { resolveUploadImageUrl } from "@/lib/api";
import { usePublicSettings } from "@/hooks/useApi";
import { useCMSPageContent } from "@/hooks/useCMS";
import { ADMIN_NO_AUTH } from "@/config/constants";

// Sub-components
import { AnnouncementBar } from "./header/AnnouncementBar";
import { CategoryStrip } from "./header/CategoryStrip";
import { HeaderSearch } from "./header/HeaderSearch";
import { MobileMenu } from "./header/MobileMenu";

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw?.trim()) return fallback;
  try {
    const v = JSON.parse(raw);
    return (v ?? fallback) as T;
  } catch {
    return fallback;
  }
}

export default function Header() {
  const { data: pubRes } = usePublicSettings();
  const pub = (pubRes?.data ?? {}) as Record<string, string>;
  const brandName = pub.store_name || pub.site_name || "REMQUIP";
  
  const { user, isAuthenticated } = useAuth();
  const canEditHeader = user?.role === "admin" || user?.role === "super_admin" || user?.role === "manager";
  
  const { t, lang, setLang, supportedLocales } = useLanguage();
  const { data: homeCmsSections = [] } = useCMSPageContent("home", lang);
  
  const headerBlock = useMemo(
    () => (homeCmsSections as { section_key: string; content?: string; image_url?: string }[]).find(
        (s) => s.section_key === "site_header"
      ),
    [homeCmsSections]
  );
  
  const headerCms = useMemo(
    () => parseJson<{
        announcement?: string;
        announcement_link_url?: string;
        announcement_link_label?: string;
        trust_chips?: string[];
      }>(headerBlock?.content, {}),
    [headerBlock?.content]
  );
  
  const announcement = headerCms.announcement?.trim() ?? "";
  const announcementHref = headerCms.announcement_link_url?.trim() ?? "";
  const announcementLinkLabel = headerCms.announcement_link_label?.trim() ?? "";
  const trustChips = (headerCms.trust_chips ?? []).map((c) => c.trim()).filter(Boolean).slice(0, 4);
  const logoUrl = headerBlock?.image_url?.trim() ? resolveUploadImageUrl(headerBlock.image_url.trim()) : "";
  const showAnnouncement = announcement.length > 0;
  
  const { currency, setCurrency } = useCurrency();
  const { itemCount, lastAddedAt } = useCart();
  const location = useLocation();
  
  const [mobileOpen, setMobileOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [currOpen, setCurrOpen] = useState(false);
  const [badgeBounce, setBadgeBounce] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (lastAddedAt > 0) {
      setBadgeBounce(true);
      const timer = setTimeout(() => setBadgeBounce(false), 600);
      return () => clearTimeout(timer);
    }
  }, [lastAddedAt]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  // Click outside handlers for dropdowns
  useEffect(() => {
    function handleClick() {
      setLangOpen(false);
      setCurrOpen(false);
    }
    // Simple global click listener
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  const langFlag = localeFlag(lang);
  const currFlag = currency === "CAD" ? "ca" : currency === "USD" ? "us" : "eu";
  
  const path = location.pathname;
  const navLinkClass = (to: string, exact?: boolean) => {
    const active = exact ? path === to : path === to || (to !== "/" && path.startsWith(to));
    return `relative whitespace-nowrap px-2 py-6 text-[14px] font-bold tracking-wide transition-colors group ${
      active ? "text-accent" : "text-white/80 hover:text-white"
    }`;
  };

  const mobileOverlayTop = showAnnouncement ? "top-[9rem]" : "top-[5rem]";

  const headerEditLink = canEditHeader ? (
    <Link
      to="/admin/landing#section-site_header"
      className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-white/90 hover:bg-white/15 hover:text-white transition-colors shrink-0 backdrop-blur-sm shadow-sm"
      title={t("header.edit")}
    >
      <Pencil className="h-3 w-3 shrink-0" strokeWidth={2.5} aria-hidden />
      {t("header.edit")}
    </Link>
  ) : null;

  return (
    <>
      <header className={`sticky top-0 z-[100] w-full transition-all duration-300 ${isScrolled ? 'bg-[#1f354d]/90 backdrop-blur-xl shadow-lg border-b border-white/10' : 'bg-[#1f354d] border-b border-white/5'}`} role="banner">
        
        <AnnouncementBar 
          announcement={announcement}
          announcementHref={announcementHref}
          announcementLinkLabel={announcementLinkLabel}
          trustChips={trustChips}
          headerEditLink={headerEditLink}
        />

        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-50">
          <div className="flex items-center justify-between gap-4 lg:gap-8 min-h-[72px]">
            
            {/* 1. Brand Logo */}
            <div className="flex shrink-0 items-center">
              <Link to="/" className="flex items-center gap-3 transition-opacity hover:opacity-90 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-lg">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt={brandName}
                    className="h-9 sm:h-10 lg:h-11 w-auto max-w-[140px] object-contain transition-transform group-hover:scale-105 duration-300"
                  />
                ) : null}
                <span className={`font-display font-black tracking-widest text-white uppercase truncate ${logoUrl ? "hidden sm:block text-sm lg:text-base" : "text-lg lg:text-xl"}`}>
                  {brandName}
                </span>
              </Link>
            </div>

            {/* 2. Primary Desktop Navigation */}
            <nav className="hidden lg:flex items-center gap-4 xl:gap-8 h-full relative z-10 ml-6 xl:ml-10" aria-label="Main">
              <Link to="/products" className={navLinkClass("/products")}>
                {t("nav.products")}
                <span className={`absolute bottom-0 left-0 w-full h-[3px] rounded-t-full bg-accent transform origin-bottom transition-transform duration-300 ${path.startsWith("/products") ? "scale-y-100" : "scale-y-0 group-hover:scale-y-100"}`} />
              </Link>
              <Link to="/about" className={navLinkClass("/about", true)}>
                {t("nav.about")}
                <span className={`absolute bottom-0 left-0 w-full h-[3px] rounded-t-full bg-accent transform origin-bottom transition-transform duration-300 ${path === "/about" ? "scale-y-100" : "scale-y-0 group-hover:scale-y-100"}`} />
              </Link>
              <Link to="/contact" className={navLinkClass("/contact", true)}>
                {t("nav.contact")}
                <span className={`absolute bottom-0 left-0 w-full h-[3px] rounded-t-full bg-accent transform origin-bottom transition-transform duration-300 ${path === "/contact" ? "scale-y-100" : "scale-y-0 group-hover:scale-y-100"}`} />
              </Link>
            </nav>

            {/* 3. Search & Utilities (Right Side) */}
            <div className="flex flex-1 shrink-0 justify-end gap-3 sm:gap-4 md:gap-5 lg:gap-6 items-center relative z-20">
              {/* Search - Hidden on small mobile, shown as pill on md+ */}
              <div className="hidden lg:block flex-1 min-w-0 lg:w-48 xl:w-72">
                <HeaderSearch />
              </div>

              {/* Utility Icons */}
              <div className="flex items-center gap-1 sm:gap-2">
                
                {/* Language Dropdown */}
                <div className="relative hidden xl:block">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setLangOpen(!langOpen); setCurrOpen(false); }}
                    className="flex items-center justify-center gap-1.5 h-10 px-3 rounded-full text-sm font-bold transition-all duration-300 text-white/80 hover:bg-white/10"
                  >
                    <FlagIcon country={langFlag as any} className="w-5 h-3.5 rounded-[2px] overflow-hidden" />
                    <span className="opacity-90">{lang.toUpperCase()}</span>
                    <ChevronDown className="h-3 w-3 opacity-60 ml-0.5" strokeWidth={3} />
                  </button>
                  {langOpen && (
                    <div className="absolute right-0 top-full mt-2 bg-card/95 backdrop-blur-xl border border-border/50 rounded-xl shadow-xl p-2 min-w-[150px] z-50 animate-in fade-in slide-in-from-top-2">
                      {supportedLocales.map((loc) => (
                        <button
                          key={loc}
                          onClick={() => { setLang(loc); setLangOpen(false); }}
                          className="flex items-center gap-3 w-full text-left px-3 py-2.5 text-sm font-semibold rounded-lg hover:bg-accent/10 hover:text-accent transition-colors"
                        >
                          <FlagIcon country={localeFlag(loc) as any} className="w-5 h-3.5 rounded-[2px]" />
                          {localeLabel(loc)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Currency Dropdown */}
                <div className="relative hidden xl:block">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setCurrOpen(!currOpen); setLangOpen(false); }}
                    className="flex items-center justify-center gap-1.5 h-10 px-3 rounded-full text-sm font-bold transition-all duration-300 text-white/80 hover:bg-white/10"
                  >
                    <FlagIcon country={currFlag} className="w-5 h-3.5 rounded-[2px] overflow-hidden" />
                    <span className="opacity-90">{currency}</span>
                    <ChevronDown className="h-3 w-3 opacity-60 ml-0.5" strokeWidth={3} />
                  </button>
                  {currOpen && (
                    <div className="absolute right-0 top-full mt-2 bg-card/95 backdrop-blur-xl border border-border/50 rounded-xl shadow-xl p-2 min-w-[150px] z-50 animate-in fade-in slide-in-from-top-2">
                      {([["CAD", "ca", "C$"], ["USD", "us", "$"], ["EUR", "eu", "€"]] as const).map(([code, flag, sym]) => (
                        <button
                          key={code}
                          onClick={() => { setCurrency(code as "CAD" | "USD" | "EUR"); setCurrOpen(false); }}
                          className={`flex items-center gap-3 w-full text-left px-3 py-2.5 text-sm font-semibold rounded-lg transition-colors ${currency === code ? "bg-accent/10 text-accent" : "hover:bg-accent/5 hover:text-accent"}`}
                        >
                          <FlagIcon country={flag} className="w-5 h-3.5 rounded-[2px]" />
                          {code} ({sym})
                        </button>
                      ))}
                    </div>
                  )}
                </div>


                {/* Account — always points to /login (guest) or /account (logged-in user).
                    Admins reach /admin via direct URL, not from the storefront icon. */}
                <div className="hidden sm:block">
                {isAuthenticated && user ? (
                  <Link to="/account" className="flex items-center justify-center h-10 w-10 rounded-full transition-all duration-300 text-white/80 hover:bg-white/10" title={t("nav.account")}>
                    <User className="h-[22px] w-[22px]" strokeWidth={2.5} />
                  </Link>
                ) : (
                  <Link to="/login" className="flex items-center justify-center h-10 w-10 rounded-full transition-all duration-300 text-white/80 hover:bg-white/10" title={t("nav.signin")}>
                    <User className="h-[22px] w-[22px]" strokeWidth={2.5} />
                  </Link>
                )}
                </div>

                {/* Cart */}
                <Link
                  to="/cart"
                   className="relative flex items-center justify-center h-10 w-10 rounded-full transition-all duration-300 group text-white/80 hover:bg-white/10"
                  aria-label="Cart"
                >
                  <ShoppingCart className="h-[22px] w-[22px] group-hover:scale-110 transition-transform" strokeWidth={2.5} />
                  {itemCount > 0 && (
                    <span className={`absolute -top-0.5 -right-0.5 bg-accent text-accent-foreground text-[10px] font-black rounded-full h-5 min-w-[20px] flex items-center justify-center px-1 shadow-sm border-2 border-background transition-transform ${badgeBounce ? "animate-cart-bounce" : ""}`}>
                      {itemCount}
                    </span>
                  )}
                </Link>

                {/* Mobile Menu Toggle */}
                <button
                  type="button"
                  onClick={() => setMobileOpen(!mobileOpen)}
                   className="lg:hidden flex items-center justify-center h-10 w-10 rounded-full transition-all duration-300 text-white/80 hover:bg-white/10"
                  aria-label={mobileOpen ? t("nav.menu.close") : t("nav.menu.open")}
                >
                  {mobileOpen ? <X className="h-6 w-6" strokeWidth={2.5} /> : <Menu className="h-6 w-6" strokeWidth={2.5} />}
                </button>

              </div>
            </div>
          </div>
        </div>
        
        <CategoryStrip />
      </header>

      {/* Mobile Modal Drawer */}
      <MobileMenu 
        isOpen={mobileOpen} 
        onClose={() => setMobileOpen(false)} 
        canEditHeader={canEditHeader}
        mobileOverlayTop={mobileOverlayTop}
      />
    </>
  );
}

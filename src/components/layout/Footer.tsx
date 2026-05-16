import React from "react";
import { Link } from "react-router-dom";
import { Phone, Mail, MapPin, ArrowRight } from "lucide-react";
import { useLanguage, localeLabel, localeFlag } from "@/contexts/LanguageContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { categories } from "@/config/products";
import FlagIcon from "@/components/FlagIcon";
import { usePublicSettings } from "@/hooks/useApi";

export default function Footer() {
  const { t, lang, setLang, supportedLocales } = useLanguage();
  const { currency, setCurrency } = useCurrency();
  const { data: pubRes } = usePublicSettings();
  const pub = (pubRes?.data ?? {}) as Record<string, string>;
  const storeName = pub.store_name || pub.site_name || "REMQUIP";
  const contactEmail = pub.contact_email || "info@remquip.ca";
  const contactPhone = pub.contact_phone || "(514) 359-3366";
  const storeAddress = pub.store_address || "Quebec City, QC, Canada";

  return (
    <footer className="bg-[#1f354d] text-[#9ca3af] border-t border-white/10 relative overflow-hidden font-sans">
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-50 block" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-24 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.05),transparent_70%)] pointer-events-none" />
      
      {/* Newsletter — elevated, premium look */}
      <div className="border-b border-white/10 relative z-10">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 md:py-20 lg:py-24">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-10">
            <div className="max-w-xl">
              <span className="font-display text-[#d1d5db] font-black uppercase tracking-[0.3em] text-[10px] mb-4 block">
                {t("newsletter.title")}
              </span>
              <h3 className="font-display text-2xl sm:text-3xl md:text-5xl font-black uppercase tracking-tight text-white leading-tight">
                {t("footer.newsletter_heading")}
              </h3>
            </div>
            <div className="w-full lg:w-auto relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-white/20 to-white/5 rounded-xl blur opacity-30 group-focus-within:opacity-100 transition duration-1000 group-hover:duration-200" />
              <div className="relative flex flex-col sm:flex-row items-center bg-[#253d59] border border-white/10 rounded-xl p-1.5 focus-within:border-white/30 transition-colors">
                <input
                  type="email"
                  placeholder={t("newsletter.placeholder")}
                  className="w-full sm:w-72 bg-transparent text-white px-4 py-3 sm:py-0 text-sm outline-none placeholder:text-[#6b7280] font-medium"
                />
                <button
                  type="button"
                  className="w-full sm:w-auto mt-2 sm:mt-0 px-6 py-3 rounded-lg bg-white text-[#1f354d] font-display font-black text-[11px] uppercase tracking-widest hover:bg-[#e5e7eb] transition-colors flex items-center justify-center gap-2 shrink-0"
                >
                  {t("newsletter.cta")} <ArrowRight className="h-3.5 w-3.5" strokeWidth={3} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main footer */}
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 md:py-20 relative z-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-10 md:gap-12 lg:gap-8 mb-16">
          <div className="lg:col-span-4 lg:pr-10">
            <h4 className="font-display font-black text-2xl tracking-tighter mb-6 text-white uppercase drop-shadow-md">
              {storeName}
            </h4>
            <p className="text-sm text-[#9ca3af] mb-8 leading-relaxed max-w-sm">
              {t("footer.description")}
            </p>
            <div className="space-y-4 text-sm">
              <div className="flex items-start gap-4">
                <div className="p-2 rounded-full border border-white/10 bg-white/5 shrink-0"><MapPin className="h-3.5 w-3.5 text-white" /></div>
                <span className="whitespace-pre-line text-[#d1d5db] font-medium pt-1 leading-snug">{storeAddress}</span>
              </div>
              <div className="flex items-center gap-4 group">
                <div className="p-2 rounded-full border border-white/10 bg-white/5 shrink-0 group-hover:bg-white/10 transition-colors"><Phone className="h-3.5 w-3.5 text-white" /></div>
                <a href={`tel:${contactPhone.replace(/\s/g, "")}`} className="text-[#d1d5db] hover:text-white transition-colors font-medium">
                  {contactPhone}
                </a>
              </div>
              <div className="flex items-center gap-4 group">
                <div className="p-2 rounded-full border border-white/10 bg-white/5 shrink-0 group-hover:bg-white/10 transition-colors"><Mail className="h-3.5 w-3.5 text-white" /></div>
                <a href={`mailto:${contactEmail}`} className="text-[#d1d5db] hover:text-white transition-colors font-medium">
                  {contactEmail}
                </a>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <h4 className="font-display font-black text-[10px] uppercase tracking-[0.2em] text-[#6b7280] mb-6">
              {t("footer.categories")}
            </h4>
            <ul className="space-y-3.5">
              {categories.slice(0, 4).map((cat) => (
                <li key={cat.id}>
                  <Link to={`/products/${cat.slug}`} className="text-sm font-medium text-[#d1d5db] hover:text-white hover:translate-x-1 transition-all inline-block">
                    {t(cat.translationKey)}
                  </Link>
                </li>
              ))}
              <li>
                <Link to="/products" className="text-sm font-bold text-white hover:text-white/80 hover:translate-x-1 transition-all inline-block mt-2">
                  {t("cat.shop_all")} <ArrowRight className="h-3 w-3 inline ml-1 align-baseline opacity-50" />
                </Link>
              </li>
            </ul>
          </div>

          <div className="lg:col-span-2">
            <h4 className="font-display font-black text-[10px] uppercase tracking-[0.2em] text-[#6b7280] mb-6">
              {t("footer.information")}
            </h4>
            <ul className="space-y-3.5">
              <li>
                <Link to="/about" className="text-sm font-medium text-[#d1d5db] hover:text-white hover:translate-x-1 transition-all inline-block">
                  {t("footer.about")}
                </Link>
              </li>
              <li>
                <Link to="/shipping" className="text-sm font-medium text-[#d1d5db] hover:text-white hover:translate-x-1 transition-all inline-block">
                  {t("footer.shipping")}
                </Link>
              </li>
              <li>
                <Link to="/contact" className="text-sm font-medium text-[#d1d5db] hover:text-white hover:translate-x-1 transition-all inline-block">
                  {t("footer.contact")}
                </Link>
              </li>
              <li>
                <Link to="/faq" className="text-sm font-medium text-[#d1d5db] hover:text-white hover:translate-x-1 transition-all inline-block">
                  {t("footer.faq")}
                </Link>
              </li>
            </ul>
          </div>

          <div className="lg:col-span-2">
            <h4 className="font-display font-black text-[10px] uppercase tracking-[0.2em] text-[#6b7280] mb-6">
              {t("footer.legal")}
            </h4>
            <ul className="space-y-3.5">
              <li>
                <Link to="/terms" className="text-sm font-medium text-[#d1d5db] hover:text-white hover:translate-x-1 transition-all inline-block">
                  {t("footer.terms")}
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="text-sm font-medium text-[#d1d5db] hover:text-white hover:translate-x-1 transition-all inline-block">
                  {t("footer.privacy")}
                </Link>
              </li>
              <li>
                <Link to="/refund" className="text-sm font-medium text-[#d1d5db] hover:text-white hover:translate-x-1 transition-all inline-block">
                  {t("footer.refund")}
                </Link>
              </li>
              <li>
                <Link to="/cookie" className="text-sm font-medium text-[#d1d5db] hover:text-white hover:translate-x-1 transition-all inline-block">
                  {t("footer.cookie")}
                </Link>
              </li>
              <li>
                <Link to="/eula" className="text-sm font-medium text-[#d1d5db] hover:text-white hover:translate-x-1 transition-all inline-block">
                  {t("footer.eula")}
                </Link>
              </li>
            </ul>
          </div>

          <div className="lg:col-span-2 border-t sm:border-t-0 border-white/10 pt-8 sm:pt-0">
            <h4 className="font-display font-black text-[10px] uppercase tracking-[0.2em] text-[#6b7280] mb-5">{t("language")}</h4>
            <div className="flex flex-wrap gap-2 mb-8">
              {supportedLocales.map((loc) => (
                <button
                  key={loc}
                  type="button"
                  onClick={() => setLang(loc)}
                  className={`flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider px-3 py-2 rounded-lg transition-all border ${
                    lang === loc
                      ? "bg-white text-[#1f354d] border-white shadow-sm"
                      : "text-[#9ca3af] hover:text-white border-white/10 hover:bg-white/5 hover:border-white/20 bg-transparent"
                  }`}
                >
                  <FlagIcon country={localeFlag(loc)} className="w-[18px] min-w-[18px] aspect-[4/3] rounded-[2px] overflow-hidden" /> {localeLabel(loc)}
                </button>
              ))}
            </div>

            <h4 className="font-display font-black text-[10px] uppercase tracking-[0.2em] text-[#6b7280] mb-5">{t("currency")}</h4>
            <div className="flex flex-wrap gap-2 mb-8">
              {(
                [
                  ["CAD", "ca"],
                  ["USD", "us"],
                  ["EUR", "eu"],
                ] as const
              ).map(([code, flag]) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setCurrency(code as "CAD" | "USD" | "EUR")}
                  className={`flex items-center gap-2 text-[11px] font-bold tracking-wider px-3 py-2 rounded-lg transition-all border ${
                    currency === code
                      ? "bg-white text-[#1f354d] border-white shadow-sm"
                      : "text-[#9ca3af] hover:text-white border-white/10 hover:bg-white/5 hover:border-white/20 bg-transparent"
                  }`}
                >
                  <FlagIcon country={flag} className="w-[18px] min-w-[18px] aspect-[4/3] rounded-[2px] overflow-hidden" /> {code}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-white/5 bg-[#1a2e43] text-[#6b7280]">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-[11px] font-display font-bold uppercase tracking-widest pl-2">
            © {new Date().getFullYear()} {storeName}.
          </p>
          <div className="flex items-center gap-4 text-[10px] font-display uppercase tracking-widest opacity-60">
             <span>Developed by <a href="https://www.ihebchebbi.pro/" target="_blank" rel="noopener noreferrer" className="font-black text-white/80 hover:text-white transition-colors">Iheb Chebbi</a></span>
          </div>
        </div>
      </div>
    </footer>
  );
}

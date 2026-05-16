import React from "react";
import { Link, useLocation } from "react-router-dom";
import { User, Pencil } from "lucide-react";
import { useLanguage, localeLabel, localeFlag } from "@/contexts/LanguageContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useAuth } from "@/contexts/AuthContext";
import { categories } from "@/config/products";
import FlagIcon from "@/components/FlagIcon";
import { ADMIN_NO_AUTH } from "@/config/constants";
import { HeaderSearch } from "./HeaderSearch";

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  canEditHeader: boolean;
  mobileOverlayTop: string;
}

export function MobileMenu({ isOpen, onClose, canEditHeader, mobileOverlayTop }: MobileMenuProps) {
  const { t, lang, setLang, supportedLocales } = useLanguage();
  const { currency, setCurrency } = useCurrency();
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isOpen) return null;

  return (
    <div className={`lg:hidden fixed inset-0 z-40 bg-background/95 backdrop-blur-xl overflow-y-auto animate-in slide-in-from-top-4 fade-in-0 duration-300 ${mobileOverlayTop}`}>
      <div className="px-5 py-6 space-y-6">
        {canEditHeader && (
          <Link
            to="/admin/landing#section-site_header"
            onClick={onClose}
            className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg border border-accent/20 bg-accent/10 text-sm font-bold text-accent shadow-sm hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <Pencil className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden />
            {t("header.edit")}
          </Link>
        )}
        
        {/* Mobile search */}
        <div>
          <HeaderSearch isMobile onMobileClose={onClose} />
        </div>

        {/* Main links */}
        <nav className="space-y-1 bg-card/60 rounded-2xl border border-border/50 p-2 shadow-sm backdrop-blur-sm">
          <Link to="/products" onClick={onClose} className="block py-3 px-4 text-sm font-bold text-foreground hover:bg-accent/10 hover:text-accent rounded-xl transition-colors">
            {t("nav.products")}
          </Link>
          <Link to="/about" onClick={onClose} className="block py-3 px-4 text-sm font-bold text-foreground hover:bg-accent/10 hover:text-accent rounded-xl transition-colors">
            {t("nav.about")}
          </Link>
          <Link to="/contact" onClick={onClose} className="block py-3 px-4 text-sm font-bold text-foreground hover:bg-accent/10 hover:text-accent rounded-xl transition-colors">
            {t("nav.contact")}
          </Link>
        </nav>

        {/* Categories */}
        <nav className="space-y-1 bg-card/60 rounded-2xl border border-border/50 p-2 shadow-sm backdrop-blur-sm">
          <p className="px-4 pt-2 pb-1 text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-bold">{t("footer.categories")}</p>
          {categories.map((cat) => (
            <Link
              key={cat.id}
              to={`/products/${cat.slug}`}
              onClick={onClose}
              className={`block py-3 px-4 text-sm font-semibold rounded-xl transition-colors ${
                location.pathname === `/products/${cat.slug}` ? "bg-accent text-accent-foreground" : "text-foreground hover:bg-secondary"
              }`}
            >
              {t(cat.translationKey)}
            </Link>
          ))}
          <Link to="/products" onClick={onClose} className="block py-3 px-4 text-sm font-semibold text-foreground hover:bg-secondary rounded-xl">
            {t("cat.shop_all")}
          </Link>
        </nav>

        {/* Account & Setup */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card/60 rounded-2xl border border-border/50 p-2 shadow-sm flex flex-col justify-center backdrop-blur-sm">
            {isAuthenticated && user ? (
              <Link to="/account" onClick={onClose} className="flex flex-col items-center justify-center gap-2 py-4 px-2 text-sm font-bold text-foreground hover:text-accent rounded-xl transition-colors group">
                <div className="p-2 rounded-full bg-secondary group-hover:bg-accent/10 transition-colors">
                  <User className="h-5 w-5" strokeWidth={2} />
                </div>
                <span>{t("nav.account")}</span>
              </Link>
            ) : (
              <Link to="/login" onClick={onClose} className="flex flex-col items-center justify-center gap-2 py-4 px-2 text-sm font-bold text-foreground hover:text-accent rounded-xl transition-colors group">
                <div className="p-2 rounded-full bg-secondary group-hover:bg-accent/10 transition-colors">
                  <User className="h-5 w-5" strokeWidth={2} />
                </div>
                <span>{t("nav.signin")}</span>
              </Link>
            )}
          </div>
          
          <div className="bg-card/60 rounded-2xl border border-border/50 p-3 shadow-sm space-y-4 backdrop-blur-sm">
            {/* Language */}
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-bold mb-1.5">{t("language")}</p>
              <div className="flex flex-wrap gap-1.5">
                {supportedLocales.map((loc) => (
                  <button
                    key={loc}
                    onClick={() => setLang(loc)}
                    className={`flex items-center justify-center gap-1.5 text-xs font-semibold px-2 py-1.5 rounded-lg border shadow-sm transition-colors flex-1 ${
                      lang === loc ? "bg-accent border-accent text-accent-foreground" : "bg-background border-border text-foreground hover:border-accent/50"
                    }`}
                  >
                    <FlagIcon country={localeFlag(loc)} className="w-4 h-3 rounded-[1px] overflow-hidden" /> {localeLabel(loc)}
                  </button>
                ))}
              </div>
            </div>

            {/* Currency */}
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-bold mb-1.5">{t("currency")}</p>
              <div className="flex flex-wrap gap-1.5">
                {([["CAD", "ca"], ["USD", "us"], ["EUR", "eu"]] as const).map(([code, flag]) => (
                  <button
                    key={code}
                    onClick={() => setCurrency(code as "CAD" | "USD" | "EUR")}
                    className={`flex items-center justify-center gap-1.5 text-xs font-semibold px-2 py-1.5 rounded-lg border shadow-sm transition-colors flex-1 ${
                      currency === code ? "bg-accent border-accent text-accent-foreground" : "bg-background border-border text-foreground hover:border-accent/50"
                    }`}
                  >
                    <FlagIcon country={flag} className="w-4 h-3 rounded-[1px] overflow-hidden" /> {code}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

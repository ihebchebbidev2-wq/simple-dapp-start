import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { categories } from "@/config/products";

export function CategoryStrip() {
  const { t } = useLanguage();
  const location = useLocation();
  const path = location.pathname;

  return (
    <nav className="hidden lg:block bg-[#48698e] border-b border-white/10 shadow-lg relative z-30 transition-colors" aria-label={t("footer.categories")}>
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-start gap-2 overflow-x-auto py-0 scrollbar-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {categories.map((cat) => {
            const catPath = `/products/${cat.slug}`;
            const catActive = path === catPath;
            return (
              <Link
                key={cat.id}
                to={catPath}
                className={`group relative flex-shrink-0 whitespace-nowrap px-4 py-3.5 text-[11px] font-bold uppercase tracking-[0.16em] transition-all duration-300
                  ${catActive ? "text-accent" : "text-white/70 hover:text-white"}
                `}
              >
                {t(cat.translationKey)}
                {/* Animated underline */}
                <span className={`absolute bottom-0 left-0 w-full h-[2px] bg-accent transform origin-left transition-transform duration-300 ${catActive ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"}`} />
              </Link>
            );
          })}
          <Link
            to="/products"
            className={`group relative flex-shrink-0 whitespace-nowrap px-4 py-3.5 text-[11px] font-bold uppercase tracking-[0.16em] transition-all duration-300
              ${path === "/products" ? "text-accent" : "text-white/70 hover:text-white"}
            `}
          >
            {t("cat.shop_all")}
            <span className={`absolute bottom-0 left-0 w-full h-[2px] bg-accent transform origin-left transition-transform duration-300 ${path === "/products" ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"}`} />
          </Link>
        </div>
      </div>
    </nav>
  );
}

import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Cookie, X, ArrowRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { motion, AnimatePresence } from "framer-motion";

export function CookieConsent() {
  const { t } = useLanguage();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("remquip_cookie_consent");
    if (!consent) {
      const timer = setTimeout(() => setIsVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem("remquip_cookie_consent", "all");
    setIsVisible(false);
  };

  const handleDecline = () => {
    localStorage.setItem("remquip_cookie_consent", "technical");
    setIsVisible(false);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ duration: 0.5, ease: "circOut" }}
          className="fixed bottom-0 left-0 right-0 z-[200] p-4 md:p-6 lg:p-8 pointer-events-none"
        >
          <div className="max-w-4xl mx-auto bg-card/85 backdrop-blur-2xl border border-white/10 rounded-2xl md:rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] p-5 md:p-8 pointer-events-auto relative overflow-hidden group">
            {/* Background design element */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl group-hover:bg-accent/10 transition-colors" />
            
            <div className="flex flex-col md:flex-row items-start md:items-center gap-6 relative z-10">
              <div className="hidden sm:flex shrink-0 w-14 h-14 rounded-2xl bg-accent/10 items-center justify-center text-accent shadow-sm border border-accent/20">
                <Cookie className="h-7 w-7" strokeWidth={2.5} />
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="font-display font-black uppercase tracking-widest text-xs mb-2 text-accent">
                  {t("cookie.banner.title")}
                </h3>
                <p className="text-sm md:text-[15px] font-medium text-muted-foreground leading-relaxed">
                  {t("cookie.banner.description")}
                  <Link to="/cookie" className="text-foreground hover:text-accent font-bold inline-flex items-center gap-1 ml-1 group/link transition-colors">
                    {t("cookie.banner.policy")}
                    <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto shrink-0 mt-4 md:mt-0">
                <button
                  type="button"
                  onClick={handleDecline}
                  className="flex-1 md:flex-none px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all border border-transparent hover:border-border/50"
                >
                  {t("cookie.banner.decline")}
                </button>
                <button
                  type="button"
                  onClick={handleAccept}
                  className="flex-1 md:flex-none px-8 py-3.5 rounded-xl text-xs font-black uppercase tracking-widest bg-foreground text-background hover:bg-accent hover:text-accent-foreground shadow-lg shadow-black/10 transition-all active:scale-[0.98]"
                >
                  {t("cookie.banner.accept")}
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsVisible(false)}
                className="absolute top-2 right-2 md:relative md:top-0 md:right-0 p-2 text-muted-foreground/40 hover:text-foreground transition-colors group/x"
                aria-label={t("close")}
              >
                <X className="h-5 w-5 group-hover:rotate-90 transition-transform duration-300" strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

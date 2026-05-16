import React, { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import Header from "@/components/layout/Header";

export default function PaymentCancelPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return (
    <div className="bg-background min-h-screen text-foreground font-sans flex flex-col">
      <Header />
      
      <main className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="max-w-2xl w-full mx-auto bg-card border border-border rounded-3xl p-8 md:p-12 text-center relative overflow-hidden shadow-2xl animate-in zoom-in-95 duration-700">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-red-500/5 blur-[100px] rounded-full pointer-events-none" />
          
          <div className="mx-auto w-24 h-24 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center mb-8">
            <AlertCircle className="w-12 h-12 text-red-500" />
          </div>

          <h1 className="font-display font-black text-4xl md:text-5xl uppercase tracking-tighter mb-4 text-red-500">
            {t('payment.cancel.title')}
          </h1>
          
          <p className="text-muted-foreground text-lg mb-8 max-w-lg mx-auto">
            {t('payment.cancel.description')}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link 
              to="/checkout" 
              className="w-full sm:w-auto bg-foreground text-background px-8 py-4 rounded-xl font-display font-black text-[11px] uppercase tracking-widest hover:bg-accent transition-colors flex items-center justify-center gap-3"
            >
              {t('payment.cancel.try_again')} <ArrowLeft className="w-4 h-4 rotate-180" />
            </Link>
            
            <Link 
              to="/cart" 
              className="w-full sm:w-auto bg-transparent border-2 border-border text-foreground px-8 py-4 rounded-xl font-display font-black text-[11px] uppercase tracking-widest hover:border-foreground transition-colors flex items-center justify-center gap-3"
            >
              <ArrowLeft className="w-4 h-4" /> {t('payment.cancel.return_cart')}
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { CheckCircle2, Package, ArrowRight, Loader2 } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { api } from "@/lib/api";
import Header from "@/components/layout/Header";

export default function PaymentSuccessPage() {
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { clearCart } = useCart();
  
  const sessionId = searchParams.get("session_id");
  const orderId = searchParams.get("order_id");
  const orderNum = searchParams.get("order_num") || orderId || "pending";

  const [verifying, setVerifying] = useState(true);
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    
    if (!sessionId) {
      navigate("/");
      return;
    }

    // Verify payment with the backend
    let attempts = 0;
    const maxAttempts = 6;

    const verify = async () => {
      try {
        const res = await api.request('GET', `stripe/verify-session?session_id=${sessionId}`);
        const data = res?.data || res;
        if (data?.payment_status === 'paid') {
          setVerified(true);
          setVerifying(false);
          clearCart();
          return;
        }
      } catch {
        // ignore, retry
      }

      attempts++;
      if (attempts < maxAttempts) {
        // Webhook may not have fired yet, retry after a delay
        setTimeout(verify, 2000);
      } else {
        // After retries, assume success (Stripe redirected here) and clear cart
        setVerified(true);
        setVerifying(false);
        clearCart();
      }
    };

    verify();
  }, [sessionId, clearCart, navigate]);

  if (!sessionId) return null;

  if (verifying) {
    return (
      <div className="bg-background min-h-screen text-foreground font-sans flex flex-col">
        <Header />
        <main className="flex-1 flex flex-col items-center justify-center p-4">
          <div className="text-center">
            <Loader2 className="w-12 h-12 text-accent animate-spin mx-auto mb-4" />
            <h2 className="font-display font-black text-2xl uppercase tracking-tighter mb-2">Verifying Payment...</h2>
            <p className="text-muted-foreground">Please wait while we confirm your payment.</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="bg-background min-h-screen text-foreground font-sans flex flex-col">
      <Header />
      
      <main className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="max-w-2xl w-full mx-auto bg-card border border-border rounded-3xl p-8 md:p-12 text-center relative overflow-hidden shadow-2xl animate-in zoom-in-95 duration-700">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-accent/10 blur-[100px] rounded-full pointer-events-none" />
          
          <div className="mx-auto w-24 h-24 bg-green-500/10 border border-green-500/20 rounded-full flex items-center justify-center mb-8 relative">
            <div className="absolute inset-0 border border-green-500/30 rounded-full animate-ping opacity-20" />
            <CheckCircle2 className="w-12 h-12 text-green-500" />
          </div>

          <h1 className="font-display font-black text-4xl md:text-5xl uppercase tracking-tighter mb-4 text-green-500">
            {t('payment.success.title')}
          </h1>
          
          <p className="text-muted-foreground text-lg mb-8 max-w-lg mx-auto">
            {t('payment.success.description')}
          </p>

          <div className="bg-background/80 backdrop-blur border border-border rounded-2xl p-6 mb-10 max-w-sm mx-auto flex items-center gap-4 justify-center">
            <Package className="w-6 h-6 text-accent" />
            <div className="text-left">
              <div className="text-[10px] font-display font-black uppercase tracking-widest text-muted-foreground mb-1">{t('payment.success.order_ref')}</div>
              <div className="font-mono font-medium text-foreground tracking-wider">{orderNum.toUpperCase()}</div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link 
              to="/dashboard"
              className="w-full sm:w-auto bg-foreground text-background px-8 py-4 rounded-xl font-display font-black text-[11px] uppercase tracking-widest hover:bg-accent transition-colors flex items-center justify-center gap-3"
            >
              {t('payment.success.track_order')} <ArrowRight className="w-4 h-4" />
            </Link>
            
            <Link 
              to="/products" 
              className="w-full sm:w-auto bg-transparent border-2 border-border text-foreground px-8 py-4 rounded-xl font-display font-black text-[11px] uppercase tracking-widest hover:border-foreground transition-colors"
            >
              {t('payment.success.continue_shopping')}
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

import React, { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { ShieldCheck, ArrowRight, Package, Truck, Calendar } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export default function OrderConfirmedPage() {
  const { t } = useLanguage();
  const location = useLocation();
  const { orderNumber } = (location.state as { orderId?: string; orderNumber?: string }) || {};

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const displayOrderId = orderNumber || "—";

  return (
    <div className="bg-background min-h-[90vh] py-20 px-4 flex items-center justify-center">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,hsl(var(--accent)/0.03),transparent_40%)] pointer-events-none" />
      
      <div className="container max-w-2xl mx-auto text-center relative z-10">
        <div className="flex justify-center mb-10">
            <div className="w-24 h-24 rounded-[3rem] bg-accent/10 border-4 border-accent flex items-center justify-center shadow-[0_0_50px_rgba(var(--accent-rgb),0.2)] animate-in zoom-in-50 duration-500">
                <ShieldCheck className="h-10 w-10 text-accent" strokeWidth={3} />
            </div>
        </div>

        <div className="flex items-center justify-center gap-3 mb-6">
            <div className="h-px w-6 bg-accent/40" />
            <span className="font-display font-black uppercase tracking-[0.3em] text-[10px] text-accent"> Transmission Successful </span>
            <div className="h-px w-6 bg-accent/40" />
        </div>

        <h1 className="font-display text-4xl sm:text-6xl font-black uppercase tracking-tighter text-foreground mb-6 leading-none">
            {t("order.confirmed")}
        </h1>
        <p className="text-muted-foreground text-lg sm:text-xl font-medium mb-12 max-w-md mx-auto leading-relaxed">
            {t("order.thank_you")} Your procurement manifest has been authorized and dispatched to the fulfillment queue.
        </p>

        {/* Order Details Card */}
        <div className="bg-card border border-border/60 rounded-[2.5rem] p-8 sm:p-10 mb-12 shadow-2xl overflow-hidden relative group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 blur-3xl group-hover:opacity-100 transition-opacity" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 text-left relative z-10">
                <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Manifest Routing</p>
                    <div className="flex items-center gap-3">
                        <Package className="h-5 w-5 text-accent" />
                        <p className="font-display font-black text-lg uppercase tracking-tight">{displayOrderId}</p>
                    </div>
                </div>
                <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Fulfillment Status</p>
                    <div className="flex items-center gap-3">
                        <Truck className="h-5 w-5 text-accent" />
                        <p className="font-display font-black text-lg uppercase tracking-tight">QUEUED FOR DISPATCH</p>
                    </div>
                </div>
            </div>
            
            <div className="mt-8 pt-8 border-t border-border flex items-center gap-4 text-xs font-medium text-muted-foreground relative z-10">
                <Calendar className="h-4 w-4" />
                <span>Estimated Clearance: <span className="text-foreground font-black">24-48 HOURS</span></span>
            </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-6 justify-center">
            <Link to="/products" className="group bg-foreground text-background px-10 py-5 rounded-2xl font-display font-black uppercase tracking-widest text-xs hover:bg-accent hover:shadow-xl transition-all flex items-center justify-center gap-3">
                {t("cart.continue")}
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link to="/dashboard" className="px-10 py-5 rounded-2xl border-2 border-border font-display font-black uppercase tracking-widest text-xs hover:bg-muted transition-all">
                Track Manifest
            </Link>
        </div>
      </div>
    </div>
  );
}

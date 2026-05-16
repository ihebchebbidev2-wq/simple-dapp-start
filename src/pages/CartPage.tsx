import React, { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Minus, Plus, Trash2, ArrowRight, Package, Lock, ShieldCheck, XCircle } from "lucide-react";
// Auth not needed here — checkout route handles login requirement
import { useLanguage } from "@/contexts/LanguageContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useCart } from "@/contexts/CartContext";
import { useConfirm } from "@/components/ConfirmDialog";
import { PriceDisplay } from "@/components/PriceDisplay";
import { productDetailHref } from "@/lib/storefront-product";

export default function CartPage() {
  const { t } = useLanguage();
  const { formatPrice } = useCurrency();
  const { items, removeItem, updateQuantity, clearCart, subtotal, tax, shipping, total, freeShippingThreshold, taxLines } = useCart();
  const confirm = useConfirm();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleClearCart = async () => {
    const ok = await confirm({
      title: t("cart.clear_confirm_title"),
      message: t("cart.clear_confirm_message"),
      confirmLabel: t("cart.clear_all"),
      variant: "danger",
    });
    if (ok) clearCart();
  };

  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-24 md:py-32 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-24 h-24 bg-card rounded-full flex items-center justify-center shadow-sm border border-border mb-8 relative">
          <div className="absolute inset-0 rounded-full border border-border/50 animate-ping opacity-20" />
          <Package className="h-10 w-10 text-muted-foreground/30" />
        </div>
        <h1 className="font-display text-4xl md:text-5xl font-black uppercase text-foreground mb-4 tracking-tight">
          {t("cart.title")}
        </h1>
        <p className="text-muted-foreground text-lg mb-10 font-medium max-w-sm">
          {t("cart.empty") || "Your parts queue is currently empty. Browse our catalog to initiate an order."}
        </p>
        <Link to="/products" className="bg-foreground text-background px-8 py-4 rounded-xl font-display font-black uppercase tracking-widest text-sm hover:bg-accent transition-all shadow-xl active:scale-95 flex items-center gap-3">
          {t("cart.continue")} <ArrowRight className="h-4 w-4" strokeWidth={3} />
        </Link>
      </div>
    );
  }

  const amountToFreeShipping = Math.max(0, freeShippingThreshold - subtotal);
  const percentToFreeShipping = Math.min(100, Math.round((subtotal / freeShippingThreshold) * 100));

  return (
    <div className="bg-background min-h-screen pb-24">
      {/* Premium Header */}
      <div className="bg-muted/30 border-b border-border/60">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 md:py-16 relative overflow-hidden">
          <div className="absolute top-0 right-1/4 w-[600px] h-[600px] bg-[radial-gradient(circle_at_50%_0%,hsl(var(--accent)/0.05),transparent_60%)] pointer-events-none -translate-y-1/2" />
          <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-black uppercase text-foreground tracking-tight drop-shadow-sm relative z-10">
            {t("cart.title")}
          </h1>
          <div className="flex items-center gap-4 mt-3 relative z-10">
            <p className="text-muted-foreground font-display font-bold uppercase tracking-widest text-xs">
              {items.length} {items.length === 1 ? "Item" : "Items"} in queue
            </p>
            <button
              onClick={handleClearCart}
              className="inline-flex items-center gap-1.5 text-destructive hover:text-destructive/80 font-display font-bold uppercase tracking-widest text-[10px] transition-colors"
            >
              <XCircle className="h-3.5 w-3.5" strokeWidth={2.5} />
              {t("cart.clear_all")}
            </button>
          </div>
        </div>
      </div>

      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 md:py-16">
        <div className="grid lg:grid-cols-12 gap-10 md:gap-14">
          
          {/* Cart Items List */}
          <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-6">
            
            {/* Free Shipping Progress */}
            <PriceDisplay>
              {amountToFreeShipping > 0 ? (
                <div className="bg-card border border-border/60 rounded-2xl p-5 mb-2 shadow-sm">
                  <p className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    Add <span className="font-bold text-accent">{formatPrice(amountToFreeShipping)}</span> for free delivery
                  </p>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-accent transition-all duration-1000 ease-out rounded-full" style={{ width: `${percentToFreeShipping}%` }} />
                  </div>
                </div>
              ) : (
                <div className="bg-success/10 border border-success/20 rounded-2xl p-4 mb-2 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-success/20 flex items-center justify-center shrink-0">
                    <ShieldCheck className="h-4 w-4 text-success" />
                  </div>
                  <p className="text-sm font-bold text-success uppercase tracking-wide">
                    Your order qualifies for complimentary shipping
                  </p>
                </div>
              )}
            </PriceDisplay>

            {/* Iterating Cart Rows */}
            <div className="space-y-4">
              {items.map(({ product, quantity }) => (
                <div key={product.id} className="group flex flex-col sm:flex-row gap-5 border border-border/60 rounded-2xl p-4 sm:p-5 bg-card shadow-sm hover:shadow-md hover:border-border/80 transition-all">
                  
                  <Link to={productDetailHref(product.id, product.slug)} className="w-[100px] h-[100px] sm:w-[120px] sm:h-[120px] rounded-xl overflow-hidden bg-muted/20 border border-border/50 shrink-0 relative block">
                    {product.image ? (
                      <img src={product.image} alt={product.name} className="w-full h-full object-cover mix-blend-multiply dark:mix-blend-normal group-hover:scale-110 transition-transform duration-700 ease-out" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground/30"><Package className="h-8 w-8" /></div>
                    )}
                  </Link>
                  
                  <div className="flex flex-col flex-1 min-w-0 py-1">
                    <div className="flex justify-between items-start gap-4 mb-1">
                      <div>
                        {/* SKU hidden from storefront */}
                        <Link to={productDetailHref(product.id, product.slug)} className="text-sm sm:text-base font-semibold text-foreground hover:text-accent transition-colors line-clamp-2 leading-snug font-display">
                          {product.name}
                        </Link>
                      </div>
                      <button onClick={() => removeItem(product.id)} className="text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 p-2 rounded-lg transition-colors shrink-0" aria-label={t("cart.remove")}>
                        <Trash2 className="h-4 w-4" strokeWidth={2.5} />
                      </button>
                    </div>

                    <div className="mt-auto pt-4 flex items-end justify-between">
                      <div className="flex items-center border border-border/80 bg-background rounded-lg shadow-sm h-10 overflow-hidden">
                        <button onClick={() => updateQuantity(product.id, quantity - 1)} className="w-10 h-full flex items-center justify-center hover:bg-muted/50 text-foreground transition-colors"><Minus className="h-3.5 w-3.5" strokeWidth={2.5} /></button>
                        <span className="w-10 h-full flex items-center justify-center font-display font-bold text-sm bg-muted/10 border-x border-border/50">{quantity}</span>
                        <button onClick={() => updateQuantity(product.id, quantity + 1)} className="w-10 h-full flex items-center justify-center hover:bg-muted/50 text-foreground transition-colors"><Plus className="h-3.5 w-3.5" strokeWidth={2.5} /></button>
                      </div>
                      <PriceDisplay>
                        <div className="text-right">
                          <p className="text-lg sm:text-xl font-display font-black text-foreground drop-shadow-sm">{formatPrice(product.salePrice * quantity)}</p>
                          {product.discountPercent > 0 && (
                            <p className="text-xs text-muted-foreground line-through opacity-60">{formatPrice(product.price * quantity)}</p>
                          )}
                        </div>
                      </PriceDisplay>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-6 hidden lg:block">
              <Link to="/products" className="inline-flex items-center gap-2 text-xs font-display font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors p-2 -ml-2">
                 <ArrowRight className="h-4 w-4 rotate-180" strokeWidth={2.5} /> {t("cart.continue")}
              </Link>
            </div>
          </div>

          {/* Checkout Summary Panel */}
          <div className="lg:col-span-5 xl:col-span-4 relative">
            <div className="bg-card border-x border-t border-border/60 rounded-t-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden z-10 sticky top-28">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[radial-gradient(circle_at_100%_0%,hsl(var(--accent)/0.1),transparent_70%)] pointer-events-none" />
              
              <h3 className="font-display font-black text-xl uppercase tracking-tight text-foreground mb-6 pb-6 border-b border-border/40">
                {t("checkout.order_summary")}
              </h3>
              
              <PriceDisplay>
                <div className="space-y-4 mb-6">
                  <div className="flex justify-between items-center text-sm font-medium">
                    <span className="text-muted-foreground">{t("cart.subtotal")}</span>
                    <span className="text-foreground">{formatPrice(subtotal)}</span>
                  </div>
                  {taxLines.length > 0 ? (
                    taxLines.map((tl, i) => (
                      <div key={i} className="flex justify-between items-center text-sm font-medium">
                        <span className="text-muted-foreground">{tl.label_en} ({tl.rate}%)</span>
                        <span className="text-foreground">{formatPrice(tl.amount)}</span>
                      </div>
                    ))
                  ) : (
                    <div className="flex justify-between items-center text-sm font-medium">
                      <span className="text-muted-foreground">{t("cart.tax")}</span>
                      <span className="text-foreground">{formatPrice(tax)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-sm font-medium">
                    <span className="text-muted-foreground">{t("cart.shipping")}</span>
                    <span className="text-foreground">
                      {shipping === 0 ? <span className="text-success font-bold uppercase tracking-wider text-[11px] bg-success/10 px-2 py-1 rounded">Complimentary</span> : formatPrice(shipping)}
                    </span>
                  </div>
                </div>

                <div className="bg-background rounded-xl p-4 mb-8 border border-border/50 flex justify-between items-center">
                  <span className="font-display font-bold text-sm uppercase tracking-widest text-foreground">{t("cart.total")}</span>
                  <span className="font-display font-black text-2xl tracking-tight text-foreground">{formatPrice(total)}</span>
                </div>
              </PriceDisplay>

              <Link to="/checkout" className="group w-full bg-foreground text-background text-center py-4 rounded-xl font-display font-black text-sm uppercase tracking-widest hover:bg-accent transition-all shadow-xl active:scale-95 flex items-center justify-center gap-3">
                <Lock className="h-4 w-4" strokeWidth={2.5} /> {t("cart.checkout")}
              </Link>

              <div className="mt-6 flex items-center justify-center gap-2 text-[10px] font-display font-bold text-muted-foreground uppercase tracking-widest text-center">
                <ShieldCheck className="h-3 w-3" strokeWidth={2.5} /> Secure Encrypted Checkout
              </div>
            </div>
            
            {/* Visual bottom heavy anchor for the checkout card */}
            <div className="bg-muted border border-border/60 border-t-0 rounded-b-3xl h-6 lg:sticky lg:top-[calc(7rem+100%)] shadow-sm" />
          </div>
        </div>
      </div>
    </div>
  );
}

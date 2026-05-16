import React, { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Minus, Plus, ShoppingCart, CheckCircle, ChevronRight, ChevronLeft,
  ZoomIn, X, Truck, Shield, FileText, Package,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { useProduct, useProducts } from "@/hooks/useApi";
import { unwrapApiList, type Product } from "@/lib/api";
import { apiProductToStorefront, productDetailHref, type StorefrontProduct } from "@/lib/storefront-product";
import { RemquipPageBlockLoader } from "@/components/RemquipLoadingScreen";
import { PriceDisplay, AuthGatedCartButton } from "@/components/PriceDisplay";

export default function ProductDetailPage() {
  const { slug: routeParam } = useParams<{ slug: string }>();
  const param = routeParam ?? "";
  const { t } = useLanguage();
  const { formatPrice } = useCurrency();
  const { addItem, freeShippingThreshold } = useCart();
  const { priceAugmentationPercent, productAugmentations } = useAuth();
  const [qty, setQty] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [zoomPos, setZoomPos] = useState({ x: 50, y: 50 });
  const [isZooming, setIsZooming] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);

  const { data: productResponse, isLoading, isError } = useProduct(param);
  const { data: productsResponse } = useProducts(1, 100);

  const raw = productResponse?.data as unknown as Record<string, unknown> | undefined;
  const product = useMemo(() => (raw ? apiProductToStorefront(raw, priceAugmentationPercent, productAugmentations) : null), [raw, priceAugmentationPercent, productAugmentations]);

  const listRows = unwrapApiList<Product>(productsResponse, []);

  const relatedProducts = useMemo(() => {
    if (!product?.category_id) return [] as StorefrontProduct[];
    return listRows
      .filter((row) => {
        const id = String((row as unknown as Record<string, unknown>).id ?? "");
        const cid = String((row as unknown as Record<string, unknown>).category_id ?? "");
        return cid === product.category_id && id !== product.id;
      })
      .slice(0, 4)
      .map((row) => apiProductToStorefront(row as unknown as Record<string, unknown>, priceAugmentationPercent, productAugmentations));
  }, [listRows, product, priceAugmentationPercent, productAugmentations]);

  const images = useMemo(() => {
    if (!product) return [];
    return product.images.length > 0
      ? product.images
      : product.image
        ? [{ id: "default", url: product.image, alt: product.name, position: 0 }]
        : [];
  }, [product]);

  useEffect(() => {
    setActiveImage(0);
    setQty(1);
    setLightbox(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [param, product?.id]);

  useEffect(() => {
    setActiveImage((i) => {
      if (images.length === 0) return 0;
      return Math.min(i, images.length - 1);
    });
    if (images.length === 0) setLightbox(false);
  }, [images.length]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setZoomPos({ x, y });
  }, []);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 min-h-[70vh] flex items-center justify-center">
        <RemquipPageBlockLoader message={t("products.loading")} />
      </div>
    );
  }

  if (isError || !product) {
    return (
      <div className="container mx-auto px-4 min-h-[70vh] flex flex-col items-center justify-center text-center">
        <div className="h-24 w-24 bg-card rounded-full flex items-center justify-center shadow-sm border border-border/50 mb-6">
          <Package className="h-10 w-10 text-muted-foreground/30" />
        </div>
        <h2 className="font-display text-2xl font-black uppercase text-foreground mb-4">{t("products.not_found")}</h2>
        <Link to="/products" className="text-accent font-bold uppercase tracking-widest hover:underline text-sm flex items-center gap-2">
          Return to catalog
        </Link>
      </div>
    );
  }

  const stockLabel =
    product.stock > 20 ? t("products.in_stock") : product.stock > 0 ? t("products.low_stock") : t("products.out_of_stock");
  const stockClass =
    product.stock > 20 ? "text-success bg-success/10" : product.stock > 0 ? "text-warning bg-warning/10" : "text-destructive bg-destructive/10";

  const specEntries = Object.entries(product.specifications);

  function prevImage() {
    setActiveImage((i) => (i === 0 ? images.length - 1 : i - 1));
  }
  function nextImage() {
    setActiveImage((i) => (i === images.length - 1 ? 0 : i + 1));
  }

  const categoryLinkSlug = product.categorySlug || "all";

  return (
    <div className="bg-background min-h-screen">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 md:py-12 pb-32 md:pb-16 relative">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[radial-gradient(circle_at_100%_0%,hsl(var(--accent)/0.05),transparent_60%)] pointer-events-none" />

        <nav className="flex flex-wrap items-center text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-8 md:mb-12 gap-2 relative z-10" aria-label="Breadcrumb">
          <Link to="/" className="hover:text-foreground transition-colors whitespace-nowrap">
            {t("nav.home")}
          </Link>
          <ChevronRight className="h-3 w-3 flex-shrink-0 opacity-50" />
          <Link
            to={product.categorySlug ? `/products/${product.categorySlug}` : "/products"}
            className="hover:text-foreground transition-colors whitespace-nowrap"
          >
            {product.category || categoryLinkSlug}
          </Link>
          <ChevronRight className="h-3 w-3 flex-shrink-0 opacity-50" />
          <span className="text-foreground truncate drop-shadow-sm">{product.name}</span>
        </nav>

        <div className="grid md:grid-cols-2 gap-10 lg:gap-16 relative z-10">
          {/* Image Gallery */}
          <div className="space-y-4 md:sticky md:top-28 h-fit">
            <div
              ref={imgRef}
              className={`relative aspect-square bg-muted/20 border border-border/50 rounded-2xl overflow-hidden shadow-sm group ${
                images.length > 0 ? "cursor-crosshair" : "cursor-default"
              }`}
              onMouseEnter={() => images.length > 0 && setIsZooming(true)}
              onMouseLeave={() => setIsZooming(false)}
              onMouseMove={handleMouseMove}
              onClick={() => images.length > 0 && setLightbox(true)}
            >
              {images.length > 0 ? (
                <img
                  src={images[activeImage].url}
                  alt={images[activeImage].alt}
                  className="w-full h-full object-cover mix-blend-multiply dark:mix-blend-normal transition-transform duration-300 ease-out"
                  style={
                    isZooming
                      ? {
                          transform: "scale(2)",
                          transformOrigin: `${zoomPos.x}% ${zoomPos.y}%`,
                        }
                      : undefined
                  }
                  draggable={false}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-muted/30">
                  <Package className="h-20 w-20 text-muted-foreground/20" />
                </div>
              )}

              {images.length > 0 && !isZooming && (
                <div className="absolute bottom-4 right-4 bg-background/80 backdrop-blur-md text-foreground text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-lg flex items-center gap-1.5 shadow-sm border border-border pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                  <ZoomIn className="h-4 w-4" strokeWidth={2.5} /> Zoom
                </div>
              )}

              {images.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); prevImage(); }}
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-background/80 hover:bg-background text-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md border border-border"
                    aria-label="Previous image"
                  >
                    <ChevronLeft className="h-5 w-5" strokeWidth={2.5} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); nextImage(); }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-background/80 hover:bg-background text-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md border border-border"
                    aria-label="Next image"
                  >
                    <ChevronRight className="h-5 w-5" strokeWidth={2.5} />
                  </button>
                </>
              )}
            </div>

            {images.length > 1 && (
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none snap-x">
                {images.map((img, i) => (
                  <button
                    type="button"
                    key={img.id}
                    onClick={() => setActiveImage(i)}
                    className={`relative w-20 h-20 md:w-24 md:h-24 rounded-xl overflow-hidden transition-all flex-shrink-0 snap-start ${
                      i === activeImage
                        ? "ring-2 ring-accent ring-offset-2 ring-offset-background border-transparent shadow-md"
                        : "border border-border/50 hover:border-foreground/30 opacity-60 hover:opacity-100 bg-muted/20"
                    }`}
                  >
                    <img src={img.url} alt={img.alt} className="w-full h-full object-cover mix-blend-multiply dark:mix-blend-normal" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Details */}
          <div className="flex flex-col">
            <p className="font-display font-black text-xs text-accent uppercase tracking-[0.2em] mb-3">{product.category}</p>
            <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-black uppercase text-foreground leading-[1.1] mb-4 tracking-tight">
              {product.name}
            </h1>
            
            <div className="flex flex-wrap items-center gap-4 mb-6 md:mb-8 pb-6 border-b border-border/40">
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-display font-black uppercase tracking-widest border border-border/50 shadow-sm ${stockClass}`}>
                 {product.stock > 0 ? <CheckCircle className="h-3.5 w-3.5" strokeWidth={2.5} /> : <Package className="h-3.5 w-3.5" strokeWidth={2.5} />}
                 {stockLabel} {product.stock > 0 && product.stock <= 20 && `(${product.stock} ${t("products.remaining")})`}
              </div>
            </div>

            <PriceDisplay>
            <div className="flex items-end gap-4 mb-2">
              <p className="font-display text-4xl md:text-5xl font-black text-foreground tracking-tight drop-shadow-sm">{formatPrice(product.salePrice)}</p>
              {product.discountPercent > 0 && (
                <p className="text-lg text-muted-foreground line-through font-display font-semibold mb-1 opacity-70">{formatPrice(product.price)}</p>
              )}
              {product.discountPercent > 0 && (
                <span className="text-xs font-black uppercase tracking-widest text-destructive bg-destructive/10 px-3 py-1.5 rounded-md mb-1">
                  -{product.discountPercent}%
                </span>
              )}
            </div>
            {product.discountPercent > 0 && (
              <p className="text-[11px] font-bold text-accent uppercase tracking-widest mb-8">{t("products.discount_applied")}</p>
            )}
            </PriceDisplay>

            <p className="text-base text-muted-foreground font-medium mb-8 leading-relaxed max-w-2xl mt-6">{product.description}</p>

            <div className="mt-2">
            <AuthGatedCartButton>
            <div className="hidden md:flex flex-col gap-4 mb-8">
              <div className="flex items-center gap-3">
                <div className="flex items-center border border-border/80 rounded-xl bg-card shadow-sm h-[56px] overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setQty(Math.max(1, qty - 1))}
                    className="w-14 h-full flex items-center justify-center hover:bg-muted/50 transition-colors text-foreground"
                    aria-label="Decrease quantity"
                  >
                    <Minus className="h-5 w-5" strokeWidth={2.5} />
                  </button>
                  <span className="w-14 h-full flex items-center justify-center font-display font-black text-lg border-x border-border/50 bg-muted/10">{qty}</span>
                  <button
                    type="button"
                    onClick={() => setQty(qty + 1)}
                    className="w-14 h-full flex items-center justify-center hover:bg-muted/50 transition-colors text-foreground"
                    aria-label="Increase quantity"
                  >
                    <Plus className="h-5 w-5" strokeWidth={2.5} />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => addItem(product, qty)}
                  disabled={product.stock === 0}
                  className="flex-1 bg-primary text-primary-foreground h-[56px] rounded-xl font-display font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-accent hover:text-accent-foreground transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0"
                >
                  <ShoppingCart className="h-5 w-5" strokeWidth={2.5} /> {t("products.add_to_cart")}
                </button>
              </div>
              
              <Link
                to="/contact"
                className="w-full flex justify-center items-center gap-2 border-2 border-border/80 bg-background hover:border-foreground/80 hover:bg-muted/30 rounded-xl h-[56px] text-sm font-display font-black uppercase tracking-widest text-foreground transition-all shadow-sm"
              >
                <FileText className="h-5 w-5" strokeWidth={2.5} /> {t("products.request_quote")}
              </Link>
            </div>
            </AuthGatedCartButton>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              <div className="flex items-center gap-3 p-4 bg-card border border-border/60 rounded-xl shadow-sm">
                <div className="p-2 bg-muted rounded-full text-foreground/70"><Truck className="h-5 w-5" /></div>
                <span className="text-[11px] font-display font-bold uppercase tracking-wide text-foreground leading-tight">
                  {t("products.free_shipping_prefix")}<br/><span className="text-accent">{formatPrice(freeShippingThreshold)}</span>
                </span>
              </div>
              <div className="flex items-center gap-3 p-4 bg-card border border-border/60 rounded-xl shadow-sm">
                <div className="p-2 bg-muted rounded-full text-foreground/70"><Shield className="h-5 w-5" /></div>
                <span className="text-[11px] font-display font-bold uppercase tracking-wide text-foreground leading-tight max-w-[140px]">
                  {t("products.warranty_note")}
                </span>
              </div>
            </div>

            {specEntries.length > 0 && (
              <div className="border border-border/60 bg-card rounded-2xl overflow-hidden shadow-sm mb-6">
                <h3 className="font-display font-black text-xs uppercase tracking-[0.2em] px-5 py-4 bg-muted/40 border-b border-border/40">
                  {t("products.specifications")}
                </h3>
                <div className="divide-y divide-border/40">
                  {specEntries.map(([key, value]) => (
                    <div key={key} className="flex px-5 py-3 hover:bg-muted/10 transition-colors">
                      <span className="w-1/3 text-muted-foreground font-display font-bold text-[11px] uppercase tracking-wider">{key}</span>
                      <span className="w-2/3 font-medium text-foreground text-sm">
                        {Array.isArray(value) ? value.join(", ") : value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {product.compatibility && product.compatibility.length > 0 && (
              <div className="border border-border/60 bg-card rounded-2xl overflow-hidden shadow-sm">
                <h3 className="font-display font-black text-xs uppercase tracking-[0.2em] px-5 py-4 bg-muted/40 border-b border-border/40">
                  {t("products.compatibility")}
                </h3>
                <div className="px-5 py-4 flex flex-wrap gap-2">
                  {product.compatibility.map((c) => (
                    <span key={c} className="text-[11px] font-bold uppercase tracking-widest bg-accent/10 border border-accent/20 text-accent px-3 py-1.5 rounded-lg">
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Related Products Section */}
        {relatedProducts.length > 0 && (
          <section className="mt-24 pt-16 border-t border-border/60 relative z-10">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-10">
              <h2 className="font-display text-2xl md:text-3xl font-black uppercase tracking-tight text-foreground">
                {t("products.related")}
              </h2>
              <Link to={product.categorySlug ? `/products/${product.categorySlug}` : "/products"} className="font-display font-bold text-xs uppercase tracking-widest text-accent hover:text-foreground transition-colors flex items-center gap-1.5">
                View all <ChevronRight className="h-4 w-4" strokeWidth={2.5} />
              </Link>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 xl:gap-8">
              {relatedProducts.map((rp) => {
                const isOutOfStock = rp.stock <= 0;
                return (
                <div key={rp.id} className="group relative flex flex-col bg-card rounded-2xl overflow-hidden shadow-sm hover:shadow-2xl hover:-translate-y-1.5 transition-all duration-500 border border-border/60">
                    <Link to={productDetailHref(rp.id, rp.slug)} className="block aspect-[4/3] overflow-hidden bg-muted/40 relative">
                      {rp.image ? (
                        <img 
                           src={rp.image} 
                           alt={rp.name} 
                           className={`w-full h-full object-cover mix-blend-multiply dark:mix-blend-normal group-hover:scale-110 transition-transform duration-700 ease-out ${isOutOfStock ? "opacity-50 grayscale" : ""}`} 
                           loading="lazy" 
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground/30 bg-muted/20">
                          <Package className="h-12 w-12 opacity-30 drop-shadow-sm" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                      
                      {isOutOfStock && (
                        <div className="absolute top-3 left-3 bg-background/90 backdrop-blur-md text-foreground text-[10px] font-black uppercase tracking-widest px-2.5 py-1.5 rounded-sm shadow-sm border border-border">
                          Out of stock
                        </div>
                      )}
                    </Link>
                    
                    <div className="p-4 sm:p-5 flex flex-col flex-1 relative bg-card z-10">
                      {/* SKU hidden from storefront */}
                      <Link to={productDetailHref(rp.id, rp.slug)} className="text-sm font-semibold text-foreground hover:text-accent transition-colors line-clamp-2 leading-snug mb-auto font-display">
                        {rp.name}
                      </Link>
                      <PriceDisplay>
                      <div className="mt-4 flex items-end justify-between">
                        <p className="text-lg font-display font-black text-foreground tracking-tight">{formatPrice(rp.price)}</p>
                      </div>
                      </PriceDisplay>
                      <div className="hidden lg:block lg:max-h-0 lg:opacity-0 lg:overflow-hidden lg:group-hover:mt-4 lg:group-hover:max-h-[60px] lg:group-hover:opacity-100 transition-all duration-300 ease-out">
                        <AuthGatedCartButton>
                          <button type="button" onClick={() => addItem(rp)} disabled={isOutOfStock} className="w-full bg-primary text-primary-foreground text-[10px] py-3 rounded-lg font-display font-black uppercase tracking-widest hover:bg-accent hover:text-accent-foreground active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm">
                            <ShoppingCart className="h-3.5 w-3.5" strokeWidth={2.5} /> {t("products.add_to_cart")}
                          </button>
                        </AuthGatedCartButton>
                      </div>
                      <div className="mt-4 lg:hidden">
                        <AuthGatedCartButton>
                          <button type="button" onClick={() => addItem(rp)} disabled={isOutOfStock} className="w-full bg-primary text-primary-foreground text-[10px] py-3 rounded-lg font-display font-black uppercase tracking-widest active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm">
                            <ShoppingCart className="h-3.5 w-3.5" strokeWidth={2.5} /> {t("products.add_to_cart")}
                          </button>
                        </AuthGatedCartButton>
                      </div>
                    </div>
                </div>
              )})}
            </div>
          </section>
        )}
      </div>

      {/* Mobile Sticky Add to Cart */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-card/95 backdrop-blur-xl border-t border-border/60 px-4 py-3 sm:py-4 shadow-[0_-8px_30px_rgba(0,0,0,0.12)]">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-shrink-0 mr-auto">
            <PriceDisplay>
            <div className="flex items-baseline gap-2">
              <p className="text-xl font-display font-black text-foreground leading-tight tracking-tight">{formatPrice(product.salePrice)}</p>
              {product.discountPercent > 0 && (
                <p className="text-xs text-muted-foreground line-through opacity-60">{formatPrice(product.price)}</p>
              )}
            </div>
            </PriceDisplay>
            <p className={`text-[10px] font-display font-bold uppercase tracking-widest mt-0.5 ${stockClass.split(' ')[0]} flex items-center gap-1`}>
               {product.stock > 0 ? <CheckCircle className="h-3 w-3" strokeWidth={2.5} /> : <Package className="h-3 w-3" strokeWidth={2.5} />}
               {stockLabel}
            </p>
          </div>
          <AuthGatedCartButton>
            <button
              type="button"
              onClick={() => addItem(product, 1)}
              disabled={product.stock === 0}
              className="bg-foreground text-background py-3.5 px-6 rounded-xl font-display font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl active:scale-[0.98] transition-transform disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              <ShoppingCart className="h-4 w-4" strokeWidth={2.5} /> {t("products.add_to_cart")}
            </button>
          </AuthGatedCartButton>
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && images.length > 0 && (
        <div className="fixed inset-0 z-[120] bg-background/95 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-300" onClick={() => setLightbox(false)}>
          <button type="button" className="absolute top-6 right-6 text-foreground/50 hover:text-foreground bg-muted hover:bg-muted/80 p-3 rounded-full transition-colors z-10 shadow-sm" onClick={() => setLightbox(false)} aria-label="Close">
            <X className="h-6 w-6" strokeWidth={2.5} />
          </button>

          {images.length > 1 && (
            <>
              <button type="button" onClick={(e) => { e.stopPropagation(); prevImage(); }} className="absolute left-6 top-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-card/80 backdrop-blur border border-border hover:bg-accent hover:text-accent-foreground hover:border-accent text-foreground flex items-center justify-center transition-all shadow-xl" aria-label="Previous">
                <ChevronLeft className="h-8 w-8" strokeWidth={2} />
              </button>
              <button type="button" onClick={(e) => { e.stopPropagation(); nextImage(); }} className="absolute right-6 top-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-card/80 backdrop-blur border border-border hover:bg-accent hover:text-accent-foreground hover:border-accent text-foreground flex items-center justify-center transition-all shadow-xl" aria-label="Next">
                <ChevronRight className="h-8 w-8" strokeWidth={2} />
              </button>
            </>
          )}

          <img src={images[activeImage].url} alt={images[activeImage].alt} className="max-w-full max-h-[85vh] object-contain drop-shadow-2xl rounded-lg" onClick={(e) => e.stopPropagation()} />

          {images.length > 1 && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-3 p-3 bg-card/80 backdrop-blur-md border border-border/50 rounded-2xl shadow-xl">
              {images.map((img, i) => (
                <button type="button" key={img.id} onClick={(e) => { e.stopPropagation(); setActiveImage(i); }} className={`w-14 h-14 rounded-lg overflow-hidden transition-all ${i === activeImage ? "ring-2 ring-accent ring-offset-2 ring-offset-background opacity-100 shadow-sm" : "border border-border/50 opacity-50 hover:opacity-100"}`}>
                  <img src={img.url} alt={img.alt} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

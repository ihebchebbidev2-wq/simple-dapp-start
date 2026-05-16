import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, type ReactNode } from "react";
import type { StorefrontProduct } from "@/lib/storefront-product";
import { toast } from "@/hooks/use-toast";
import { useStorefrontRates } from "@/hooks/useApi";
import { FLAT_SHIPPING_RATE, FREE_SHIPPING_THRESHOLD, TAX_RATE } from "@/config/constants";
import type { TaxRateConfig } from "@/lib/api";

const CART_STORAGE_KEY = "remquip_cart";

function loadCartFromStorage(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCartToStorage(items: CartItem[]) {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  } catch { /* quota exceeded — ignore */ }
}

export interface CartItem {
  product: StorefrontProduct;
  quantity: number;
}

/** Per-tax line computed for the current cart. */
export interface CartTaxLine {
  name: string;
  label_en: string;
  label_fr: string;
  label_es: string;
  rate: number;       // percentage
  amount: number;     // computed amount
}

interface CartContextType {
  items: CartItem[];
  addItem: (product: StorefrontProduct, qty?: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, qty: number) => void;
  clearCart: () => void;
  itemCount: number;
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  /** From GET /settings/storefront (falls back to constants). */
  freeShippingThreshold: number;
  flatShippingRate: number;
  taxCombinedRate: number;
  /** Individual tax lines for display in cart/checkout/reports. */
  taxLines: CartTaxLine[];
  /** Raw tax rate configs from backend. */
  taxRates: TaxRateConfig[];
  lastAddedAt: number; // timestamp to trigger badge animation
}

const CartContext = createContext<CartContextType | undefined>(undefined);

/** Compute individual tax lines from dynamic rates. */
function computeTaxLines(subtotal: number, taxRates: TaxRateConfig[]): { lines: CartTaxLine[]; total: number } {
  const lines: CartTaxLine[] = [];
  let runningBase = subtotal;
  let totalTax = 0;

  for (const tr of taxRates) {
    const base = tr.is_compound ? runningBase : subtotal;
    const amount = Math.round(base * tr.rate_decimal * 100) / 100;
    lines.push({
      name: tr.name,
      label_en: tr.label_en || tr.name,
      label_fr: tr.label_fr || tr.name,
      label_es: tr.label_es || tr.name,
      rate: tr.rate,
      amount,
    });
    totalTax += amount;
    runningBase += amount;
  }

  return { lines, total: Math.round(totalTax * 100) / 100 };
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(loadCartFromStorage);
  const [lastAddedAt, setLastAddedAt] = useState(0);

  // Persist cart to localStorage on every change
  useEffect(() => {
    saveCartToStorage(items);
  }, [items]);
  const { data: storefrontRes } = useStorefrontRates();
  const storefront = storefrontRes?.data;

  const addItem = useCallback((product: StorefrontProduct, qty = 1) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, quantity: i.quantity + qty } : i
        );
      }
      return [...prev, { product, quantity: qty }];
    });
    setLastAddedAt(Date.now());

    toast({
      title: "Added to cart",
      description: `${product.name} × ${qty}`,
    });
  }, []);

  const removeItem = useCallback((productId: string) => {
    setItems((prev) => prev.filter((i) => i.product.id !== productId));
  }, []);

  const updateQuantity = useCallback((productId: string, qty: number) => {
    if (qty <= 0) {
      setItems((prev) => prev.filter((i) => i.product.id !== productId));
      return;
    }
    setItems((prev) =>
      prev.map((i) => (i.product.id === productId ? { ...i, quantity: qty } : i))
    );
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const freeShippingThreshold = storefront?.free_shipping_threshold ?? FREE_SHIPPING_THRESHOLD;
  const flatShippingRate = storefront?.flat_shipping_rate ?? FLAT_SHIPPING_RATE;
  const taxCombinedRate = storefront?.tax_combined_rate ?? TAX_RATE;
  const taxRates: TaxRateConfig[] = storefront?.tax_rates ?? [];

  const subtotal = items.reduce((sum, i) => sum + i.product.salePrice * i.quantity, 0);
  const { tax, shipping, total, taxLines } = useMemo(() => {
    let t: number;
    let lines: CartTaxLine[];

    if (taxRates.length > 0) {
      const result = computeTaxLines(subtotal, taxRates);
      t = result.total;
      lines = result.lines;
    } else {
      // Legacy fallback
      t = Math.round(subtotal * taxCombinedRate * 100) / 100;
      lines = [];
    }

    const ship =
      subtotal <= 0 ? 0 : subtotal >= freeShippingThreshold ? 0 : flatShippingRate;
    const tot = Math.round((subtotal + t + ship) * 100) / 100;
    return { tax: t, shipping: ship, total: tot, taxLines: lines };
  }, [subtotal, taxCombinedRate, taxRates, freeShippingThreshold, flatShippingRate]);
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        itemCount,
        subtotal,
        tax,
        shipping,
        total,
        freeShippingThreshold,
        flatShippingRate,
        taxCombinedRate,
        taxLines,
        taxRates,
        lastAddedAt,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}

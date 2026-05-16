import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

type Currency = "CAD" | "USD" | "EUR";

const DEFAULT_RATES: Record<Currency, number> = { CAD: 1, USD: 0.74, EUR: 0.68 };
const symbols: Record<Currency, string> = { CAD: "C$", USD: "$", EUR: "€" };

interface CurrencyContextType {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  formatPrice: (priceCAD: number) => string;
  symbol: string;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrency] = useState<Currency>("CAD");
  const [rates, setRates] = useState<Record<Currency, number>>(DEFAULT_RATES);

  useEffect(() => {
    async function fetchRates() {
      try {
        const response = await fetch("https://api.frankfurter.dev/v2/rates?base=CAD&quotes=USD,EUR");
        const data = await response.json();
        
        if (data && data.rates) {
          setRates({
            CAD: 1,
            USD: Number(data.rates.USD) || DEFAULT_RATES.USD,
            EUR: Number(data.rates.EUR) || DEFAULT_RATES.EUR,
          });
        }
      } catch (error) {
        console.error("Failed to fetch dynamic currency rates, using fallbacks:", error);
        // Fallback already in state via initial value
      }
    }

    fetchRates();
  }, []);

  const formatPrice = useCallback(
    (priceCAD: number) => {
      const converted = priceCAD * rates[currency];
      return `${symbols[currency]}${converted.toFixed(2)}`;
    },
    [currency, rates]
  );

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, formatPrice, symbol: symbols[currency] }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used within CurrencyProvider");
  return ctx;
}

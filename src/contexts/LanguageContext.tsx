import React, { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import en from "@/translations/en.json";
import fr from "@/translations/fr.json";
import es from "@/translations/es.json";
import { useStorefrontRates } from "@/hooks/useApi";

const translations: Record<string, Record<string, string>> = { en, fr, es };

const LOCALE_LABELS: Record<string, string> = {
  en: "English",
  fr: "Français",
  es: "Español",
  de: "Deutsch",
  it: "Italiano",
  pt: "Português",
  ar: "العربية",
  zh: "中文",
  ja: "日本語",
};

export function localeLabel(code: string): string {
  return LOCALE_LABELS[code] ?? code.toUpperCase();
}

export function localeFlag(code: string): string {
  const map: Record<string, string> = {
    en: "us",
    fr: "fr",
    es: "es",
    de: "de",
    it: "it",
    pt: "pt",
  };
  return map[code] ?? code.slice(0, 2);
}

interface LanguageContextType {
  lang: string;
  setLang: (l: string) => void;
  t: (key: string) => string;
  supportedLocales: string[];
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { data: storefront } = useStorefrontRates();
  const apiLocales = (storefront as { data?: { supported_locales?: string[] } } | undefined)?.data?.supported_locales;
  const KNOWN_LOCALES = ["en", "fr", "es"];
  const supportedLocales = apiLocales && apiLocales.length > 0
    ? Array.from(new Set([...apiLocales.map(l => l.toLowerCase()), ...KNOWN_LOCALES])).filter(l => KNOWN_LOCALES.includes(l))
    : KNOWN_LOCALES;

  const [lang, setLangState] = useState<string>("en");

  useEffect(() => {
    if (supportedLocales.length > 0 && !supportedLocales.includes(lang)) {
      setLangState(supportedLocales[0]);
    }
  }, [supportedLocales, lang]);

  const setLang = useCallback(
    (l: string) => {
      if (supportedLocales.includes(l)) {
        setLangState(l);
      }
    },
    [supportedLocales]
  );

  const t = useCallback(
    (key: string) => translations[lang]?.[key] ?? translations.en?.[key] ?? key,
    [lang]
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, supportedLocales }}>
      {children}
    </LanguageContext.Provider>
  );
}

const fallbackT = (key: string) => translations.en?.[key] ?? key;
const FALLBACK: LanguageContextType = { lang: "en", setLang: () => {}, t: fallbackT, supportedLocales: ["en", "fr", "es"] };

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  return ctx ?? FALLBACK;
}

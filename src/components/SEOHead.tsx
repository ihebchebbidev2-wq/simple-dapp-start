import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS } from "@/lib/api-endpoints";

export interface SEOMetadata {
  id: string;
  page_path: string;
  page_name: string;
  locale: string;
  meta_title: string;
  meta_description: string;
  og_title: string | null;
  og_description: string | null;
  og_image: string | null;
  og_type: string | null;
  twitter_title: string | null;
  twitter_description: string | null;
  twitter_image: string | null;
  twitter_card: string | null;
  canonical_url: string | null;
  json_ld: string | null;
  robots: string | null;
  keywords: string | null;
  is_active: number;
}

const DEFAULT_TITLE = "REMQUIP — Heavy-Duty Truck Parts Distributor";
const DEFAULT_DESCRIPTION = "Canada's next-generation heavy-duty truck parts distributor. Wholesale brakes, air suspension, and more.";

/**
 * Normalize pathname for SEO matching: strip trailing slashes, handle dynamic segments.
 */
function normalizePath(pathname: string): string {
  let p = pathname.replace(/\/+$/, "") || "/";
  // Map dynamic product detail to generic /product/:slug
  if (/^\/product\/[^/]+$/.test(p)) return "/product/:slug";
  // Map dynamic category to generic /products/:categorySlug
  if (/^\/products\/[^/]+$/.test(p)) return "/products/:categorySlug";
  return p;
}

/**
 * Sets or removes a <meta> tag in <head>.
 */
function setMeta(attr: string, key: string, content: string | null) {
  const selector = `meta[${attr}="${key}"]`;
  let el = document.querySelector(selector) as HTMLMetaElement | null;
  if (content) {
    if (!el) {
      el = document.createElement("meta");
      el.setAttribute(attr, key);
      document.head.appendChild(el);
    }
    el.setAttribute("content", content);
  } else {
    el?.remove();
  }
}

function setCanonical(url: string | null) {
  let el = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (url) {
    if (!el) {
      el = document.createElement("link");
      el.setAttribute("rel", "canonical");
      document.head.appendChild(el);
    }
    el.setAttribute("href", url);
  }
}

function setJsonLd(json: string | null, scriptId: string) {
  const existing = document.getElementById(scriptId);
  existing?.remove();
  if (json) {
    try {
      JSON.parse(json); // validate
      const script = document.createElement("script");
      script.id = scriptId;
      script.type = "application/ld+json";
      script.textContent = json;
      document.head.appendChild(script);
    } catch {
      // invalid JSON-LD, skip
    }
  }
}

export default function SEOHead() {
  const { pathname } = useLocation();
  const prevScriptId = useRef("seo-jsonld-dynamic");

  const normalizedPath = normalizePath(pathname);

  const { data } = useQuery({
    queryKey: ["seo", normalizedPath],
    queryFn: () => api.request("GET", `${API_ENDPOINTS.SEO.GET}?page_path=${encodeURIComponent(normalizedPath)}&locale=en`),
    staleTime: 1000 * 60 * 10,
    retry: 1,
  });

  const seo: SEOMetadata | null = data?.data ?? null;

  useEffect(() => {
    const title = seo?.meta_title || DEFAULT_TITLE;
    const description = seo?.meta_description || DEFAULT_DESCRIPTION;

    document.title = title;
    setMeta("name", "description", description);
    setMeta("name", "robots", seo?.robots || "index, follow");
    setMeta("name", "keywords", seo?.keywords || null);

    // Open Graph
    setMeta("property", "og:title", seo?.og_title || title);
    setMeta("property", "og:description", seo?.og_description || description);
    setMeta("property", "og:type", seo?.og_type || "website");
    setMeta("property", "og:image", seo?.og_image || null);

    // Twitter
    setMeta("name", "twitter:title", seo?.twitter_title || seo?.og_title || title);
    setMeta("name", "twitter:description", seo?.twitter_description || seo?.og_description || description);
    setMeta("name", "twitter:card", seo?.twitter_card || "summary_large_image");
    setMeta("name", "twitter:image", seo?.twitter_image || seo?.og_image || null);

    // Canonical
    setCanonical(seo?.canonical_url || `https://remquip.ca${pathname}`);

    // JSON-LD
    setJsonLd(seo?.json_ld || null, prevScriptId.current);

    return () => {
      // Cleanup dynamic JSON-LD on unmount
      const el = document.getElementById(prevScriptId.current);
      el?.remove();
    };
  }, [seo, pathname]);

  return null;
}

import React, { useEffect, useMemo } from "react";
import { useLandingTheme } from "@/hooks/useApi";
import type { LandingThemePayload } from "@/lib/api";
import { landingThemeToStyle } from "@/lib/landingTheme";

const GOOGLE_FONT_LINK_ID = "landing-theme-google-fonts";
const CUSTOM_CSS_ID = "landing-theme-custom-css";

function unwrapTheme(res: unknown): LandingThemePayload | null {
  const r = res as { success?: boolean; data?: LandingThemePayload } | undefined;
  if (!r?.success || !r.data) return null;
  return r.data;
}

/**
 * Wraps the homepage: injects CSS variables, optional Google Fonts, and custom CSS.
 * Scoped to `.landing-theme-scope` (cleans up injected tags on unmount).
 */
export default function LandingThemeScope({ children }: { children: React.ReactNode }) {
  const { data: res } = useLandingTheme();
  const theme = useMemo(() => unwrapTheme(res), [res]);
  const style = useMemo(() => landingThemeToStyle(theme), [theme]);

  useEffect(() => {
    const href = theme?.google_fonts_url?.trim();
    let link = document.getElementById(GOOGLE_FONT_LINK_ID) as HTMLLinkElement | null;
    if (!href) {
      link?.remove();
      return;
    }
    if (!link) {
      link = document.createElement("link");
      link.id = GOOGLE_FONT_LINK_ID;
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    link.href = href;
    return () => {
      document.getElementById(GOOGLE_FONT_LINK_ID)?.remove();
    };
  }, [theme?.google_fonts_url]);

  useEffect(() => {
    let el = document.getElementById(CUSTOM_CSS_ID) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement("style");
      el.id = CUSTOM_CSS_ID;
      document.head.appendChild(el);
    }
    el.textContent = theme?.custom_css?.trim() ?? "";
    return () => {
      const node = document.getElementById(CUSTOM_CSS_ID);
      if (node) node.textContent = "";
    };
  }, [theme?.custom_css]);

  return (
    <div className="landing-theme-scope min-w-0" style={style}>
      {children}
    </div>
  );
}

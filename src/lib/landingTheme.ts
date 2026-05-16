import type { CSSProperties } from "react";
import type { LandingThemePayload } from "@/lib/api";

/** CSS size keys used by `.landing-theme-scope` in `index.css` + HomePage classes. */
export const LANDING_FONT_SIZE_KEYS = [
  { key: "hero_title", label: "Hero headline" },
  { key: "hero_subtitle", label: "Hero subtitle" },
  { key: "stats_value", label: "Stats numbers" },
  { key: "stats_label", label: "Stats captions" },
  { key: "section_heading", label: "Section headings (H2)" },
  { key: "section_eyebrow", label: "Section eyebrow" },
  { key: "value_prop_text", label: "Value prop row text" },
  { key: "wholesale_heading", label: "Wholesale block heading" },
  { key: "wholesale_body", label: "Wholesale block body" },
] as const;

/** Common HSL tokens (no hsl() wrapper) — same as :root in index.css */
export const LANDING_COLOR_PRESETS = [
  { varName: "--accent", label: "Accent" },
  { varName: "--accent-foreground", label: "On accent" },
  { varName: "--primary", label: "Primary / hero tint" },
  { varName: "--primary-foreground", label: "On primary" },
  { varName: "--tertiary", label: "Tertiary (hero bg)" },
  { varName: "--foreground", label: "Foreground text" },
  { varName: "--background", label: "Page background" },
  { varName: "--muted", label: "Muted surfaces" },
  { varName: "--muted-foreground", label: "Muted text" },
  { varName: "--border", label: "Borders" },
] as const;

export function landingThemeToStyle(theme: LandingThemePayload | null | undefined): CSSProperties {
  const style: Record<string, string> = {};
  const vars = theme?.css_variables ?? {};
  for (const [k, v] of Object.entries(vars)) {
    if (k.startsWith("--") && typeof v === "string" && v.trim()) {
      style[k] = v.trim();
    }
  }
  if (theme?.font_heading_stack?.trim()) {
    style["--landing-font-display"] = theme.font_heading_stack.trim();
  }
  if (theme?.font_body_stack?.trim()) {
    style["--landing-font-body"] = theme.font_body_stack.trim();
  }
  const sizes = theme?.font_sizes ?? {};
  for (const [k, v] of Object.entries(sizes)) {
    if (typeof v === "string" && v.trim() && /^[a-z][a-z0-9_]*$/.test(k)) {
      style[`--landing-size-${k}`] = v.trim();
    }
  }
  return style as CSSProperties;
}

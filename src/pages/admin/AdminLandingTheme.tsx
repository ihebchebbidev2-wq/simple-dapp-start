import React, { useEffect, useState } from "react";
import { Loader2, Palette, Save } from "lucide-react";
import { useLandingTheme, useUpdateLandingTheme } from "@/hooks/useApi";
import type { LandingThemePayload } from "@/lib/api";
import { LANDING_COLOR_PRESETS, LANDING_FONT_SIZE_KEYS } from "@/lib/landingTheme";
import { showSuccessToast, showErrorToast } from "@/lib/toast";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminPageLoading } from "@/components/admin/AdminPageState";

const PRESET_VAR_NAMES = new Set(LANDING_COLOR_PRESETS.map((p) => p.varName as string));

const DEFAULT_LANDING_FONT_HEADING_STACK = "'Manrope', 'Inter', ui-sans-serif, system-ui, sans-serif";
const DEFAULT_LANDING_FONT_BODY_STACK = "'Inter', system-ui, sans-serif";

const DEFAULT_LANDING_FONT_SIZES: Record<(typeof LANDING_FONT_SIZE_KEYS)[number]["key"], string> = {
  hero_title: "clamp(2.25rem, 5vw, 4.5rem)",
  hero_subtitle: "clamp(1.05rem, 2.5vw, 1.25rem)",
  stats_value: "clamp(1.75rem, 4vw, 2.25rem)",
  stats_label: "0.875rem",
  section_heading: "clamp(1.25rem, 2.5vw, 1.5rem)",
  section_eyebrow: "0.75rem",
  value_prop_text: "0.875rem",
  wholesale_heading: "clamp(1.25rem, 2.5vw, 1.875rem)",
  wholesale_body: "clamp(0.875rem, 1.5vw, 1rem)",
};

function readRootCssVar(varName: string): string {
  if (typeof window === "undefined") return "";
  const v = getComputedStyle(document.documentElement).getPropertyValue(varName);
  return v.trim();
}

function parseExtraVars(json: string): Record<string, string> {
  if (!json.trim()) return {};
  const j = JSON.parse(json) as unknown;
  if (typeof j !== "object" || j === null || Array.isArray(j)) {
    throw new Error("Must be a JSON object");
  }
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(j as Record<string, unknown>)) {
    if (!/^--[a-zA-Z0-9_-]{1,80}$/.test(k)) continue;
    if (typeof v !== "string") continue;
    if (v.trim()) out[k] = v.trim();
  }
  return out;
}

export default function AdminLandingTheme() {
  const { data: res, isLoading } = useLandingTheme();
  const updateMutation = useUpdateLandingTheme();
  const theme = res?.success && res.data ? (res.data as LandingThemePayload) : null;

  const [colors, setColors] = useState<Record<string, string>>(() =>
    Object.fromEntries(LANDING_COLOR_PRESETS.map((p) => [p.varName, ""]))
  );
  const [radius, setRadius] = useState("");
  const [extraVarsJson, setExtraVarsJson] = useState("{}");
  const [fontHeading, setFontHeading] = useState("");
  const [fontBody, setFontBody] = useState("");
  const [googleUrl, setGoogleUrl] = useState("");
  const [sizes, setSizes] = useState<Record<string, string>>(() =>
    Object.fromEntries(LANDING_FONT_SIZE_KEYS.map((s) => [s.key, ""]))
  );
  const [customCss, setCustomCss] = useState("");

  useEffect(() => {
    if (!theme) return;
    const cv = theme.css_variables ?? {};
    const nextColors: Record<string, string> = {};
    for (const p of LANDING_COLOR_PRESETS) {
      // If DB theme is empty, show your current design from :root as editor defaults.
      const fromDb = (cv as Record<string, unknown>)[p.varName];
      const dbVal = typeof fromDb === "string" ? fromDb.trim() : "";
      nextColors[p.varName] = dbVal || readRootCssVar(p.varName);
    }
    setColors(nextColors);
    const fromDbRadius = typeof (cv as Record<string, unknown>)["--radius"] === "string" ? String((cv as Record<string, unknown>)["--radius"]).trim() : "";
    setRadius(fromDbRadius || readRootCssVar("--radius"));
    const extra: Record<string, string> = {};
    for (const [k, v] of Object.entries(cv)) {
      if (PRESET_VAR_NAMES.has(k) || k === "--radius") continue;
      if (typeof v === "string" && v) extra[k] = v;
    }
    setExtraVarsJson(Object.keys(extra).length ? JSON.stringify(extra, null, 2) : "{}");
    setFontHeading(theme.font_heading_stack?.trim() ? theme.font_heading_stack : DEFAULT_LANDING_FONT_HEADING_STACK);
    setFontBody(theme.font_body_stack?.trim() ? theme.font_body_stack : DEFAULT_LANDING_FONT_BODY_STACK);
    setGoogleUrl(theme.google_fonts_url ?? "");
    const nextSizes: Record<string, string> = {};
    for (const s of LANDING_FONT_SIZE_KEYS) {
      const dbVal = (theme.font_sizes as Record<string, unknown> | undefined)?.[s.key];
      const dbStr = typeof dbVal === "string" ? dbVal.trim() : "";
      nextSizes[s.key] = dbStr || DEFAULT_LANDING_FONT_SIZES[s.key] || "";
    }
    setSizes(nextSizes);
    setCustomCss(theme.custom_css ?? "");
  }, [theme?.updated_at, theme?.id]);

  const handleSave = async () => {
    let extra: Record<string, string> = {};
    try {
      extra = parseExtraVars(extraVarsJson);
    } catch {
      showErrorToast("Additional CSS variables must be valid JSON object");
      return;
    }

    const css_variables: Record<string, string> = { ...extra };
    for (const [k, v] of Object.entries(colors)) {
      if (v.trim()) css_variables[k] = v.trim();
    }
    if (radius.trim()) css_variables["--radius"] = radius.trim();

    const font_sizes: Record<string, string> = {};
    for (const [k, v] of Object.entries(sizes)) {
      if (v.trim()) font_sizes[k] = v.trim();
    }

    try {
      await updateMutation.mutateAsync({
        css_variables,
        font_heading_stack: fontHeading.trim(),
        font_body_stack: fontBody.trim(),
        google_fonts_url: googleUrl.trim() || null,
        font_sizes,
        custom_css: customCss.trim() || null,
      });
      showSuccessToast("Landing theme saved");
    } catch {
      showErrorToast("Failed to save landing theme");
    }
  };

  const field =
    "w-full px-3 py-2 border border-border rounded-sm text-sm bg-background outline-none focus:ring-2 focus:ring-accent";

  if (isLoading) {
    return <AdminPageLoading message="Loading theme" />;
  }

  return (
    <div className="dashboard-card space-y-6">
      <AdminPageHeader
        title="Landing page theme"
        icon={Palette}
        subtitle={
          <>
            Colors use the same HSL triples as the rest of the site (no <code className="text-[11px]">hsl()</code> wrapper),{" "}
            e.g. <code className="text-[11px]">28 90% 55%</code> for accent. Only the public homepage is wrapped in{" "}
            <code className="text-[11px]">.landing-theme-scope</code>. Custom CSS should target that class. Optional:{" "}
            <a
              className="text-accent hover:underline"
              href="https://fonts.google.com/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google Fonts
            </a>{" "}
            stylesheet URL.
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3 rounded-md border border-border bg-muted/15 p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Colors (HSL components)</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {LANDING_COLOR_PRESETS.map((p) => (
              <div key={p.varName}>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  {p.label} <span className="font-mono opacity-70">{p.varName}</span>
                </label>
                <input
                  className={field}
                  value={colors[p.varName] ?? ""}
                  onChange={(e) => setColors((c) => ({ ...c, [p.varName]: e.target.value }))}
                  placeholder="e.g. 28 90% 55%"
                />
              </div>
            ))}
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Border radius <span className="font-mono">--radius</span>
            </label>
            <input
              className={field + " font-mono"}
              value={radius}
              onChange={(e) => setRadius(e.target.value)}
              placeholder="e.g. 0.75rem"
            />
          </div>
        </div>

        <div className="space-y-3 rounded-md border border-border bg-muted/15 p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Typography</p>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Heading font stack</label>
            <input
              className={field + " font-mono text-xs"}
              value={fontHeading}
              onChange={(e) => setFontHeading(e.target.value)}
              placeholder="'Manrope', 'Inter', sans-serif"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Body font stack</label>
            <input
              className={field + " font-mono text-xs"}
              value={fontBody}
              onChange={(e) => setFontBody(e.target.value)}
              placeholder="'Inter', system-ui, sans-serif"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Google Fonts CSS URL (https)</label>
            <input
              className={field + " font-mono text-xs"}
              value={googleUrl}
              onChange={(e) => setGoogleUrl(e.target.value)}
              placeholder="https://fonts.googleapis.com/css2?family=..."
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {LANDING_FONT_SIZE_KEYS.map((s) => (
              <div key={s.key}>
                <label className="block text-xs font-medium text-muted-foreground mb-1">{s.label}</label>
                <input
                  className={field + " font-mono text-xs"}
                  value={sizes[s.key] ?? ""}
                  onChange={(e) => setSizes((z) => ({ ...z, [s.key]: e.target.value }))}
                  placeholder="e.g. clamp(1rem, 2vw, 1.25rem)"
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">
          Additional CSS variables (JSON)
        </label>
        <p className="text-xs text-muted-foreground mb-2">
          Keys must look like <code className="text-[11px]">--my-token</code>. Values are strings (e.g. HSL triples or lengths).
        </p>
        <textarea
          className={field + " font-mono text-xs min-h-[120px]"}
          value={extraVarsJson}
          onChange={(e) => setExtraVarsJson(e.target.value)}
          spellCheck={false}
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Custom CSS</label>
        <p className="text-xs text-muted-foreground mb-2">
          Injected as a global stylesheet; scope rules with <code className="text-[11px]">.landing-theme-scope …</code> so other
          pages are unaffected.
        </p>
        <textarea
          className={field + " font-mono text-xs min-h-[140px]"}
          value={customCss}
          onChange={(e) => setCustomCss(e.target.value)}
          spellCheck={false}
          placeholder={`.landing-theme-scope .btn-gradient {\n  /* example */\n}`}
        />
      </div>

      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={updateMutation.isPending}
        className="btn-accent px-4 py-2 rounded-sm text-sm font-medium inline-flex items-center gap-2 disabled:opacity-50"
      >
        {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Save landing theme
      </button>
    </div>
  );
}

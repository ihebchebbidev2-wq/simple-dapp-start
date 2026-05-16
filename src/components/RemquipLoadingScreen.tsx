import React from "react";
import { cn } from "@/lib/utils";

const LOGO = "REMQUIP".split("");

export type RemquipLoaderVariant = "fullscreen" | "embedded" | "panel";

export interface RemquipLoadingScreenProps {
  variant?: RemquipLoaderVariant;
  /** Shown under the logo (e.g. “Loading…”, “Verifying access…”) */
  message?: string;
  className?: string;
}

/**
 * Branded REMQUIP loading experience — letter wave, aurora, indeterminate bar.
 * Use `fullscreen` for route/auth gates; `embedded` inside main content; `panel` for compact admin cards.
 */
export function RemquipLoadingScreen({
  variant = "embedded",
  message = "Loading",
  className,
}: RemquipLoadingScreenProps) {
  const isFullscreen = variant === "fullscreen";

  return (
    <div
      className={cn(
        "remquip-loader-root flex flex-col items-center justify-center text-center",
        isFullscreen && "remquip-loader-fullscreen fixed inset-0 z-[200]",
        variant === "embedded" && "w-full max-w-md px-6 py-8",
        variant === "panel" && "w-full max-w-[220px] px-4 py-6",
        className
      )}
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">{message}</span>
      <div className="remquip-loader-aurora pointer-events-none" aria-hidden />
      <div className="remquip-loader-grid pointer-events-none" aria-hidden />

      <div className="relative z-10 flex flex-col items-center">
        <div
          className={cn(
            "remquip-loader-wordmark flex flex-wrap items-center justify-center",
            variant === "panel" && "text-2xl" // Smaller for panel variant
          )}
        >
          REMQUIP
        </div>

        <p
          className={cn(
            "mt-4 text-muted-foreground font-medium tracking-[0.18em]",
            variant === "panel" ? "text-[9px]" : "text-[10px] sm:text-[11px]"
          )}
        >
          {message}
        </p>

        <div
          className={cn(
            "remquip-loader-track mt-8 overflow-hidden rounded-full bg-muted/80",
            variant === "panel" ? "mt-5 h-0.5 w-32" : "h-[3px] w-44 sm:w-52"
          )}
        >
          <div className="remquip-loader-shimmer h-full w-[45%] rounded-full" />
        </div>

      </div>
    </div>
  );
}

/** Centered block for lazy routes and page-level data fetching (inside layout). */
export function RemquipPageBlockLoader({ message }: { message?: string }) {
  return (
    <div className="flex min-h-[min(420px,72vh)] w-full items-center justify-center px-4 py-16">
      <RemquipLoadingScreen variant="embedded" message={message} />
    </div>
  );
}

/** Compact pulse for search dropdowns and tight UI slots. */
export function RemquipSearchPulse() {
  return (
    <div className="flex items-center justify-center gap-1.5 py-5" role="status" aria-label="Searching">
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className="remquip-search-pulse-dot h-1 w-1 rounded-full bg-accent"
          style={{ animationDelay: `${i * 0.1}s` }}
        />
      ))}
    </div>
  );
}

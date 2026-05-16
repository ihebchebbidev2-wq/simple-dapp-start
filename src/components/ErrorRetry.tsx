import React from "react";
import { AlertCircle, RefreshCw, WifiOff } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface ErrorRetryProps {
  message?: string;
  onRetry: () => void;
  isRetrying?: boolean;
  variant?: "inline" | "card" | "fullwidth";
  className?: string;
}

/**
 * Reusable error state with retry button.
 * Use to replace silent `catch {}` blocks with user-visible feedback.
 */
export function ErrorRetry({
  message,
  onRetry,
  isRetrying = false,
  variant = "card",
  className = "",
}: ErrorRetryProps) {
  const { t } = useLanguage();
  const defaultMessage = t("error.generic") || "Something went wrong. Please try again.";

  if (variant === "inline") {
    return (
      <div className={`flex items-center gap-3 text-sm text-destructive ${className}`}>
        <AlertCircle className="h-4 w-4 shrink-0" />
        <span className="flex-1">{message || defaultMessage}</span>
        <button
          type="button"
          onClick={onRetry}
          disabled={isRetrying}
          className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-foreground hover:text-accent transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${isRetrying ? "animate-spin" : ""}`} />
          {t("error.retry") || "Retry"}
        </button>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col items-center justify-center text-center px-6 ${
        variant === "fullwidth"
          ? "py-20 rounded-2xl border border-border border-dashed bg-muted/10"
          : "py-12"
      } ${className}`}
    >
      <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center mb-5">
        <WifiOff className="h-7 w-7 text-destructive/70" />
      </div>
      <h3 className="font-display font-bold text-lg mb-2">
        {t("error.title") || "Failed to load"}
      </h3>
      <p className="text-muted-foreground text-sm mb-6 max-w-sm leading-relaxed">
        {message || defaultMessage}
      </p>
      <button
        type="button"
        onClick={onRetry}
        disabled={isRetrying}
        className="inline-flex items-center gap-2 bg-foreground text-background px-6 py-3 rounded-lg font-display font-bold text-xs uppercase tracking-widest hover:bg-accent hover:text-accent-foreground transition-all active:scale-[0.98] disabled:opacity-50"
      >
        <RefreshCw className={`h-4 w-4 ${isRetrying ? "animate-spin" : ""}`} />
        {isRetrying ? (t("error.retrying") || "Retrying…") : (t("error.retry") || "Try Again")}
      </button>
    </div>
  );
}

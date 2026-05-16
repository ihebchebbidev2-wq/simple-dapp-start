import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Detects chunk-load failures caused by deploys (old hash URLs 404).
 */
function isChunkLoadError(error: Error): boolean {
  const msg = error.message?.toLowerCase() ?? "";
  return (
    msg.includes("failed to fetch dynamically imported module") ||
    msg.includes("loading chunk") ||
    msg.includes("loading css chunk") ||
    msg.includes("dynamically imported module") ||
    (error.name === "TypeError" && msg.includes("failed to fetch"))
  );
}

const RELOAD_KEY = "__remquip_chunk_reload__";

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);

    // If it's a chunk load failure from a deploy, silently reload once
    if (isChunkLoadError(error)) {
      const lastReload = sessionStorage.getItem(RELOAD_KEY);
      const now = Date.now();
      // Only auto-reload if we haven't reloaded in the last 10 seconds (prevent loops)
      if (!lastReload || now - Number(lastReload) > 10_000) {
        sessionStorage.setItem(RELOAD_KEY, String(now));
        window.location.reload();
        return;
      }
    }
  }

  render() {
    if (this.state.hasError) {
      // If chunk error and we already tried auto-reload, show a friendly message
      if (this.state.error && isChunkLoadError(this.state.error)) {
        return (
          <div className="min-h-[400px] flex items-center justify-center">
            <div className="text-center max-w-md px-4">
              <AlertTriangle className="h-12 w-12 text-accent mx-auto mb-4" strokeWidth={1.5} />
              <h2 className="font-display text-xl font-bold mb-2">New version available</h2>
              <p className="text-sm text-muted-foreground mb-4">
                A new version of the app has been deployed. Please reload to continue.
              </p>
              <button
                onClick={() => {
                  sessionStorage.removeItem(RELOAD_KEY);
                  window.location.reload();
                }}
                className="btn-accent px-6 py-2.5 rounded-sm text-sm font-medium"
              >
                Reload Now
              </button>
            </div>
          </div>
        );
      }

      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="min-h-[400px] flex items-center justify-center">
          <div className="text-center max-w-md px-4">
            <AlertTriangle className="h-12 w-12 text-warning mx-auto mb-4" strokeWidth={1.5} />
            <h2 className="font-display text-xl font-bold mb-2">Something went wrong</h2>
            <p className="text-sm text-muted-foreground mb-4">
              An unexpected error occurred. Please try refreshing the page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="btn-accent px-6 py-2.5 rounded-sm text-sm font-medium"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

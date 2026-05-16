import React from "react";
import { AlertCircle, FileX, Loader2 } from "lucide-react";

type StateLoadingProps = {
  message: string;
};

export function AdminPageLoading({ message }: StateLoadingProps) {
  return (
    <div className="min-h-[min(420px,72vh)] flex items-center justify-center admin-page-enter">
      <div className="flex flex-col items-center gap-4">
        {/* Skeleton shimmer cards */}
        <div className="grid grid-cols-2 gap-3 w-80 mb-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-muted/60 relative overflow-hidden">
              <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite]"
                style={{
                  background: 'linear-gradient(90deg, transparent, hsl(var(--muted-foreground) / 0.06), transparent)',
                  animationName: 'remquip-loader-shimmer',
                }}
              />
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-accent" />
          <span className="text-sm font-medium text-muted-foreground">{message}…</span>
        </div>
      </div>
    </div>
  );
}

type StateErrorProps = {
  message: string;
  retryLabel?: string;
  onRetry?: () => void;
  extra?: React.ReactNode;
};

export function AdminPageError({ message, retryLabel = "Try again", onRetry, extra }: StateErrorProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-center px-4 admin-page-enter">
      <div className="dashboard-card max-w-md w-full py-10 px-8">
        <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-5">
          <AlertCircle className="h-7 w-7 text-destructive" />
        </div>
        <h3 className="font-display font-bold text-lg mb-2">Something went wrong</h3>
        <p className="text-muted-foreground text-sm mb-6 leading-relaxed">{message}</p>
        {extra ? <div className="mb-4">{extra}</div> : null}
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="admin-btn--primary px-6 py-2.5"
          >
            {retryLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}

type StateEmptyProps = {
  title: string;
  description?: string;
  icon?: React.ElementType;
  action?: React.ReactNode;
};

export function AdminPageEmpty({ title, description, icon: Icon = FileX, action }: StateEmptyProps) {
  return (
    <div className="dashboard-card text-center py-16 admin-page-enter">
      <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-5">
        <Icon className="h-7 w-7 text-muted-foreground" />
      </div>
      <h3 className="font-display font-bold text-lg">{title}</h3>
      {description ? (
        <p className="text-muted-foreground text-sm mt-2 max-w-sm mx-auto leading-relaxed">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

import { useEffect, useState } from "react";
import { RemquipLoadingScreen } from "@/components/RemquipLoadingScreen";

const FIRST_VISIT_KEY = "remquip_visited";
const MIN_LANDING_LOAD_MS = 4000;

export default function HomeLandingRoute() {
  const [Page, setPage] = useState<React.ComponentType | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const isFirstVisit = !sessionStorage.getItem(FIRST_VISIT_KEY);

  useEffect(() => {
    let cancelled = false;

    const chunkPromise = import("@/pages/HomePage");

    const loadPromise = isFirstVisit
      ? Promise.all([
          chunkPromise,
          new Promise<void>((resolve) => setTimeout(resolve, MIN_LANDING_LOAD_MS)),
        ]).then(([mod]) => mod)
      : chunkPromise;

    loadPromise
      .then((mod) => {
        if (!cancelled) {
          sessionStorage.setItem(FIRST_VISIT_KEY, "1");
          setPage(() => mod.default);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (loadFailed) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-4 text-center text-muted-foreground">
        <p className="text-sm">We couldn&apos;t load the homepage. Check your connection and refresh the page.</p>
        <button
          type="button"
          className="text-sm font-medium text-accent underline"
          onClick={() => window.location.reload()}
        >
          Refresh
        </button>
      </div>
    );
  }

  if (!Page) {
    return <RemquipLoadingScreen variant="fullscreen" message="Loading" />;
  }

  return <Page />;
}

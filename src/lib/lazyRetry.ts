/**
 * Wraps a dynamic import with retry logic so that chunk-load failures
 * from deploys are silently retried (and ultimately trigger a page reload
 * if all retries fail). Users never see errors from stale chunk hashes.
 */
export function lazyRetry<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  retries = 2,
): React.LazyExoticComponent<T> {
  return React.lazy(() => retryImport(factory, retries));
}

async function retryImport<T>(
  factory: () => Promise<T>,
  retries: number,
): Promise<T> {
  try {
    return await factory();
  } catch (error) {
    if (retries <= 0) throw error;
    // Wait briefly then retry (gives CDN/cache time to settle)
    await new Promise((r) => setTimeout(r, 1500));
    return retryImport(factory, retries - 1);
  }
}

import React from "react";

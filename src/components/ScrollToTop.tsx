import { useEffect, useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";

const ScrollToTop = () => {
  const { pathname } = useLocation();

  // Disable browser's automatic scroll restoration on back/forward/reload
  useLayoutEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
    // Immediate scroll on very first mount (covers reload)
    window.scrollTo(0, 0);
  }, []);

  // Scroll to top on every route change AND initial mount
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  // Fallback after render in case lazy-loaded content shifts layout
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      window.scrollTo(0, 0);
    });
    // Second fallback: some lazy chunks take longer to mount
    const timeout = setTimeout(() => {
      window.scrollTo(0, 0);
    }, 100);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timeout);
    };
  }, [pathname]);

  return null;
};

export default ScrollToTop;

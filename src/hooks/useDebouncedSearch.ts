import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";

interface UseDebouncedSearchOptions {
  /** URL param name for search query (default: "q") */
  paramName?: string;
  /** Debounce delay in ms (default: 300) */
  delay?: number;
  /** Persist to URL search params */
  persistToUrl?: boolean;
}

interface UseDebouncedSearchReturn {
  /** Current input value (instant) */
  inputValue: string;
  /** Debounced search value (use for API/filter) */
  debouncedValue: string;
  /** Set the input value */
  setInputValue: (value: string) => void;
  /** Clear the search */
  clear: () => void;
}

export function useDebouncedSearch({
  paramName = "q",
  delay = 300,
  persistToUrl = false,
}: UseDebouncedSearchOptions = {}): UseDebouncedSearchReturn {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialValue = persistToUrl ? (searchParams.get(paramName) || "") : "";
  const [inputValue, setInputValue] = useState(initialValue);
  const [debouncedValue, setDebouncedValue] = useState(initialValue);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(inputValue);
      if (persistToUrl) {
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev);
          if (inputValue) {
            next.set(paramName, inputValue);
          } else {
            next.delete(paramName);
          }
          return next;
        }, { replace: true });
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [inputValue, delay, paramName, persistToUrl, setSearchParams]);

  const clear = useCallback(() => {
    setInputValue("");
    setDebouncedValue("");
    if (persistToUrl) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete(paramName);
        return next;
      }, { replace: true });
    }
  }, [paramName, persistToUrl, setSearchParams]);

  return { inputValue, debouncedValue, setInputValue, clear };
}

/** Hook for URL-persisted filter state */
export function useUrlFilter(paramName: string, defaultValue: string = "") {
  const [searchParams, setSearchParams] = useSearchParams();
  const value = searchParams.get(paramName) || defaultValue;

  const setValue = useCallback(
    (newValue: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (newValue && newValue !== defaultValue) {
          next.set(paramName, newValue);
        } else {
          next.delete(paramName);
        }
        return next;
      }, { replace: true });
    },
    [paramName, defaultValue, setSearchParams]
  );

  return [value, setValue] as const;
}

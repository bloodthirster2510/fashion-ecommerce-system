import { useEffect, useRef, useState } from 'react';
import { searchApi, type SuggestResponse } from './searchApi';

export type UseSuggestResult = {
  result: SuggestResponse | null;
  isLoading: boolean;
};

export const useSuggest = (query: string): UseSuggestResult => {
  const [result, setResult] = useState<SuggestResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      abortRef.current?.abort();
      setResult(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const handle = setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      searchApi
        .suggest(trimmed, controller.signal)
        .then((data) => {
          if (controller.signal.aborted) return;
          setResult(data);
        })
        .catch((error: unknown) => {
          if (error instanceof Error && error.name === 'AbortError') return;
          setResult(null);
        })
        .finally(() => {
          if (controller.signal.aborted) return;
          setIsLoading(false);
        });
    }, 300);

    return () => {
      clearTimeout(handle);
      abortRef.current?.abort();
    };
  }, [query]);

  return { result, isLoading };
};

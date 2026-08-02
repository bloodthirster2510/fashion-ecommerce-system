import React from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { getScreenDataInvalidationRevision } from '../config/screenDataCache';

type Options = {
  enabled?: boolean;
  cacheScope?: string;
  runOnDepsChange?: boolean;
  staleMs: number;
};

export type FocusRefreshMode = 'loading' | 'refresh' | 'silent';

export const resolveFocusRefreshMode = <TMode extends Exclude<FocusRefreshMode, 'loading'>>(
  loadedQueryKey: string | null,
  currentQueryKey: string,
  backgroundMode: TMode,
): 'loading' | TMode => (loadedQueryKey === currentQueryKey ? backgroundMode : 'loading');

export const useStaleFocusEffect = (
  callback: () => void | (() => void),
  deps: React.DependencyList,
  { cacheScope, enabled = true, runOnDepsChange = false, staleMs }: Options,
) => {
  const lastRunRef = React.useRef(0);
  const lastDepsRef = React.useRef<React.DependencyList | null>(null);
  const lastCacheRevisionRef = React.useRef<number | null>(null);

  useFocusEffect(
    React.useCallback(() => {
      if (!enabled) return;
      const hasDepsChanged =
        runOnDepsChange &&
        (!lastDepsRef.current ||
          lastDepsRef.current.length !== deps.length ||
          deps.some((dep, index) => !Object.is(dep, lastDepsRef.current?.[index])));
      const cacheRevision = cacheScope ? getScreenDataInvalidationRevision(cacheScope) : 0;
      const hasCacheInvalidation = lastCacheRevisionRef.current !== null
        && lastCacheRevisionRef.current !== cacheRevision;
      const hasNeverRun = lastRunRef.current === 0;

      if (!hasNeverRun && !hasDepsChanged && !hasCacheInvalidation && Date.now() - lastRunRef.current < staleMs) return;
      lastDepsRef.current = deps;
      lastCacheRevisionRef.current = cacheRevision;
      lastRunRef.current = Date.now();
      return callback();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cacheScope, enabled, runOnDepsChange, staleMs, ...deps]),
  );
};

export const markFocusRefetchStale = (ref: React.MutableRefObject<number>) => {
  ref.current = 0;
};

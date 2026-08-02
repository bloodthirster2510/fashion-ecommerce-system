import React from 'react';
import { useFocusEffect } from '@react-navigation/native';

type Options = {
  enabled?: boolean;
  runOnDepsChange?: boolean;
  staleMs: number;
};

export const useStaleFocusEffect = (
  callback: () => void | (() => void),
  deps: React.DependencyList,
  { enabled = true, runOnDepsChange = false, staleMs }: Options,
) => {
  const lastRunRef = React.useRef(0);
  const lastDepsRef = React.useRef<React.DependencyList | null>(null);

  useFocusEffect(
    React.useCallback(() => {
      if (!enabled) return;
      const hasDepsChanged =
        runOnDepsChange &&
        (!lastDepsRef.current ||
          lastDepsRef.current.length !== deps.length ||
          deps.some((dep, index) => !Object.is(dep, lastDepsRef.current?.[index])));

      if (!hasDepsChanged && Date.now() - lastRunRef.current < staleMs) return;
      lastDepsRef.current = deps;
      lastRunRef.current = Date.now();
      return callback();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, runOnDepsChange, staleMs, ...deps]),
  );
};

export const markFocusRefetchStale = (ref: React.MutableRefObject<number>) => {
  ref.current = 0;
};

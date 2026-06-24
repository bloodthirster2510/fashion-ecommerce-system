import React from 'react';
import { useFocusEffect } from '@react-navigation/native';

type Options = {
  enabled?: boolean;
  staleMs: number;
};

export const useStaleFocusEffect = (
  callback: () => void,
  deps: React.DependencyList,
  { enabled = true, staleMs }: Options,
) => {
  const lastRunRef = React.useRef(0);

  useFocusEffect(
    React.useCallback(() => {
      if (!enabled) return;
      if (Date.now() - lastRunRef.current < staleMs) return;
      lastRunRef.current = Date.now();
      callback();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, staleMs, ...deps]),
  );
};

export const markFocusRefetchStale = (ref: React.MutableRefObject<number>) => {
  ref.current = 0;
};
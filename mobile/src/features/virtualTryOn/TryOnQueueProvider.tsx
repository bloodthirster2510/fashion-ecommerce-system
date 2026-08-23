import React from 'react';
import { useAuth } from '../auth/AuthContext';
import { TRY_ON_QUEUE_LIMIT, type TryOnSeedItem } from './virtualTryOn.types';

type AddQueueResult = 'added' | 'exists' | 'full';

type TryOnQueueContextValue = {
  items: TryOnSeedItem[];
  addItem: (item: TryOnSeedItem) => AddQueueResult;
  addItems: (items: TryOnSeedItem[]) => void;
  replaceItems: (items: TryOnSeedItem[]) => void;
  removeItem: (item: TryOnSeedItem) => void;
  hasItem: (item: TryOnSeedItem) => boolean;
  clear: () => void;
};

const TryOnQueueContext = React.createContext<TryOnQueueContextValue | null>(null);

const getTryOnQueueKey = (item: TryOnSeedItem) =>
  `${item.productId}:${item.variantId}:${item.colorVariantId}:${item.size ?? ''}`;

export const mergeTryOnQueueItems = (current: TryOnSeedItem[], incoming: TryOnSeedItem[]) => {
  const next = [...current];
  const existingKeys = new Set(current.map(getTryOnQueueKey));

  for (const item of incoming) {
    const key = getTryOnQueueKey(item);
    if (existingKeys.has(key)) continue;
    if (next.length >= TRY_ON_QUEUE_LIMIT) break;
    next.push(item);
    existingKeys.add(key);
  }

  return next;
};

export const TryOnQueueProvider = ({ children }: { children: React.ReactNode }) => {
  const { session } = useAuth();
  const accountId = session?.user?._id ?? null;
  const previousAccountIdRef = React.useRef(accountId);
  const itemsRef = React.useRef<TryOnSeedItem[]>([]);
  const [items, setItems] = React.useState<TryOnSeedItem[]>([]);

  const commit = React.useCallback((next: TryOnSeedItem[]) => {
    itemsRef.current = next;
    setItems(next);
  }, []);

  React.useEffect(() => {
    if (previousAccountIdRef.current === accountId) return;
    previousAccountIdRef.current = accountId;
    commit([]);
  }, [accountId, commit]);

  const addItem = React.useCallback((item: TryOnSeedItem): AddQueueResult => {
    const key = getTryOnQueueKey(item);
    if (itemsRef.current.some((entry) => getTryOnQueueKey(entry) === key)) return 'exists';
    if (itemsRef.current.length >= TRY_ON_QUEUE_LIMIT) return 'full';
    commit([...itemsRef.current, item]);
    return 'added';
  }, [commit]);

  const addItems = React.useCallback((incoming: TryOnSeedItem[]) => {
    const next = mergeTryOnQueueItems(itemsRef.current, incoming);
    if (next.length !== itemsRef.current.length) commit(next);
  }, [commit]);

  const replaceItems = React.useCallback((incoming: TryOnSeedItem[]) => {
    commit(mergeTryOnQueueItems([], incoming));
  }, [commit]);

  const removeItem = React.useCallback((item: TryOnSeedItem) => {
    const key = getTryOnQueueKey(item);
    commit(itemsRef.current.filter((entry) => getTryOnQueueKey(entry) !== key));
  }, [commit]);

  const hasItem = React.useCallback((item: TryOnSeedItem) => {
    const key = getTryOnQueueKey(item);
    return itemsRef.current.some((entry) => getTryOnQueueKey(entry) === key);
  }, []);

  const clear = React.useCallback(() => commit([]), [commit]);

  const value = React.useMemo<TryOnQueueContextValue>(() => ({
    items,
    addItem,
    addItems,
    replaceItems,
    removeItem,
    hasItem,
    clear,
  }), [addItem, addItems, clear, hasItem, items, removeItem, replaceItems]);

  return <TryOnQueueContext.Provider value={value}>{children}</TryOnQueueContext.Provider>;
};

export const useTryOnQueue = () => {
  const context = React.useContext(TryOnQueueContext);
  if (!context) throw new Error('useTryOnQueue must be used inside TryOnQueueProvider');
  return context;
};

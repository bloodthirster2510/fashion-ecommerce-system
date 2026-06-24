import React from 'react';
import { AppState } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { notificationApi, type CustomerNotificationSummary } from './notificationApi';

type CustomerNotificationContextValue = {
  summary: CustomerNotificationSummary | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

const CustomerNotificationContext = React.createContext<CustomerNotificationContextValue | null>(null);
const POLL_INTERVAL_MS = 90_000;

export const CustomerNotificationProvider = ({ children }: { children: React.ReactNode }) => {
  const { isRestoringSession, runWithAuth, session } = useAuth();
  const [summary, setSummary] = React.useState<CustomerNotificationSummary | null>(null);
  const [loading, setLoading] = React.useState(false);
  const requestSequence = React.useRef(0);

  const refresh = React.useCallback(async () => {
    if (!session?.accessToken || isRestoringSession) {
      setSummary(null);
      return;
    }

    const sequence = requestSequence.current + 1;
    requestSequence.current = sequence;
    setLoading(true);

    try {
      const nextSummary = await runWithAuth((token) => notificationApi.getSummary(token));
      if (requestSequence.current !== sequence) return;
      setSummary((prev) => {
        if (prev && nextSummary && prev.total === nextSummary.total && prev.support.total === nextSummary.support.total) {
          return prev;
        }
        return nextSummary;
      });
    } catch {
      // Keep the last good summary during short network interruptions.
    } finally {
      if (requestSequence.current === sequence) setLoading(false);
    }
  }, [isRestoringSession, runWithAuth, session?.accessToken]);

  React.useEffect(() => {
    if (!session?.accessToken || isRestoringSession) {
      requestSequence.current += 1;
      setSummary(null);
      setLoading(false);
      return;
    }

    void refresh();
    const intervalId = setInterval(() => void refresh(), POLL_INTERVAL_MS);
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });

    return () => {
      clearInterval(intervalId);
      appStateSubscription.remove();
      requestSequence.current += 1;
    };
  }, [isRestoringSession, refresh, session?.accessToken]);

  const value = React.useMemo(() => ({ summary, loading, refresh }), [loading, refresh, summary]);

  return (
    <CustomerNotificationContext.Provider value={value}>
      {children}
    </CustomerNotificationContext.Provider>
  );
};

export const useCustomerNotifications = () => {
  const context = React.useContext(CustomerNotificationContext);
  if (!context) throw new Error('useCustomerNotifications must be used inside CustomerNotificationProvider');
  return context;
};

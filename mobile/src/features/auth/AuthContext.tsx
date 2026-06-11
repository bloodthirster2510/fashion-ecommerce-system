import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { authApi } from './authApi';
import type { AuthSession, SessionUser } from './types';

type AuthContextType = {
  isAuthenticated: boolean;
  isRestoringSession: boolean;
  session: AuthSession | null;
  login: (session: AuthSession) => void;
  updateSessionUser: (user: Partial<SessionUser>) => void;
  runWithAuth: <T>(action: (accessToken: string) => Promise<T>) => Promise<T>;
  logout: () => void;
};

const AUTH_SESSION_STORAGE_KEY = 'fashionista.authSession';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const isUnauthorizedError = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'status' in error &&
  (error as { status?: number }).status === 401;

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  const sessionRef = React.useRef<AuthSession | null>(null);
  const refreshPromiseRef = React.useRef<Promise<{ accessToken: string; refreshToken: string }> | null>(null);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    let isMounted = true;

    const restoreSession = async () => {
      try {
        const rawSession = await SecureStore.getItemAsync(AUTH_SESSION_STORAGE_KEY);
        if (!isMounted || !rawSession) return;

        const restoredSession = JSON.parse(rawSession) as AuthSession;
        sessionRef.current = restoredSession;
        setSession(restoredSession);
      } catch {
        await SecureStore.deleteItemAsync(AUTH_SESSION_STORAGE_KEY).catch(() => undefined);
      } finally {
        if (isMounted) setIsRestoringSession(false);
      }
    };

    restoreSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const persistSession = React.useCallback((nextSession: AuthSession | null) => {
    const task = nextSession
      ? SecureStore.setItemAsync(AUTH_SESSION_STORAGE_KEY, JSON.stringify(nextSession))
      : SecureStore.deleteItemAsync(AUTH_SESSION_STORAGE_KEY);

    task.catch(() => undefined);
  }, []);

  const login = React.useCallback((newSession: AuthSession) => {
    sessionRef.current = newSession;
    setSession(newSession);
    persistSession(newSession);
  }, [persistSession]);

  const logout = React.useCallback(() => {
    sessionRef.current = null;
    setSession(null);
    persistSession(null);
  }, [persistSession]);

  const updateSessionUser = React.useCallback((user: Partial<SessionUser>) => {
    setSession((current) => {
      if (!current) return current;

      const nextSession = {
        ...current,
        user: {
          ...current.user,
          ...user,
        },
      };

      sessionRef.current = nextSession;
      persistSession(nextSession);
      return nextSession;
    });
  }, [persistSession]);

  const runWithAuth = React.useCallback(
    async <T,>(action: (accessToken: string) => Promise<T>): Promise<T> => {
      const currentSession = sessionRef.current;

      if (!currentSession) {
        throw new Error('Vui lòng đăng nhập để tiếp tục.');
      }

      try {
        return await action(currentSession.accessToken);
      } catch (error) {
        if (!isUnauthorizedError(error)) {
          throw error;
        }

        const latestSession = sessionRef.current;
        if (latestSession && latestSession.accessToken !== currentSession.accessToken) {
          return await action(latestSession.accessToken);
        }

        try {
          if (!refreshPromiseRef.current) {
            refreshPromiseRef.current = authApi.refreshToken(currentSession.refreshToken).finally(() => {
              refreshPromiseRef.current = null;
            });
          }

          const nextTokens = await refreshPromiseRef.current;
          const nextSession = {
            ...currentSession,
            accessToken: nextTokens.accessToken,
            refreshToken: nextTokens.refreshToken,
          };

          sessionRef.current = nextSession;
          setSession(nextSession);
          persistSession(nextSession);

          return await action(nextTokens.accessToken);
        } catch (refreshError) {
          sessionRef.current = null;
          setSession(null);
          persistSession(null);

          throw refreshError instanceof Error
            ? refreshError
            : new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
        }
      }
    },
    [persistSession],
  );

  const value = React.useMemo(
    () => ({
      isAuthenticated: !!session,
      isRestoringSession,
      session,
      login,
      updateSessionUser,
      runWithAuth,
      logout,
    }),
    [isRestoringSession, login, logout, runWithAuth, session, updateSessionUser],
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

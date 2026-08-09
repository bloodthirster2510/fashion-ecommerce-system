import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { authApi } from './authApi';
import { sessionStorage } from './sessionStorage';
import type { AuthSession, SessionUser } from './types';
import { clearUserScopedCaches } from '../../config/cacheInvalidation';

type AuthContextType = {
  isAuthenticated: boolean;
  isRestoringSession: boolean;
  session: AuthSession | null;
  login: (session: AuthSession) => Promise<void>;
  updateSessionUser: (user: Partial<SessionUser>) => void;
  runWithAuth: <T>(action: (accessToken: string) => Promise<T>) => Promise<T>;
  logout: () => Promise<void>;
};

const AUTH_SESSION_STORAGE_KEY = 'fashionista.authSession';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const isUnauthorizedError = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'status' in error &&
  (error as { status?: number }).status === 401;

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const parseStoredSession = (rawSession: string): AuthSession => {
  const parsed = JSON.parse(rawSession) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Stored auth session is invalid');
  }

  const candidate = parsed as Partial<AuthSession>;
  const user = candidate.user;
  if (
    !isNonEmptyString(candidate.accessToken)
    || !isNonEmptyString(candidate.refreshToken)
    || !user
    || typeof user !== 'object'
    || !isNonEmptyString(user._id)
    || !isNonEmptyString(user.name)
    || !isNonEmptyString(user.email)
    || typeof user.phone !== 'string'
    || !isNonEmptyString(user.role)
    || typeof user.profileCompleted !== 'boolean'
    || typeof user.mustChangePassword !== 'boolean'
  ) {
    throw new Error('Stored auth session is invalid');
  }

  return candidate as AuthSession;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  const sessionRef = React.useRef<AuthSession | null>(null);
  const refreshPromiseRef = React.useRef<Promise<{ accessToken: string; refreshToken: string }> | null>(null);
  const sessionEpochRef = React.useRef(0);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    let isMounted = true;
    const restoreEpoch = sessionEpochRef.current;

    const restoreSession = async () => {
      try {
        const rawSession = await sessionStorage.getItemAsync(AUTH_SESSION_STORAGE_KEY);
        if (!isMounted || !rawSession || sessionEpochRef.current !== restoreEpoch) return;

        const restoredSession = parseStoredSession(rawSession);
        sessionEpochRef.current += 1;
        sessionRef.current = restoredSession;
        setSession(restoredSession);
      } catch {
        await sessionStorage.deleteItemAsync(AUTH_SESSION_STORAGE_KEY).catch(() => undefined);
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
    return nextSession
      ? sessionStorage.setItemAsync(AUTH_SESSION_STORAGE_KEY, JSON.stringify(nextSession))
      : sessionStorage.deleteItemAsync(AUTH_SESSION_STORAGE_KEY);
  }, []);

  const login = React.useCallback(async (newSession: AuthSession) => {
    await persistSession(newSession);
    clearUserScopedCaches();
    sessionEpochRef.current += 1;
    sessionRef.current = newSession;
    setSession(newSession);
  }, [persistSession]);

  const logout = React.useCallback(async () => {
    const currentSession = sessionRef.current;
    sessionEpochRef.current += 1;
    sessionRef.current = null;
    setSession(null);
    clearUserScopedCaches();

    const operations: Promise<unknown>[] = [persistSession(null)];
    if (currentSession) {
      operations.push(authApi.logout(currentSession.accessToken, currentSession.refreshToken));
    }
    await Promise.allSettled(operations);
  }, [persistSession]);

  const updateSessionUser = React.useCallback((user: Partial<SessionUser>) => {
    const currentSession = sessionRef.current;
    if (!currentSession) return;

    const nextSession = {
      ...currentSession,
      user: {
        ...currentSession.user,
        ...user,
      },
    };

    sessionRef.current = nextSession;
    setSession(nextSession);
    persistSession(nextSession).catch(() => undefined);
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

        const refreshEpoch = sessionEpochRef.current;
        try {
          const refreshSession = sessionRef.current;

          if (!refreshSession) {
            throw new Error('Vui lòng đăng nhập để tiếp tục.');
          }
          if (!refreshPromiseRef.current) {
            refreshPromiseRef.current = authApi.refreshToken(refreshSession.refreshToken).finally(() => {
              refreshPromiseRef.current = null;
            });
          }

          const nextTokens = await refreshPromiseRef.current;
          if (sessionEpochRef.current !== refreshEpoch || !sessionRef.current) {
            authApi.logout(nextTokens.accessToken, nextTokens.refreshToken).catch(() => undefined);
            throw new Error('Phiên đăng nhập đã thay đổi. Vui lòng đăng nhập lại.');
          }
          const baseSession = sessionRef.current ?? refreshSession;
          const nextSession = {
            ...baseSession,
            accessToken: nextTokens.accessToken,
            refreshToken: nextTokens.refreshToken,
          };

          await persistSession(nextSession);
          if (sessionEpochRef.current !== refreshEpoch || !sessionRef.current) {
            await persistSession(sessionRef.current).catch(() => undefined);
            authApi.logout(nextTokens.accessToken, nextTokens.refreshToken).catch(() => undefined);
            throw new Error('Phiên đăng nhập đã thay đổi. Vui lòng đăng nhập lại.');
          }
          sessionRef.current = nextSession;
          setSession(nextSession);

          return await action(nextTokens.accessToken);
        } catch (refreshError) {
          if (sessionEpochRef.current === refreshEpoch) {
            sessionEpochRef.current += 1;
            sessionRef.current = null;
            setSession(null);
            clearUserScopedCaches();
            persistSession(null).catch(() => undefined);
          }

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

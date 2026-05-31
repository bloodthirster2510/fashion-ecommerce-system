import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import type { AuthSession, SessionUser } from './types';

type AuthContextType = {
  isAuthenticated: boolean;
  isRestoringSession: boolean;
  session: AuthSession | null;
  login: (session: AuthSession) => void;
  updateSessionUser: (user: Partial<SessionUser>) => void;
  logout: () => void;
};

const AUTH_SESSION_STORAGE_KEY = 'fashionista.authSession';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isRestoringSession, setIsRestoringSession] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const restoreSession = async () => {
      try {
        const rawSession = await SecureStore.getItemAsync(AUTH_SESSION_STORAGE_KEY);
        if (!isMounted || !rawSession) return;

        setSession(JSON.parse(rawSession) as AuthSession);
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

  const persistSession = (nextSession: AuthSession | null) => {
    const task = nextSession
      ? SecureStore.setItemAsync(AUTH_SESSION_STORAGE_KEY, JSON.stringify(nextSession))
      : SecureStore.deleteItemAsync(AUTH_SESSION_STORAGE_KEY);

    task.catch(() => undefined);
  };

  const login = (newSession: AuthSession) => {
    setSession(newSession);
    persistSession(newSession);
  };

  const logout = () => {
    setSession(null);
    persistSession(null);
  };

  const updateSessionUser = (user: Partial<SessionUser>) => {
    setSession((current) => {
      if (!current) return current;

      const nextSession = {
        ...current,
        user: {
          ...current.user,
          ...user,
        },
      };

      persistSession(nextSession);
      return nextSession;
    });
  };

  return (
    <AuthContext.Provider
      value={{ isAuthenticated: !!session, isRestoringSession, session, login, updateSessionUser, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

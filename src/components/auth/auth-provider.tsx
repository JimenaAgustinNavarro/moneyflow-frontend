'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { onSessionExpired } from '@/lib/api-client';
import { getMe, logout as logoutRequest } from '@/lib/auth-api';
import type { AuthUser } from '@/types/auth';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
}

export interface AuthContextValue extends AuthState {
  refreshUser: () => Promise<void>;
  setAuthenticatedUser: (user: AuthUser) => void;
  logout: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const router = useRouter();
  const [authState, setAuthState] = React.useState<AuthState>({
    status: 'loading',
    user: null,
  });

  // Contador monotónico para descartar respuestas obsoletas de refreshUser()
  const requestEpochRef = React.useRef<number>(0);

  const refreshUser = React.useCallback(async (): Promise<void> => {
    const currentEpoch = ++requestEpochRef.current;

    try {
      const response = await getMe();
      if (currentEpoch !== requestEpochRef.current) {
        return;
      }
      setAuthState({
        status: 'authenticated',
        user: response.user,
      });
    } catch {
      if (currentEpoch !== requestEpochRef.current) {
        return;
      }
      setAuthState({
        status: 'unauthenticated',
        user: null,
      });
    }
  }, []);

  const setAuthenticatedUser = React.useCallback((user: AuthUser): void => {
    requestEpochRef.current += 1;
    setAuthState({
      status: 'authenticated',
      user,
    });
  }, []);

  const logout = React.useCallback(async (): Promise<void> => {
    requestEpochRef.current += 1;
    try {
      await logoutRequest();
    } catch {
      // Garantizar limpieza local de sesión aunque la petición de logout falle
    } finally {
      setAuthState({
        status: 'unauthenticated',
        user: null,
      });
      router.replace('/login');
    }
  }, [router]);

  React.useEffect(() => {
    void refreshUser();

    const unsubscribe = onSessionExpired(() => {
      requestEpochRef.current += 1;
      setAuthState({
        status: 'unauthenticated',
        user: null,
      });
    });

    return unsubscribe;
  }, [refreshUser]);

  const contextValue = React.useMemo<AuthContextValue>(
    () => ({
      ...authState,
      refreshUser,
      setAuthenticatedUser,
      logout,
    }),
    [authState, refreshUser, setAuthenticatedUser, logout],
  );

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de un AuthProvider.');
  }
  return context;
}

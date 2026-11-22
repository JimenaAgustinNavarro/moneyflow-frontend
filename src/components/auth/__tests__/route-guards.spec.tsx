import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ProtectedRoute, GuestOnlyRoute } from '../route-guards';
import type { AuthStatus } from '../auth-provider';

const replaceMock = vi.fn();
let mockAuthStatus: AuthStatus = 'loading';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: replaceMock,
    push: vi.fn(),
  }),
}));

vi.mock('../auth-provider', () => ({
  useAuth: () => ({
    status: mockAuthStatus,
    user: null,
    refreshUser: vi.fn(),
    setAuthenticatedUser: vi.fn(),
    logout: vi.fn(),
  }),
}));

describe('Route Guards (ProtectedRoute & GuestOnlyRoute)', () => {
  beforeEach(() => {
    replaceMock.mockReset();
    mockAuthStatus = 'loading';
  });

  describe('ProtectedRoute', () => {
    it('muestra estado de carga y NO renderiza contenido privado mientras status === "loading"', () => {
      mockAuthStatus = 'loading';

      render(
        <ProtectedRoute>
          <div>Contenido Privado</div>
        </ProtectedRoute>,
      );

      expect(screen.queryByText('Contenido Privado')).not.toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent('Verificando sesión...');
      expect(replaceMock).not.toHaveBeenCalled();
    });

    it('no renderiza contenido privado y redirige a /login cuando status === "unauthenticated"', async () => {
      mockAuthStatus = 'unauthenticated';

      render(
        <ProtectedRoute>
          <div>Contenido Privado</div>
        </ProtectedRoute>,
      );

      expect(screen.queryByText('Contenido Privado')).not.toBeInTheDocument();
      await waitFor(() => {
        expect(replaceMock).toHaveBeenCalledWith('/login');
      });
    });

    it('renderiza children cuando status === "authenticated"', () => {
      mockAuthStatus = 'authenticated';

      render(
        <ProtectedRoute>
          <div>Contenido Privado</div>
        </ProtectedRoute>,
      );

      expect(screen.getByText('Contenido Privado')).toBeInTheDocument();
      expect(replaceMock).not.toHaveBeenCalled();
    });
  });

  describe('GuestOnlyRoute', () => {
    it('no renderiza formulario ni redirige mientras status === "loading"', () => {
      mockAuthStatus = 'loading';

      render(
        <GuestOnlyRoute>
          <div>Formulario Login</div>
        </GuestOnlyRoute>,
      );

      expect(screen.queryByText('Formulario Login')).not.toBeInTheDocument();
      expect(replaceMock).not.toHaveBeenCalled();
    });

    it('no renderiza children y redirige a /dashboard cuando status === "authenticated"', async () => {
      mockAuthStatus = 'authenticated';

      render(
        <GuestOnlyRoute>
          <div>Formulario Login</div>
        </GuestOnlyRoute>,
      );

      expect(screen.queryByText('Formulario Login')).not.toBeInTheDocument();
      await waitFor(() => {
        expect(replaceMock).toHaveBeenCalledWith('/dashboard');
      });
    });

    it('renderiza children cuando status === "unauthenticated"', () => {
      mockAuthStatus = 'unauthenticated';

      render(
        <GuestOnlyRoute>
          <div>Formulario Login</div>
        </GuestOnlyRoute>,
      );

      expect(screen.getByText('Formulario Login')).toBeInTheDocument();
      expect(replaceMock).not.toHaveBeenCalled();
    });
  });
});

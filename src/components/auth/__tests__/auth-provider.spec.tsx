import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import { AuthProvider, useAuth } from '../auth-provider';
import { ApiError } from '@/lib/api-client';
import type { AuthUser } from '@/types/auth';

const replaceMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: replaceMock,
    push: vi.fn(),
  }),
}));

const USER_FIXTURE: AuthUser = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  email: 'ana.perez@moneyflow.pe',
  fullName: 'Ana Pérez',
  preferredCurrency: 'PEN',
  timezone: 'America/Lima',
  emailVerifiedAt: '2026-11-22T05:10:00.000Z',
  isActive: true,
  createdAt: '2026-11-22T05:00:00.000Z',
};

function TestConsumer(): React.JSX.Element {
  const { status, user, logout, setAuthenticatedUser } = useAuth();
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="user-email">{user ? user.email : 'none'}</span>
      <button type="button" onClick={() => void logout()}>
        Logout
      </button>
      <button
        type="button"
        onClick={() =>
          setAuthenticatedUser({ ...USER_FIXTURE, email: 'manual@moneyflow.pe' })
        }
      >
        SetManual
      </button>
    </div>
  );
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    replaceMock.mockReset();
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3000';
  });

  it('hidrata inicialmente vía GET /api/v1/auth/me y pasa de loading a authenticated', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ user: USER_FIXTURE }),
    } as Response);

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    expect(screen.getByTestId('status').textContent).toBe('loading');

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('authenticated');
    });
    expect(screen.getByTestId('user-email').textContent).toBe('ana.perez@moneyflow.pe');
  });

  it('transiciona limpiamente a unauthenticated cuando GET /auth/me falla', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new ApiError(401, 'Unauthorized', 'No session'));

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('unauthenticated');
    });
    expect(screen.getByTestId('user-email').textContent).toBe('none');
  });

  it('limpia el estado cuando api-client notifica sesión expirada (401 en refresh)', async () => {
    let callIdx = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      callIdx += 1;
      if (callIdx === 1 && url.endsWith('/api/v1/auth/me')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ user: USER_FIXTURE }),
        } as Response;
      }
      return {
        ok: false,
        status: 401,
        json: async () => ({
          statusCode: 401,
          error: 'Unauthorized',
          message: 'Expired',
          timestamp: '2026-11-22T05:00:00.000Z',
          path: url,
        }),
      } as Response;
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('authenticated');
    });

    const { fetchFromApi } = await import('@/lib/api-client');
    await act(async () => {
      await expect(fetchFromApi('/api/v1/funds')).rejects.toThrow(ApiError);
    });

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('unauthenticated');
    });
  });

  it('descarta respuestas obsoletas de refreshUser() si ocurrió setAuthenticatedUser() más reciente', async () => {
    let resolveMe!: (value: Response) => void;
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          resolveMe = resolve;
        }),
    );

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    fireEvent.click(screen.getByText('SetManual'));
    expect(screen.getByTestId('status').textContent).toBe('authenticated');
    expect(screen.getByTestId('user-email').textContent).toBe('manual@moneyflow.pe');

    await act(async () => {
      resolveMe({
        ok: true,
        status: 200,
        json: async () => ({ user: USER_FIXTURE }),
      } as Response);
    });

    expect(screen.getByTestId('user-email').textContent).toBe('manual@moneyflow.pe');
  });

  it('logout() llama a POST /api/v1/auth/logout, limpia usuario y navega a /login', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ user: USER_FIXTURE }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ message: 'Logged out successfully.' }),
      } as Response);

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('authenticated');
    });

    fireEvent.click(screen.getByText('Logout'));

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('unauthenticated');
    });
    expect(fetchSpy).toHaveBeenLastCalledWith(
      'http://localhost:3000/api/v1/auth/logout',
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
    expect(replaceMock).toHaveBeenCalledWith('/login');
  });
});

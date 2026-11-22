import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import LoginPage from '../page';
import { ApiError } from '@/lib/api-client';
import * as authApi from '@/lib/auth-api';

const replaceMock = vi.fn();
const setAuthenticatedUserMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: replaceMock,
    push: vi.fn(),
  }),
}));

vi.mock('next-themes', () => ({
  useTheme: () => ({
    theme: 'light',
    setTheme: vi.fn(),
  }),
}));

vi.mock('@/components/auth/auth-provider', () => ({
  useAuth: () => ({
    status: 'unauthenticated',
    user: null,
    refreshUser: vi.fn(),
    setAuthenticatedUser: setAuthenticatedUserMock,
    logout: vi.fn(),
  }),
}));

vi.mock('@/lib/auth-api', () => ({
  login: vi.fn(),
  resendVerification: vi.fn(),
}));

describe('LoginPage (/login)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('valida campos en tiempo real antes de enviar', async () => {
    render(<LoginPage />);

    fireEvent.click(screen.getByRole('button', { name: /iniciar sesión/i }));

    await waitFor(() => {
      expect(screen.getByText(/correo electrónico es obligatorio/i)).toBeInTheDocument();
      expect(screen.getByText(/contraseña es obligatoria/i)).toBeInTheDocument();
    });
    expect(authApi.login).not.toHaveBeenCalled();
  });

  it('inicia sesión con éxito, actualiza AuthProvider y navega a /dashboard', async () => {
    const mockUser = {
      id: 'user-1',
      email: 'ana@moneyflow.pe',
      fullName: 'Ana Pérez',
      preferredCurrency: 'PEN',
      timezone: 'America/Lima',
      emailVerifiedAt: '2026-11-22T00:00:00.000Z',
      isActive: true,
      createdAt: '2026-11-22T00:00:00.000Z',
    };
    vi.mocked(authApi.login).mockResolvedValueOnce({
      user: mockUser,
      message: 'Login successful.',
    });

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/correo electrónico/i), {
      target: { value: 'ANA@moneyflow.pe' },
    });
    fireEvent.change(screen.getByLabelText(/^contraseña$/i), {
      target: { value: 'Password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /iniciar sesión/i }));

    await waitFor(() => {
      expect(authApi.login).toHaveBeenCalledWith({
        email: 'ana@moneyflow.pe',
        password: 'Password123',
      });
      expect(setAuthenticatedUserMock).toHaveBeenCalledWith(mockUser);
      expect(replaceMock).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('muestra error claro ante 401 y 429', async () => {
    vi.mocked(authApi.login).mockRejectedValueOnce(
      new ApiError(401, 'Unauthorized', 'Invalid email or password'),
    );

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/correo electrónico/i), {
      target: { value: 'ana@moneyflow.pe' },
    });
    fireEvent.change(screen.getByLabelText(/^contraseña$/i), {
      target: { value: 'WrongPass1' },
    });
    fireEvent.click(screen.getByRole('button', { name: /iniciar sesión/i }));

    await waitFor(() => {
      expect(screen.getByText(/correo o contraseña inválidos/i)).toBeInTheDocument();
    });

    vi.mocked(authApi.login).mockRejectedValueOnce(
      new ApiError(429, 'Too Many Requests', 'ThrottlerException'),
    );
    fireEvent.click(screen.getByRole('button', { name: /iniciar sesión/i }));

    await waitFor(() => {
      expect(screen.getByText(/demasiados intentos/i)).toBeInTheDocument();
    });
  });

  it('ante 403 EMAIL_NOT_VERIFIED muestra banner con botón para reenviar verificación', async () => {
    vi.mocked(authApi.login).mockRejectedValueOnce(
      new ApiError(403, 'Forbidden', 'Email not verified', undefined, undefined, 'EMAIL_NOT_VERIFIED'),
    );
    vi.mocked(authApi.resendVerification).mockResolvedValueOnce({
      message: 'Verification email sent',
    });

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/correo electrónico/i), {
      target: { value: 'ana@moneyflow.pe' },
    });
    fireEvent.change(screen.getByLabelText(/^contraseña$/i), {
      target: { value: 'Password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /iniciar sesión/i }));

    const resendBtn = await screen.findByRole('button', {
      name: /reenviar correo de verificación/i,
    });
    fireEvent.click(resendBtn);

    await waitFor(() => {
      expect(authApi.resendVerification).toHaveBeenCalledWith({
        email: 'ana@moneyflow.pe',
      });
      expect(screen.getByText(/enviado un nuevo enlace de activación/i)).toBeInTheDocument();
    });
  });
});

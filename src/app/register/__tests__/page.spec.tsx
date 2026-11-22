import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import RegisterPage from '../page';
import { ApiError } from '@/lib/api-client';
import * as authApi from '@/lib/auth-api';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: vi.fn(),
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
    setAuthenticatedUser: vi.fn(),
    logout: vi.fn(),
  }),
}));

vi.mock('@/lib/auth-api', () => ({
  register: vi.fn(),
  resendVerification: vi.fn(),
}));

describe('RegisterPage (/register)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('envía { fullName, email, password } sin confirmPassword y muestra confirmación 201', async () => {
    vi.mocked(authApi.register).mockResolvedValueOnce({
      user: {
        id: 'user-1',
        email: 'ana@moneyflow.pe',
        fullName: 'Ana Pérez',
        preferredCurrency: 'PEN',
        timezone: 'America/Lima',
        emailVerifiedAt: null,
        isActive: true,
        createdAt: '2026-11-22T00:00:00.000Z',
      },
      emailVerificationRequired: true,
      message: 'Registered',
    });

    render(<RegisterPage />);

    fireEvent.change(screen.getByLabelText(/nombre completo/i), {
      target: { value: 'Ana Pérez' },
    });
    fireEvent.change(screen.getByLabelText(/correo electrónico/i), {
      target: { value: 'ana@moneyflow.pe' },
    });
    fireEvent.change(screen.getByLabelText(/^contraseña$/i), {
      target: { value: 'Password123' },
    });
    fireEvent.change(screen.getByLabelText(/confirmar contraseña/i), {
      target: { value: 'Password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /crear cuenta/i }));

    await waitFor(() => {
      expect(authApi.register).toHaveBeenCalledTimes(1);
      const payload = vi.mocked(authApi.register).mock.calls[0]?.[0];
      expect(payload).toEqual({
        fullName: 'Ana Pérez',
        email: 'ana@moneyflow.pe',
        password: 'Password123',
      });
      expect(payload).not.toHaveProperty('confirmPassword');
      expect(screen.getByText(/revisa tu correo electrónico/i)).toBeInTheDocument();
    });
  });

  it('maneja 409 Conflict y 429 Too Many Requests', async () => {
    vi.mocked(authApi.register).mockRejectedValueOnce(
      new ApiError(409, 'Conflict', 'Email already exists'),
    );

    render(<RegisterPage />);

    fireEvent.change(screen.getByLabelText(/nombre completo/i), {
      target: { value: 'Ana Pérez' },
    });
    fireEvent.change(screen.getByLabelText(/correo electrónico/i), {
      target: { value: 'ana@moneyflow.pe' },
    });
    fireEvent.change(screen.getByLabelText(/^contraseña$/i), {
      target: { value: 'Password123' },
    });
    fireEvent.change(screen.getByLabelText(/confirmar contraseña/i), {
      target: { value: 'Password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /crear cuenta/i }));

    await waitFor(() => {
      expect(screen.getByText(/ya existe una cuenta registrada/i)).toBeInTheDocument();
    });

    vi.mocked(authApi.register).mockRejectedValueOnce(
      new ApiError(429, 'Too Many Requests', 'Rate limit exceeded'),
    );
    fireEvent.click(screen.getByRole('button', { name: /crear cuenta/i }));

    await waitFor(() => {
      expect(screen.getByText(/demasiados intentos de registro/i)).toBeInTheDocument();
    });
  });
});

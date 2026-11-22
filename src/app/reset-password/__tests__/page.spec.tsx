import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ResetPasswordPage from '../page';
import { ApiError } from '@/lib/api-client';
import * as authApi from '@/lib/auth-api';

let mockTokenParam: string | null = null;
const refreshUserMock = vi.fn();
let mockAuthStatus = 'unauthenticated';

vi.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: (key: string) => (key === 'token' ? mockTokenParam : null),
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
    status: mockAuthStatus,
    refreshUser: refreshUserMock,
  }),
}));

vi.mock('@/lib/auth-api', () => ({
  resetPassword: vi.fn(),
}));

describe('ResetPasswordPage (/reset-password)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTokenParam = null;
    mockAuthStatus = 'unauthenticated';
  });

  it('si falta token muestra error controlado con enlace a /forgot-password sin formulario roto', () => {
    mockTokenParam = null;

    render(<ResetPasswordPage />);

    expect(screen.getByText(/token ausente o inválido/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /solicitar nuevo enlace/i })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
    expect(screen.queryByRole('button', { name: /restablecer contraseña/i })).not.toBeInTheDocument();
  });

  it('envía { token, newPassword } sin confirmPassword y muestra éxito 200', async () => {
    mockTokenParam = 'reset-token-123';
    vi.mocked(authApi.resetPassword).mockResolvedValueOnce({
      message: 'Password reset successfully.',
    });

    render(<ResetPasswordPage />);

    fireEvent.change(screen.getByLabelText(/^nueva contraseña$/i), {
      target: { value: 'NewPassword1' },
    });
    fireEvent.change(screen.getByLabelText(/confirmar nueva contraseña/i), {
      target: { value: 'NewPassword1' },
    });
    fireEvent.click(screen.getByRole('button', { name: /restablecer contraseña/i }));

    await waitFor(() => {
      expect(authApi.resetPassword).toHaveBeenCalledTimes(1);
      const payload = vi.mocked(authApi.resetPassword).mock.calls[0]?.[0];
      expect(payload).toEqual({
        token: 'reset-token-123',
        newPassword: 'NewPassword1',
      });
      expect(payload).not.toHaveProperty('confirmPassword');
      expect(screen.getByText(/contraseña actualizada/i)).toBeInTheDocument();
      expect(refreshUserMock).not.toHaveBeenCalled();
    });
  });

  it('si el usuario estaba autenticado, ejecuta refreshUser al restablecer la contraseña', async () => {
    mockTokenParam = 'reset-token-auth';
    mockAuthStatus = 'authenticated';
    vi.mocked(authApi.resetPassword).mockResolvedValueOnce({
      message: 'Password reset successfully.',
    });

    render(<ResetPasswordPage />);

    fireEvent.change(screen.getByLabelText(/^nueva contraseña$/i), {
      target: { value: 'NewPassword1' },
    });
    fireEvent.change(screen.getByLabelText(/confirmar nueva contraseña/i), {
      target: { value: 'NewPassword1' },
    });
    fireEvent.click(screen.getByRole('button', { name: /restablecer contraseña/i }));

    await waitFor(() => {
      expect(authApi.resetPassword).toHaveBeenCalledTimes(1);
      expect(refreshUserMock).toHaveBeenCalledTimes(1);
      expect(screen.getByText(/contraseña actualizada/i)).toBeInTheDocument();
    });
  });

  it('muestra error claro ante 400 (token expirado/inválido)', async () => {
    mockTokenParam = 'expired-reset-token';
    vi.mocked(authApi.resetPassword).mockRejectedValueOnce(
      new ApiError(400, 'Bad Request', 'Invalid or expired reset token'),
    );

    render(<ResetPasswordPage />);

    fireEvent.change(screen.getByLabelText(/^nueva contraseña$/i), {
      target: { value: 'NewPassword1' },
    });
    fireEvent.change(screen.getByLabelText(/confirmar nueva contraseña/i), {
      target: { value: 'NewPassword1' },
    });
    fireEvent.click(screen.getByRole('button', { name: /restablecer contraseña/i }));

    await waitFor(() => {
      expect(screen.getByText(/enlace de restablecimiento es inválido o ha expirado/i)).toBeInTheDocument();
    });
  });
});

import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ForgotPasswordPage from '../page';
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
  forgotPassword: vi.fn(),
}));

describe('ForgotPasswordPage (/forgot-password)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('envía email y muestra mensaje genérico de confirmación tras 200', async () => {
    vi.mocked(authApi.forgotPassword).mockResolvedValueOnce({
      message: 'If the email exists, instructions were sent.',
    });

    render(<ForgotPasswordPage />);

    fireEvent.change(screen.getByLabelText(/correo electrónico/i), {
      target: { value: 'ana@moneyflow.pe' },
    });
    fireEvent.click(screen.getByRole('button', { name: /enviar instrucciones/i }));

    await waitFor(() => {
      expect(authApi.forgotPassword).toHaveBeenCalledWith({ email: 'ana@moneyflow.pe' });
      expect(screen.getByText(/solicitud enviada/i)).toBeInTheDocument();
    });
  });

  it('muestra mensaje de límite de solicitudes ante 429', async () => {
    vi.mocked(authApi.forgotPassword).mockRejectedValueOnce(
      new ApiError(429, 'Too Many Requests', 'ThrottlerException'),
    );

    render(<ForgotPasswordPage />);

    fireEvent.change(screen.getByLabelText(/correo electrónico/i), {
      target: { value: 'ana@moneyflow.pe' },
    });
    fireEvent.click(screen.getByRole('button', { name: /enviar instrucciones/i }));

    await waitFor(() => {
      expect(screen.getByText(/demasiadas solicitudes de recuperación/i)).toBeInTheDocument();
    });
  });
});

import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import VerifyEmailPage from '../page';
import { ApiError } from '@/lib/api-client';
import * as authApi from '@/lib/auth-api';

let mockTokenParam: string | null = null;

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

vi.mock('@/lib/auth-api', () => ({
  verifyEmail: vi.fn(),
  resendVerification: vi.fn(),
}));

describe('VerifyEmailPage (/verify-email)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTokenParam = null;
  });

  it('si falta token en la URL no llama a verifyEmail y muestra formulario de reenvío', async () => {
    mockTokenParam = null;
    vi.mocked(authApi.resendVerification).mockResolvedValueOnce({
      message: 'Sent',
    });

    render(<VerifyEmailPage />);

    expect(authApi.verifyEmail).not.toHaveBeenCalled();
    expect(screen.getByText(/enlace de verificación incompleto/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/reenviar enlace de verificación/i), {
      target: { value: 'ana@moneyflow.pe' },
    });
    fireEvent.click(screen.getByRole('button', { name: /reenviar correo de verificación/i }));

    await waitFor(() => {
      expect(authApi.resendVerification).toHaveBeenCalledWith({
        email: 'ana@moneyflow.pe',
      });
    });
  });

  it('bajo React.StrictMode dispara verifyEmail exactamente una vez y muestra éxito', async () => {
    mockTokenParam = 'valid-token-123';
    vi.mocked(authApi.verifyEmail).mockResolvedValueOnce({
      verified: true,
      email: 'ana@moneyflow.pe',
      emailVerifiedAt: '2026-11-22T00:00:00.000Z',
      message: 'Verified',
    });

    render(
      <React.StrictMode>
        <VerifyEmailPage />
      </React.StrictMode>,
    );

    await waitFor(() => {
      expect(screen.getByText(/correo verificado/i)).toBeInTheDocument();
    });
    expect(authApi.verifyEmail).toHaveBeenCalledTimes(1);
    expect(authApi.verifyEmail).toHaveBeenCalledWith({ token: 'valid-token-123' });
  });

  it('muestra error controlado y permite reenviar cuando el token es inválido (400)', async () => {
    mockTokenParam = 'expired-token';
    vi.mocked(authApi.verifyEmail).mockRejectedValueOnce(
      new ApiError(400, 'Bad Request', 'Invalid or expired token'),
    );

    render(<VerifyEmailPage />);

    await waitFor(() => {
      expect(screen.getByText(/enlace de verificación es inválido o ha expirado/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /reenviar correo de verificación/i })).toBeInTheDocument();
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  register,
  verifyEmail,
  resendVerification,
  login,
  refreshSession,
  logout,
  forgotPassword,
  resetPassword,
  getMe,
} from '../auth-api';

const USER_FIXTURE = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  email: 'ana.perez@moneyflow.pe',
  fullName: 'Ana Pérez',
  preferredCurrency: 'PEN',
  timezone: 'America/Lima',
  emailVerifiedAt: '2026-11-22T05:10:00.000Z',
  isActive: true,
  createdAt: '2026-11-22T05:00:00.000Z',
};

function mockJsonOk(body: unknown, status = 200) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
    ok: true,
    status,
    statusText: 'OK',
    json: async () => body,
  } as Response);
}

describe('auth-api (Contrato Espejo docs/contracts/auth.md)', () => {
  const originalEnv = process.env.NEXT_PUBLIC_API_URL;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3000';
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_API_URL = originalEnv;
  });

  it('register: POST /api/v1/auth/register (201 Created)', async () => {
    const responsePayload = {
      user: { ...USER_FIXTURE, emailVerifiedAt: null },
      emailVerificationRequired: true as const,
      message: 'Registration successful. Please verify your email.',
    };
    const fetchSpy = mockJsonOk(responsePayload, 201);

    const res = await register({
      email: 'ana.perez@moneyflow.pe',
      fullName: 'Ana Pérez',
      password: 'PasswordSegura123!',
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/auth/register',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
      }),
    );
    expect(res).toEqual(responsePayload);
  });

  it('verifyEmail: POST /api/v1/auth/verify-email (200 OK)', async () => {
    const responsePayload = {
      verified: true as const,
      email: 'ana.perez@moneyflow.pe',
      emailVerifiedAt: '2026-11-22T05:10:00.000Z',
      message: 'Email verified successfully.',
    };
    const fetchSpy = mockJsonOk(responsePayload);

    const res = await verifyEmail({ token: 'verify-token-123' });

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/auth/verify-email',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(res).toEqual(responsePayload);
  });

  it('resendVerification: POST /api/v1/auth/resend-verification (200 OK)', async () => {
    const responsePayload = {
      message: 'If the account exists and is pending verification, an email has been sent.',
    };
    const fetchSpy = mockJsonOk(responsePayload);

    const res = await resendVerification({ email: 'ana.perez@moneyflow.pe' });

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/auth/resend-verification',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(res).toEqual(responsePayload);
  });

  it('login: POST /api/v1/auth/login (200 OK)', async () => {
    const responsePayload = {
      user: USER_FIXTURE,
      message: 'Login successful.',
    };
    const fetchSpy = mockJsonOk(responsePayload);

    const res = await login({
      email: 'ana.perez@moneyflow.pe',
      password: 'PasswordSegura123!',
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/auth/login',
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
    expect(res).toEqual(responsePayload);
  });

  it('refreshSession: POST /api/v1/auth/refresh (200 OK)', async () => {
    const responsePayload = {
      user: USER_FIXTURE,
      message: 'Session refreshed successfully.',
    };
    const fetchSpy = mockJsonOk(responsePayload);

    const res = await refreshSession();

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/auth/refresh',
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
    expect(res).toEqual(responsePayload);
  });

  it('logout: POST /api/v1/auth/logout (200 OK)', async () => {
    const responsePayload = {
      message: 'Logged out successfully.',
    };
    const fetchSpy = mockJsonOk(responsePayload);

    const res = await logout();

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/auth/logout',
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
    expect(res).toEqual(responsePayload);
  });

  it('forgotPassword: POST /api/v1/auth/forgot-password (200 OK)', async () => {
    const responsePayload = {
      message: 'If the email is registered, a password reset link has been sent.',
    };
    const fetchSpy = mockJsonOk(responsePayload);

    const res = await forgotPassword({ email: 'ana.perez@moneyflow.pe' });

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/auth/forgot-password',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(res).toEqual(responsePayload);
  });

  it('resetPassword: POST /api/v1/auth/reset-password (200 OK)', async () => {
    const responsePayload = {
      message: 'Password reset successfully.',
    };
    const fetchSpy = mockJsonOk(responsePayload);

    const res = await resetPassword({
      token: 'reset-token-abc',
      newPassword: 'NuevaPassword123!',
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/auth/reset-password',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(res).toEqual(responsePayload);
  });

  it('getMe: GET /api/v1/auth/me (200 OK)', async () => {
    const responsePayload = {
      user: USER_FIXTURE,
    };
    const fetchSpy = mockJsonOk(responsePayload);

    const res = await getMe();

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/auth/me',
      expect.objectContaining({ method: 'GET', credentials: 'include' }),
    );
    expect(res).toEqual(responsePayload);
  });
});

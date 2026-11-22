import { fetchFromApi } from '@/lib/api-client';
import type {
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  GetProfileResponse,
  LoginRequest,
  LoginResponse,
  LogoutResponse,
  RefreshSessionResponse,
  RegisterRequest,
  RegisterResponse,
  ResendVerificationRequest,
  ResendVerificationResponse,
  ResetPasswordRequest,
  ResetPasswordResponse,
  VerifyEmailRequest,
  VerifyEmailResponse,
} from '@/types/auth';

export async function register(payload: RegisterRequest): Promise<RegisterResponse> {
  return fetchFromApi<RegisterResponse>('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function verifyEmail(payload: VerifyEmailRequest): Promise<VerifyEmailResponse> {
  return fetchFromApi<VerifyEmailResponse>('/api/v1/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function resendVerification(
  payload: ResendVerificationRequest,
): Promise<ResendVerificationResponse> {
  return fetchFromApi<ResendVerificationResponse>('/api/v1/auth/resend-verification', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function login(payload: LoginRequest): Promise<LoginResponse> {
  return fetchFromApi<LoginResponse>('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function refreshSession(): Promise<RefreshSessionResponse> {
  return fetchFromApi<RefreshSessionResponse>('/api/v1/auth/refresh', {
    method: 'POST',
  });
}

export async function logout(): Promise<LogoutResponse> {
  return fetchFromApi<LogoutResponse>('/api/v1/auth/logout', {
    method: 'POST',
  });
}

export async function forgotPassword(
  payload: ForgotPasswordRequest,
): Promise<ForgotPasswordResponse> {
  return fetchFromApi<ForgotPasswordResponse>('/api/v1/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function resetPassword(
  payload: ResetPasswordRequest,
): Promise<ResetPasswordResponse> {
  return fetchFromApi<ResetPasswordResponse>('/api/v1/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getMe(): Promise<GetProfileResponse> {
  return fetchFromApi<GetProfileResponse>('/api/v1/auth/me', {
    method: 'GET',
  });
}

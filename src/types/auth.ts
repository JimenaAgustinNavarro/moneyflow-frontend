export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  preferredCurrency: string;
  timezone: string;
  emailVerifiedAt: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface RegisterRequest {
  email: string;
  fullName: string;
  password: string;
}

export interface RegisterResponse {
  user: AuthUser;
  emailVerificationRequired: true;
  message: string;
}

export interface VerifyEmailRequest {
  token: string;
}

export interface VerifyEmailResponse {
  verified: true;
  email: string;
  emailVerifiedAt: string;
  message: string;
}

export interface ResendVerificationRequest {
  email: string;
}

export interface ResendVerificationResponse {
  message: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: AuthUser;
  message: string;
}

export interface RefreshSessionResponse {
  user: AuthUser;
  message: string;
}

export interface LogoutResponse {
  message: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ForgotPasswordResponse {
  message: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export interface ResetPasswordResponse {
  message: string;
}

export interface GetProfileResponse {
  user: AuthUser;
}

import { z } from 'zod';

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const EMAIL_MAX_LENGTH = 255;
export const FULL_NAME_MAX_LENGTH = 150;
export const PASSWORD_POLICY_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/;

const emailField = z
  .string()
  .trim()
  .min(1, 'El correo electrónico es obligatorio.')
  .max(EMAIL_MAX_LENGTH, `El correo no puede superar los ${EMAIL_MAX_LENGTH} caracteres.`)
  .email('Ingresa un correo electrónico válido.')
  .transform((value) => value.toLowerCase());

const passwordPolicyField = z
  .string()
  .min(
    PASSWORD_MIN_LENGTH,
    `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`,
  )
  .max(
    PASSWORD_MAX_LENGTH,
    `La contraseña no puede superar los ${PASSWORD_MAX_LENGTH} caracteres.`,
  )
  .regex(
    PASSWORD_POLICY_REGEX,
    'La contraseña debe incluir al menos una mayúscula, una minúscula y un número.',
  );

export const loginSchema = z.object({
  email: emailField,
  password: z
    .string()
    .min(1, 'La contraseña es obligatoria.')
    .max(
      PASSWORD_MAX_LENGTH,
      `La contraseña no puede superar los ${PASSWORD_MAX_LENGTH} caracteres.`,
    ),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(1, 'El nombre completo es obligatorio.')
      .max(
        FULL_NAME_MAX_LENGTH,
        `El nombre no puede superar los ${FULL_NAME_MAX_LENGTH} caracteres.`,
      ),
    email: emailField,
    password: passwordPolicyField,
    confirmPassword: z.string().min(1, 'Confirma tu contraseña.'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden.',
    path: ['confirmPassword'],
  });

export type RegisterFormValues = z.infer<typeof registerSchema>;

export const forgotPasswordSchema = z.object({
  email: emailField,
});

export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    newPassword: passwordPolicyField,
    confirmPassword: z.string().min(1, 'Confirma tu nueva contraseña.'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Las contraseñas no coinciden.',
    path: ['confirmPassword'],
  });

export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

export const resendVerificationSchema = z.object({
  email: emailField,
});

export type ResendVerificationFormValues = z.infer<typeof resendVerificationSchema>;

export interface PasswordRuleStatus {
  id: string;
  label: string;
  met: boolean;
}

export function evaluatePasswordRules(password: string): PasswordRuleStatus[] {
  return [
    {
      id: 'length',
      label: `Entre ${PASSWORD_MIN_LENGTH} y ${PASSWORD_MAX_LENGTH} caracteres`,
      met: password.length >= PASSWORD_MIN_LENGTH && password.length <= PASSWORD_MAX_LENGTH,
    },
    {
      id: 'uppercase',
      label: 'Al menos una letra mayúscula (A-Z)',
      met: /[A-Z]/.test(password),
    },
    {
      id: 'lowercase',
      label: 'Al menos una letra minúscula (a-z)',
      met: /[a-z]/.test(password),
    },
    {
      id: 'number',
      label: 'Al menos un número (0-9)',
      met: /\d/.test(password),
    },
  ];
}

import { describe, it, expect } from 'vitest';
import {
  EMAIL_MAX_LENGTH,
  FULL_NAME_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resendVerificationSchema,
  resetPasswordSchema,
} from '../auth-schemas';

describe('auth-schemas', () => {
  describe('loginSchema', () => {
    it('acepta credenciales válidas y normaliza el correo con trim y minúsculas', () => {
      const result = loginSchema.safeParse({
        email: '  Usuario@MoneyFlow.PE  ',
        password: 'Password1',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('usuario@moneyflow.pe');
      }
    });

    it('rechaza correo inválido y contraseña vacía', () => {
      const result = loginSchema.safeParse({
        email: 'no-es-correo',
        password: '',
      });
      expect(result.success).toBe(false);
    });

    it('rechaza correo mayor a 255 caracteres y contraseña mayor a 128', () => {
      const longEmail = `${'a'.repeat(245)}@example.com`;
      expect(longEmail.length).toBeGreaterThan(EMAIL_MAX_LENGTH);

      const result = loginSchema.safeParse({
        email: longEmail,
        password: 'a'.repeat(PASSWORD_MAX_LENGTH + 1),
      });
      expect(result.success).toBe(false);
    });
  });

  describe('registerSchema', () => {
    it('acepta datos válidos con coincidencia exacta de contraseñas', () => {
      const result = registerSchema.safeParse({
        fullName: '  Ana Pérez  ',
        email: 'ANA@moneyflow.pe',
        password: 'Password123',
        confirmPassword: 'Password123',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.fullName).toBe('Ana Pérez');
        expect(result.data.email).toBe('ana@moneyflow.pe');
      }
    });

    it('rechaza fullName vacío o mayor a 150 caracteres', () => {
      expect(
        registerSchema.safeParse({
          fullName: '   ',
          email: 'ana@moneyflow.pe',
          password: 'Password123',
          confirmPassword: 'Password123',
        }).success,
      ).toBe(false);

      expect(
        registerSchema.safeParse({
          fullName: 'A'.repeat(FULL_NAME_MAX_LENGTH + 1),
          email: 'ana@moneyflow.pe',
          password: 'Password123',
          confirmPassword: 'Password123',
        }).success,
      ).toBe(false);
    });

    it('exige política de contraseña (8-128, mayúscula, minúscula, número)', () => {
      const weakPasswords = ['Short1A', 'alllowercase1', 'ALLUPPERCASE1', 'NoNumbersHere'];
      for (const pwd of weakPasswords) {
        const result = registerSchema.safeParse({
          fullName: 'Ana Pérez',
          email: 'ana@moneyflow.pe',
          password: pwd,
          confirmPassword: pwd,
        });
        expect(result.success).toBe(false);
      }
    });

    it('rechaza cuando confirmPassword no coincide con password', () => {
      const result = registerSchema.safeParse({
        fullName: 'Ana Pérez',
        email: 'ana@moneyflow.pe',
        password: 'Password123',
        confirmPassword: 'Password124',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.path).toEqual(['confirmPassword']);
      }
    });
  });

  describe('forgotPasswordSchema & resendVerificationSchema', () => {
    it('validan correo correctamente', () => {
      expect(forgotPasswordSchema.safeParse({ email: 'user@moneyflow.pe' }).success).toBe(true);
      expect(forgotPasswordSchema.safeParse({ email: 'invalido' }).success).toBe(false);
      expect(resendVerificationSchema.safeParse({ email: 'user@moneyflow.pe' }).success).toBe(true);
      expect(resendVerificationSchema.safeParse({ email: '' }).success).toBe(false);
    });
  });

  describe('resetPasswordSchema', () => {
    it('acepta nueva contraseña válida coincidente y rechaza discrepancia', () => {
      expect(
        resetPasswordSchema.safeParse({
          newPassword: 'NewPassword1',
          confirmPassword: 'NewPassword1',
        }).success,
      ).toBe(true);

      expect(
        resetPasswordSchema.safeParse({
          newPassword: 'NewPassword1',
          confirmPassword: 'OtherPassword1',
        }).success,
      ).toBe(false);
    });
  });
});

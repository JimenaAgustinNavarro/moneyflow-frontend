import { describe, expect, it } from 'vitest';
import {
  buildCreateFundPayload,
  buildUpdateFundPayload,
  createFundSchema,
  isValidUuid,
  updateFundSchema,
} from '@/lib/funds-schemas';
import type { FundView } from '@/types/funds';

const SAMPLE_FUND: FundView = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Cuenta Sueldo BCP',
  type: 'BANK',
  currency: 'PEN',
  color: '#0F766E',
  icon: 'Landmark',
  allowNegativeBalance: false,
  isArchived: false,
  balance: '1500.00',
  createdAt: '2026-11-20T10:00:00.000Z',
  updatedAt: '2026-11-20T10:00:00.000Z',
};

describe('funds-schemas', () => {
  it('valida UUIDs correctamente', () => {
    expect(isValidUuid('11111111-1111-4111-8111-111111111111')).toBe(true);
    expect(isValidUuid('not-a-uuid')).toBe(false);
    expect(isValidUuid('')).toBe(false);
  });

  it('valida initialBalance con límites exactos sin punto flotante', () => {
    const validZero = createFundSchema.safeParse({
      name: 'Caja Chica',
      type: 'CASH',
      currency: 'PEN',
      allowNegativeBalance: false,
      initialBalance: '0',
    });
    expect(validZero.success).toBe(true);

    const validMax = createFundSchema.safeParse({
      name: 'Reserva USD',
      type: 'SAVINGS',
      currency: 'USD',
      color: '#AABBCC',
      icon: 'CustomVaultIcon',
      allowNegativeBalance: false,
      initialBalance: '999999999999.99',
    });
    expect(validMax.success).toBe(true);

    for (const invalidBalance of ['-10', '1e5', '10.123', '1000000000000.00', 'abc']) {
      const result = createFundSchema.safeParse({
        name: 'Fondo Test',
        type: 'BANK',
        currency: 'PEN',
        allowNegativeBalance: false,
        initialBalance: invalidBalance,
      });
      expect(result.success).toBe(false);
    }
  });

  it('rechaza color hexadecimal inválido o nombre vacío', () => {
    const emptyName = createFundSchema.safeParse({
      name: '   ',
      type: 'CASH',
      currency: 'PEN',
      allowNegativeBalance: false,
    });
    expect(emptyName.success).toBe(false);

    const badColor = updateFundSchema.safeParse({
      name: 'Fondo Válido',
      type: 'BANK',
      color: 'red',
      icon: '',
      allowNegativeBalance: false,
    });
    expect(badColor.success).toBe(false);
  });

  it('buildCreateFundPayload omite campos opcionales vacíos', () => {
    const payload = buildCreateFundPayload({
      name: '  Billetera Yape  ',
      type: 'WALLET',
      currency: 'PEN',
      color: '  ',
      icon: '',
      allowNegativeBalance: false,
      initialBalance: '   ',
    });

    expect(payload).toEqual({
      name: 'Billetera Yape',
      type: 'WALLET',
      currency: 'PEN',
      allowNegativeBalance: false,
    });
    expect('initialBalance' in payload).toBe(false);
    expect('color' in payload).toBe(false);
    expect('icon' in payload).toBe(false);
  });

  it('buildUpdateFundPayload retorna null si no hay cambios reales tras trim/normalización', () => {
    const noChanges = buildUpdateFundPayload(SAMPLE_FUND, {
      name: '  Cuenta Sueldo BCP  ',
      type: 'BANK',
      color: '#0F766E',
      icon: 'Landmark',
      allowNegativeBalance: false,
    });
    expect(noChanges).toBeNull();
  });

  it('buildUpdateFundPayload nunca incluye currency y envía null al limpiar color/icon', () => {
    const payload = buildUpdateFundPayload(SAMPLE_FUND, {
      name: 'Cuenta Sueldo BCP',
      type: 'BANK',
      color: '',
      icon: '   ',
      allowNegativeBalance: true,
    });

    expect(payload).toEqual({
      color: null,
      icon: null,
      allowNegativeBalance: true,
    });
    expect(payload && 'currency' in payload).toBe(false);
  });
});

import { describe, it, expect } from 'vitest';
import {
  addMoney,
  compareMoney,
  formatCurrency,
  isNegativeMoney,
  isPositiveMoneyString,
  isValidMoneyString,
  isZeroMoney,
  normalizeMoney,
  subMoney,
  sumMoney,
} from '../money';

describe('money (aritmética exacta en BigInt en centavos)', () => {
  it('valida cadenas monetarias y rechaza notación científica, >2 decimales o NaN', () => {
    expect(isValidMoneyString('0.1')).toBe(true);
    expect(isValidMoneyString('999999999999.99')).toBe(true);
    expect(isValidMoneyString('-0.05')).toBe(true);
    expect(isValidMoneyString('1e5')).toBe(false);
    expect(isValidMoneyString('10.123')).toBe(false);
    expect(isValidMoneyString('NaN')).toBe(false);
    expect(isValidMoneyString('')).toBe(false);
  });

  it('evalúa isPositiveMoneyString correctamente', () => {
    expect(isPositiveMoneyString('0.01')).toBe(true);
    expect(isPositiveMoneyString('0.00')).toBe(false);
    expect(isPositiveMoneyString('-0.05')).toBe(false);
    expect(isPositiveMoneyString('NaN')).toBe(false);
  });

  it('normaliza montos incluyendo "-0.00" -> "0.00" y enteros de 12 dígitos', () => {
    expect(normalizeMoney('-0.00')).toBe('0.00');
    expect(normalizeMoney('-0')).toBe('0.00');
    expect(normalizeMoney('5.5')).toBe('5.50');
    expect(normalizeMoney('005')).toBe('5.00');
    expect(normalizeMoney('999999999999.99')).toBe('999999999999.99');
  });

  it('resuelve 0.1 + 0.2 === "0.30" y soporta 999999999999.99 sin pérdida IEEE-754', () => {
    expect(addMoney('0.1', '0.2')).toBe('0.30');
    expect(addMoney('999999999999.99', '0.01')).toBe('1000000000000.00');
    expect(subMoney('100.00', '0.05')).toBe('99.95');
    expect(subMoney('0.00', '0.05')).toBe('-0.05');
  });

  it('calcula sumMoney con precisión exacta y detecta descuadre de "0.01"', () => {
    const splits = ['33.33', '33.33', '33.33'];
    const totalSplits = sumMoney(splits);
    expect(totalSplits).toBe('99.99');
    expect(subMoney('100.00', totalSplits)).toBe('0.01');
    expect(compareMoney(totalSplits, '100.00')).toBe(-1);
  });

  it('compara y evalúa signo sin punto flotante', () => {
    expect(compareMoney('10.50', '10.5')).toBe(0);
    expect(compareMoney('-0.05', '0.00')).toBe(-1);
    expect(compareMoney('999999999999.99', '999999999999.98')).toBe(1);
    expect(isNegativeMoney('-0.05')).toBe(true);
    expect(isNegativeMoney('-0.00')).toBe(false);
    expect(isZeroMoney('-0.00')).toBe(true);
    expect(isZeroMoney('0.01')).toBe(false);
  });

  it('formatea PEN y USD preservando precisión de 12 dígitos', () => {
    expect(formatCurrency('999999999999.99', 'PEN')).toBe('S/ 999,999,999,999.99');
    expect(formatCurrency('1250.50', 'USD')).toBe('$ 1,250.50');
    expect(formatCurrency('-0.05', 'USD')).toBe('-$ 0.05');
    expect(formatCurrency('-0.00', 'USD')).toBe('$ 0.00');
  });

  it('lanza error ante entradas inválidas en operaciones', () => {
    expect(() => addMoney('1e5', '1.00')).toThrow('Monto monetario inválido');
    expect(() => subMoney('10.123', '1.00')).toThrow('Monto monetario inválido');
    expect(() => sumMoney(['NaN'])).toThrow('Monto monetario inválido');
  });
});

import { describe, it, expect } from 'vitest';
import {
  formatMoney,
  formatDate,
  formatDateTime,
  getCurrentLimaMonthString,
  getTodayLimaDateString,
  isValidGregorianDateString,
  shiftMonth,
} from '../formatters';

describe('formatters', () => {
  describe('formatMoney (100% basado en cadenas, cero punto flotante)', () => {
    it('formatea montos positivos estándar con separador de miles y dos decimales', () => {
      expect(formatMoney('1250.50')).toBe('S/ 1,250.50');
      expect(formatMoney('1000000.50')).toBe('S/ 1,000,000.50');
      expect(formatMoney('5.5')).toBe('S/ 5.50');
      expect(formatMoney('100')).toBe('S/ 100.00');
      expect(formatMoney('0.05')).toBe('S/ 0.05');
    });

    it('formatea montos negativos con prefijo "-S/ "', () => {
      expect(formatMoney('-45.00')).toBe('-S/ 45.00');
      expect(formatMoney('-0.01')).toBe('-S/ 0.01');
      expect(formatMoney('-1250.50')).toBe('-S/ 1,250.50');
      expect(formatMoney('-999999.99')).toBe('-S/ 999,999.99');
    });

    it('normaliza ceros con signo negativo ("-0.00", "-0", "-0.0") a "S/ 0.00"', () => {
      expect(formatMoney('0')).toBe('S/ 0.00');
      expect(formatMoney('0.00')).toBe('S/ 0.00');
      expect(formatMoney('-0')).toBe('S/ 0.00');
      expect(formatMoney('-0.0')).toBe('S/ 0.00');
      expect(formatMoney('-0.00')).toBe('S/ 0.00');
    });

    it('lanza error ante entradas no numéricas o con más de dos decimales', () => {
      expect(() => formatMoney('abc')).toThrow('Monto monetario inválido');
      expect(() => formatMoney('')).toThrow('Monto monetario inválido');
      expect(() => formatMoney('12.345')).toThrow('Monto monetario inválido');
      expect(() => formatMoney('--50.00')).toThrow('Monto monetario inválido');
    });
  });

  describe('formatDate (fecha calendario sin desplazamiento UTC)', () => {
    it('formatea fechas calendario gregorianas válidas a DD/MM/YYYY', () => {
      expect(formatDate('2026-11-21')).toBe('21/11/2026');
      expect(formatDate('2024-02-29')).toBe('29/02/2024'); // Año bisiesto
      expect(formatDate('2026-01-01')).toBe('01/01/2026');
      expect(formatDate('2026-12-31')).toBe('31/12/2026');
    });

    it('rechaza fechas con formato inválido', () => {
      expect(() => formatDate('21-11-2026')).toThrow('Formato de fecha calendario inválido');
      expect(() => formatDate('2026/11/21')).toThrow('Formato de fecha calendario inválido');
      expect(() => formatDate('invalida')).toThrow('Formato de fecha calendario inválido');
    });

    it('valida existencia gregoriana real y rechaza fechas imposibles', () => {
      expect(() => formatDate('2026-02-31')).toThrow('Fecha gregoriana inválida');
      expect(() => formatDate('2026-02-29')).toThrow('Fecha gregoriana inválida'); // 2026 no es bisiesto
      expect(() => formatDate('2026-04-31')).toThrow('Fecha gregoriana inválida'); // Abril tiene 30 días
      expect(() => formatDate('2026-06-31')).toThrow('Fecha gregoriana inválida'); // Junio tiene 30 días
      expect(() => formatDate('2026-13-01')).toThrow('Fecha gregoriana inválida'); // Mes 13 inexistente
      expect(() => formatDate('2026-00-10')).toThrow('Fecha gregoriana inválida'); // Mes 0 inexistente
      expect(() => formatDate('2026-05-32')).toThrow('Fecha gregoriana inválida'); // Día 32 inexistente
    });
  });

  describe('formatDateTime (instantes TIMESTAMPTZ en America/Lima)', () => {
    it('formatea instantes en la ventana crítica 19:00-23:59 America/Lima con la fecha correcta', () => {
      // 2026-11-22T04:30:15.000Z en UTC -> Lima (UTC-5) son las 23:30:15 del 21/11/2026
      const formattedLateNight = formatDateTime('2026-11-22T04:30:15.000Z');
      expect(formattedLateNight).toContain('21/11/2026');
      expect(formattedLateNight).toContain('23:30:15');

      // 2026-11-22T00:15:00.000Z en UTC -> Lima (UTC-5) son las 19:15:00 del 21/11/2026
      const formattedEvening = formatDateTime('2026-11-22T00:15:00.000Z');
      expect(formattedEvening).toContain('21/11/2026');
      expect(formattedEvening).toContain('19:15:00');
    });

    it('lanza error ante instante ISO inválido', () => {
      expect(() => formatDateTime('fecha-invalida')).toThrow('Instante de tiempo ISO inválido');
    });
  });

  describe('formatMoney USD y utilidades America/Lima + shiftMonth', () => {
    it('formatea USD manteniendo compatibilidad con PEN por defecto', () => {
      expect(formatMoney('1250.50', 'USD')).toBe('$ 1,250.50');
      expect(formatMoney('-45.00', 'USD')).toBe('-$ 45.00');
      expect(formatMoney('-0.00', 'USD')).toBe('$ 0.00');
    });

    it('valida existencia gregoriana con isValidGregorianDateString', () => {
      expect(isValidGregorianDateString('2026-11-22')).toBe(true);
      expect(isValidGregorianDateString('2026-02-31')).toBe(false);
      expect(isValidGregorianDateString('2026-02-29')).toBe(false);
    });

    it('respeta ventana nocturna 19:00-23:59 America/Lima sin desplazamiento UTC', () => {
      // 2026-11-23T02:30:00.000Z = 2026-11-22 21:30:00 en America/Lima (UTC-5)
      expect(getTodayLimaDateString(new Date('2026-11-23T02:30:00.000Z'))).toBe('2026-11-22');

      // 2026-12-01T02:30:00.000Z = 2026-11-30 21:30:00 en America/Lima (UTC-5)
      expect(getCurrentLimaMonthString(new Date('2026-12-01T02:30:00.000Z'))).toBe('2026-11');

      // formatDate nunca desplaza una fecha calendario por huso horario local
      expect(formatDate('2026-11-22')).toBe('22/11/2026');
    });

    it('desplaza meses con shiftMonth incluyendo cambio de año', () => {
      expect(shiftMonth('2026-01', -1)).toBe('2025-12');
      expect(shiftMonth('2026-12', 1)).toBe('2027-01');
      expect(shiftMonth('2026-11', -11)).toBe('2025-12');
      expect(() => shiftMonth('2026-13', 1)).toThrow('Mes calendario inválido');
    });
  });
});

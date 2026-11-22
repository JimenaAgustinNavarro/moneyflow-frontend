import { describe, it, expect } from 'vitest';
import { formatMoney, formatDate, formatDateTime } from '../formatters';

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
});

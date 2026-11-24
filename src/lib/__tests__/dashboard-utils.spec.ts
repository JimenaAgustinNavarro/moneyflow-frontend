import { describe, expect, it } from 'vitest';
import {
  calculateCategoryPercentage,
  formatMonthLabelEs,
  getAvailableCurrencies,
  isValidMonthString,
  resolveCurrencySummary,
  resolveEffectiveCurrency,
  resolvePatrimonyKpi,
} from '@/lib/dashboard-utils';
import type { CurrencyBalanceSummary, FundView } from '@/types/funds';
import type { CurrencyMonthlySummaryView, MonthlySummaryResponse } from '@/types/ledger';

const SAMPLE_FUND_USD: FundView = {
  id: 'fund-usd-1',
  name: 'Ahorros USD',
  type: 'SAVINGS',
  currency: 'USD',
  color: '#1D4ED8',
  icon: 'PiggyBank',
  allowNegativeBalance: false,
  isArchived: false,
  balance: '850.00',
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
};

describe('dashboard-utils', () => {
  it('valida formato estricto YYYY-MM', () => {
    expect(isValidMonthString('2026-11')).toBe(true);
    expect(isValidMonthString('2026-01')).toBe(true);
    expect(isValidMonthString('2026-12')).toBe(true);
    expect(isValidMonthString('')).toBe(false);
    expect(isValidMonthString('2026-13')).toBe(false);
    expect(isValidMonthString('2026-00')).toBe(false);
    expect(isValidMonthString('2026-11-01')).toBe(false);
  });

  it('formatea etiquetas de mes en español sin desplazamiento UTC', () => {
    expect(formatMonthLabelEs('2026-01')).toBe('Enero 2026');
    expect(formatMonthLabelEs('2026-11')).toBe('Noviembre 2026');
    expect(formatMonthLabelEs('2026-12')).toBe('Diciembre 2026');
  });

  it('calcula porcentajes exactos con BigInt sin NaN ni división por cero', () => {
    expect(calculateCategoryPercentage('120.00', '200.00')).toBe(60);
    expect(calculateCategoryPercentage('50.00', '200.00')).toBe(25);
    expect(calculateCategoryPercentage('33.33', '100.00')).toBe(33.3);
    expect(calculateCategoryPercentage('100.00', '0.00')).toBe(0);
    expect(calculateCategoryPercentage('0.00', '0.00')).toBe(0);
    expect(calculateCategoryPercentage('250.00', '200.00')).toBe(100);
    expect(calculateCategoryPercentage('invalid', '200.00')).toBe(0);
  });

  it('ordena monedas PEN primero y USD segundo y aplica fallback PEN', () => {
    const totals: CurrencyBalanceSummary[] = [
      { currency: 'USD', totalBalance: '500.00', fundCount: 1 },
      { currency: 'PEN', totalBalance: '1200.00', fundCount: 2 },
    ];
    const summaryCurrencies: CurrencyMonthlySummaryView[] = [];

    expect(getAvailableCurrencies(totals, summaryCurrencies, null)).toEqual(['PEN', 'USD']);
    expect(getAvailableCurrencies([], [], null)).toEqual(['PEN']);
    expect(getAvailableCurrencies(totals, summaryCurrencies, SAMPLE_FUND_USD)).toEqual(['USD']);
  });

  it('resuelve effectiveCurrency de forma determinista', () => {
    expect(resolveEffectiveCurrency(['PEN', 'USD'], 'USD', null)).toBe('USD');
    expect(resolveEffectiveCurrency(['PEN'], 'USD', null)).toBe('PEN');
    expect(resolveEffectiveCurrency(['PEN', 'USD'], 'PEN', SAMPLE_FUND_USD)).toBe('USD');
  });

  it('resuelve resumen mensual y patrimonio con fallback seguro en 0.00', () => {
    const emptySummary: MonthlySummaryResponse = {
      month: '2026-11',
      fromDate: '2026-11-01',
      toDate: '2026-11-30',
      fundId: null,
      currencies: [],
    };

    expect(resolveCurrencySummary(emptySummary, 'PEN')).toEqual({
      currency: 'PEN',
      totalIncome: '0.00',
      totalExpenseGross: '0.00',
      totalRefunds: '0.00',
      totalExpenseNet: '0.00',
      netCashFlow: '0.00',
      transactionCount: 0,
      byCategory: [],
    });

    expect(resolvePatrimonyKpi([], 'PEN', null)).toEqual({
      totalBalance: '0.00',
      fundCount: 0,
      isFilteredByFund: false,
      fundName: null,
    });

    expect(resolvePatrimonyKpi([], 'USD', SAMPLE_FUND_USD)).toEqual({
      totalBalance: '850.00',
      fundCount: 1,
      isFilteredByFund: true,
      fundName: 'Ahorros USD',
    });
  });
});

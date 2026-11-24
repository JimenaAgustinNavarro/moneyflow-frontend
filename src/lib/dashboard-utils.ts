import { isValidMoneyString, normalizeMoney } from '@/lib/money';
import type { CurrencyBalanceSummary, FundCurrencyCode, FundView } from '@/types/funds';
import type { CurrencyMonthlySummaryView, MonthlySummaryResponse } from '@/types/ledger';

const MONTH_REGEX = /^(\d{4})-(0[1-9]|1[0-2])$/;

const SPANISH_MONTHS = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
] as const;

const CURRENCY_ORDER: readonly FundCurrencyCode[] = ['PEN', 'USD'];

export interface PatrimonyKpi {
  totalBalance: string;
  fundCount: number;
  isFilteredByFund: boolean;
  fundName: string | null;
}

/**
 * Valida que la cadena tenga formato calendario estricto "YYYY-MM" (01..12).
 */
export function isValidMonthString(monthStr: string): boolean {
  return MONTH_REGEX.test(monthStr);
}

/**
 * Formatea un mes calendario "YYYY-MM" en etiqueta legible en español (ej. "Noviembre 2026")
 * sin instanciar Date ni sufrir desplazamientos por UTC.
 */
export function formatMonthLabelEs(monthStr: string): string {
  const match = MONTH_REGEX.exec(monthStr);
  if (!match) {
    return monthStr;
  }

  const year = match[1];
  const monthIndex = parseInt(match[2], 10) - 1;
  const monthName = SPANISH_MONTHS[monthIndex];
  return `${monthName} ${year}`;
}

function moneyToCents(amount: string): bigint {
  if (!isValidMoneyString(amount)) {
    return BigInt(0);
  }

  const normalized = normalizeMoney(amount);
  const isNegative = normalized.startsWith('-');
  const rawBody = isNegative ? normalized.slice(1) : normalized;
  const [intPart, decPart] = rawBody.split('.');
  const cents = BigInt(intPart) * BigInt(100) + BigInt(decPart);
  return isNegative ? -cents : cents;
}

/**
 * Calcula el porcentaje (0..100 con 1 decimal) usando aritmética exacta BigInt en centavos.
 * Nunca produce NaN ni Infinity; si el total es <= 0, retorna 0.
 */
export function calculateCategoryPercentage(itemAmount: string, totalAmount: string): number {
  const itemCents = moneyToCents(itemAmount);
  const totalCents = moneyToCents(totalAmount);

  if (totalCents <= BigInt(0) || itemCents <= BigInt(0)) {
    return 0;
  }

  const tenths = (itemCents * BigInt(1000) + totalCents / BigInt(2)) / totalCents;
  const clamped = tenths > BigInt(1000) ? BigInt(1000) : tenths;
  return Number(clamped) / 10;
}

/**
 * Determina las monedas disponibles ordenadas estrictamente PEN primero y USD segundo.
 * Si hay un fondo seleccionado, restringe exclusivamente a su moneda.
 */
export function getAvailableCurrencies(
  totalsByCurrency: readonly CurrencyBalanceSummary[],
  summaryCurrencies: readonly CurrencyMonthlySummaryView[],
  selectedFund: FundView | null,
): FundCurrencyCode[] {
  if (selectedFund) {
    return [selectedFund.currency];
  }

  const present = new Set<FundCurrencyCode>();
  for (const item of totalsByCurrency) {
    present.add(item.currency);
  }
  for (const item of summaryCurrencies) {
    present.add(item.currency);
  }

  const ordered = CURRENCY_ORDER.filter((code) => present.has(code));
  return ordered.length > 0 ? ordered : ['PEN'];
}

/**
 * Resuelve de forma determinista la moneda efectiva activa sin estados desincronizados.
 */
export function resolveEffectiveCurrency(
  availableCurrencies: readonly FundCurrencyCode[],
  selectedCurrency: FundCurrencyCode | null,
  selectedFund: FundView | null,
): FundCurrencyCode {
  if (selectedFund) {
    return selectedFund.currency;
  }
  if (selectedCurrency && availableCurrencies.includes(selectedCurrency)) {
    return selectedCurrency;
  }
  return availableCurrencies[0] ?? 'PEN';
}

/**
 * Obtiene el resumen mensual de la moneda activa o un resumen neutro en "0.00".
 */
export function resolveCurrencySummary(
  summary: MonthlySummaryResponse | null,
  currency: FundCurrencyCode,
): CurrencyMonthlySummaryView {
  const found = summary?.currencies.find((item) => item.currency === currency);
  if (found) {
    return found;
  }

  return {
    currency,
    totalIncome: '0.00',
    totalExpenseGross: '0.00',
    totalRefunds: '0.00',
    totalExpenseNet: '0.00',
    netCashFlow: '0.00',
    transactionCount: 0,
    byCategory: [],
  };
}

/**
 * Resuelve el KPI de patrimonio total para la moneda activa (global o filtrado por fondo).
 */
export function resolvePatrimonyKpi(
  totalsByCurrency: readonly CurrencyBalanceSummary[],
  currency: FundCurrencyCode,
  selectedFund: FundView | null,
): PatrimonyKpi {
  if (selectedFund) {
    return {
      totalBalance: selectedFund.balance,
      fundCount: 1,
      isFilteredByFund: true,
      fundName: selectedFund.name,
    };
  }

  const summary = totalsByCurrency.find((item) => item.currency === currency);
  return {
    totalBalance: summary?.totalBalance ?? '0.00',
    fundCount: summary?.fundCount ?? 0,
    isFilteredByFund: false,
    fundName: null,
  };
}

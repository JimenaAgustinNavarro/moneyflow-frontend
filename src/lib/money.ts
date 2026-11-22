import type { FundCurrencyCode } from '@/types/funds';

const MONEY_REGEX = /^-?\d+(\.\d{1,2})?$/;
const HUNDRED = BigInt(100);
const ZERO = BigInt(0);

const CURRENCY_PREFIX: Record<FundCurrencyCode, string> = {
  PEN: 'S/ ',
  USD: '$ ',
};

/**
 * Valida que la cadena represente un monto monetario decimal con hasta 2 decimales.
 * Rechaza notación científica ("1e5"), más de 2 decimales ("10.123"), "NaN" o vacíos.
 */
export function isValidMoneyString(amount: string): boolean {
  return MONEY_REGEX.test(amount);
}

function parseToCents(amount: string): bigint {
  if (!isValidMoneyString(amount)) {
    throw new Error(`Monto monetario inválido: ${amount}`);
  }

  const isNegative = amount.startsWith('-');
  const rawBody = isNegative ? amount.slice(1) : amount;
  const [intPart, rawDec = '00'] = rawBody.split('.');
  const decPart = rawDec.length === 1 ? `${rawDec}0` : rawDec;

  const cents = BigInt(intPart) * HUNDRED + BigInt(decPart);
  if (cents === ZERO) {
    return ZERO;
  }
  return isNegative ? -cents : cents;
}

function formatCentsToDecimal(cents: bigint): string {
  if (cents === ZERO) {
    return '0.00';
  }

  const isNegative = cents < ZERO;
  const absCents = isNegative ? -cents : cents;
  const intPart = absCents / HUNDRED;
  const decPart = (absCents % HUNDRED).toString().padStart(2, '0');

  return `${isNegative ? '-' : ''}${intPart.toString()}.${decPart}`;
}

/**
 * Valida que el monto sea un string monetario válido estrictamente mayor a cero.
 */
export function isPositiveMoneyString(amount: string): boolean {
  if (!isValidMoneyString(amount)) {
    return false;
  }
  return parseToCents(amount) > ZERO;
}

/**
 * Normaliza un string monetario a formato decimal exacto con 2 decimales ("0.00", "-45.00").
 * Normaliza "-0.00", "-0" o "-0.0" a "0.00".
 */
export function normalizeMoney(amount: string): string {
  return formatCentsToDecimal(parseToCents(amount));
}

export function addMoney(a: string, b: string): string {
  return formatCentsToDecimal(parseToCents(a) + parseToCents(b));
}

export function subMoney(a: string, b: string): string {
  return formatCentsToDecimal(parseToCents(a) - parseToCents(b));
}

export function sumMoney(amounts: readonly string[]): string {
  let total = ZERO;
  for (const amount of amounts) {
    total += parseToCents(amount);
  }
  return formatCentsToDecimal(total);
}

export function compareMoney(a: string, b: string): -1 | 0 | 1 {
  const centsA = parseToCents(a);
  const centsB = parseToCents(b);
  if (centsA < centsB) return -1;
  if (centsA > centsB) return 1;
  return 0;
}

export function isNegativeMoney(amount: string): boolean {
  return parseToCents(amount) < ZERO;
}

export function isZeroMoney(amount: string): boolean {
  return parseToCents(amount) === ZERO;
}

/**
 * Formatea un monto monetario en string exacto para PEN o USD sin usar punto flotante.
 * Ejemplos:
 * - ("1250.50", "PEN") -> "S/ 1,250.50"
 * - ("-45.00", "PEN") -> "-S/ 45.00"
 * - ("1250.50", "USD") -> "$ 1,250.50"
 * - ("-45.00", "USD") -> "-$ 45.00"
 */
export function formatCurrency(amount: string, currency: FundCurrencyCode = 'PEN'): string {
  const normalized = normalizeMoney(amount);
  const isNegative = normalized.startsWith('-');
  const unsigned = isNegative ? normalized.slice(1) : normalized;
  const [intPart, decPart] = unsigned.split('.');

  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const prefix = CURRENCY_PREFIX[currency];

  return `${isNegative ? '-' : ''}${prefix}${formattedInt}.${decPart}`;
}

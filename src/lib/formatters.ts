import { formatCurrency } from '@/lib/money';
import type { FundCurrencyCode } from '@/types/funds';

const DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_REGEX = /^(\d{4})-(\d{2})$/;
const LIMA_TIMEZONE = 'America/Lima';

/**
 * Formatea un monto monetario en string exacto (PEN por defecto o USD) sin usar punto flotante.
 * Formatos de salida:
 * - "1250.50" -> "S/ 1,250.50"
 * - "-45.00" -> "-S/ 45.00"
 * - ("1250.50", "USD") -> "$ 1,250.50"
 */
export function formatMoney(amount: string, currency: FundCurrencyCode = 'PEN'): string {
  return formatCurrency(amount, currency);
}

/**
 * Valida la existencia gregoriana real de una fecha calendario en string.
 */
function isGregorianDateValid(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12) {
    return false;
  }

  const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

  let maxDays = 31;
  if (month === 2) {
    maxDays = isLeapYear ? 29 : 28;
  } else if (month === 4 || month === 6 || month === 9 || month === 11) {
    maxDays = 30;
  }

  return day >= 1 && day <= maxDays;
}

/**
 * Valida si una cadena "YYYY-MM-DD" corresponde a una fecha calendario gregoriana real.
 */
export function isValidGregorianDateString(dateStr: string): boolean {
  const match = DATE_REGEX.exec(dateStr);
  if (!match) {
    return false;
  }

  const [, yearStr, monthStr, dayStr] = match;
  return isGregorianDateValid(
    parseInt(yearStr, 10),
    parseInt(monthStr, 10),
    parseInt(dayStr, 10),
  );
}

/**
 * Formatea una fecha calendario "YYYY-MM-DD" a "DD/MM/YYYY" sin desplazamiento horario por UTC.
 * Valida existencia en calendario gregoriano (rechaza "2026-02-31", "2026-02-29" en años no bisiestos).
 */
export function formatDate(dateStr: string): string {
  const match = DATE_REGEX.exec(dateStr);
  if (!match) {
    throw new Error(`Formato de fecha calendario inválido (se esperaba YYYY-MM-DD): ${dateStr}`);
  }

  const [, yearStr, monthStr, dayStr] = match;
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  if (!isGregorianDateValid(year, month, day)) {
    throw new Error(`Fecha gregoriana inválida: ${dateStr}`);
  }

  return `${dayStr}/${monthStr}/${yearStr}`;
}

/**
 * Formatea un instante técnico (ISO 8601 TIMESTAMPTZ) fijando estrictamente la zona horaria America/Lima.
 */
export function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Instante de tiempo ISO inválido: ${isoString}`);
  }

  return new Intl.DateTimeFormat('es-PE', {
    timeZone: LIMA_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

/**
 * Obtiene la fecha calendario actual ("YYYY-MM-DD") en zona horaria America/Lima.
 */
export function getTodayLimaDateString(now: Date = new Date()): string {
  if (Number.isNaN(now.getTime())) {
    throw new Error('Instante de tiempo inválido para calcular la fecha de Lima');
  }

  return new Intl.DateTimeFormat('en-CA', {
    timeZone: LIMA_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/**
 * Obtiene el mes calendario actual ("YYYY-MM") en zona horaria America/Lima.
 */
export function getCurrentLimaMonthString(now: Date = new Date()): string {
  return getTodayLimaDateString(now).slice(0, 7);
}

/**
 * Desplaza un mes calendario "YYYY-MM" por `deltaMonths` meses (positivo o negativo).
 * Ejemplos:
 * - shiftMonth('2026-01', -1) -> '2025-12'
 * - shiftMonth('2026-12', 1) -> '2027-01'
 */
export function shiftMonth(monthStr: string, deltaMonths: number): string {
  const match = MONTH_REGEX.exec(monthStr);
  if (!match) {
    throw new Error(`Formato de mes inválido (se esperaba YYYY-MM): ${monthStr}`);
  }
  if (!Number.isInteger(deltaMonths)) {
    throw new Error(`El desplazamiento de meses debe ser un entero: ${deltaMonths}`);
  }

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  if (month < 1 || month > 12) {
    throw new Error(`Mes calendario inválido: ${monthStr}`);
  }

  const totalMonths = year * 12 + (month - 1) + deltaMonths;
  if (totalMonths < 0) {
    throw new Error(`Resultado de año fuera de rango al desplazar ${monthStr}`);
  }

  const nextYear = Math.floor(totalMonths / 12);
  const nextMonth = (totalMonths % 12) + 1;

  return `${String(nextYear).padStart(4, '0')}-${String(nextMonth).padStart(2, '0')}`;
}

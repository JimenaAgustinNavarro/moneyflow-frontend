const MONEY_REGEX = /^-?\d+(\.\d{1,2})?$/;
const DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Formatea un monto monetario en string exacto (PEN) sin usar punto flotante ni conversiones a number.
 * Formatos de salida:
 * - "1250.50" -> "S/ 1,250.50"
 * - "-45.00" -> "-S/ 45.00"
 * - "0.00" o "-0.00" o "-0" -> "S/ 0.00"
 */
export function formatMoney(amount: string): string {
  if (!MONEY_REGEX.test(amount)) {
    throw new Error(`Monto monetario inválido: ${amount}`);
  }

  let isNegative = amount.startsWith('-');
  const rawBody = isNegative ? amount.slice(1) : amount;

  const [rawInt, rawDec = '00'] = rawBody.split('.');
  const decPart = rawDec.length === 1 ? `${rawDec}0` : rawDec;

  // Limpiar ceros redundantes a la izquierda en la parte entera (ej. "005" -> "5")
  const cleanInt = rawInt.replace(/^0+(?=\d)/, '');

  // Determinar si el valor numérico absoluto es efectivamente cero
  const isZero = cleanInt === '0' && (decPart === '00' || /^0+$/.test(decPart));

  if (isZero) {
    isNegative = false;
  }

  // Insertar comas de miles puramente con regex de cadenas
  const formattedInt = cleanInt.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  const sign = isNegative ? '-S/ ' : 'S/ ';
  return `${sign}${formattedInt}.${decPart}`;
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
    timeZone: 'America/Lima',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

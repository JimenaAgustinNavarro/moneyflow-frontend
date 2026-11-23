import { z } from 'zod';
import { compareMoney } from '@/lib/money';
import type {
  CreateFundPayload,
  FundCurrencyCode,
  FundTypeValue,
  FundView,
  UpdateFundPayload,
} from '@/types/funds';

export const FUND_CURRENCIES: readonly FundCurrencyCode[] = ['PEN', 'USD'];

export const FUND_TYPES: readonly FundTypeValue[] = [
  'CASH',
  'BANK',
  'WALLET',
  'SAVINGS',
  'OTHER',
];

export const FUND_TYPE_LABELS: Record<FundTypeValue, string> = {
  CASH: 'Efectivo',
  BANK: 'Banco',
  WALLET: 'Billetera digital',
  SAVINGS: 'Ahorros',
  OTHER: 'Otro',
};

export const FUND_CURRENCY_LABELS: Record<FundCurrencyCode, string> = {
  PEN: 'Soles (PEN)',
  USD: 'Dólares (USD)',
};

export const FUND_COLOR_PRESETS: readonly string[] = [
  '#0F766E',
  '#1D4ED8',
  '#7C3AED',
  '#B45309',
  '#BE123C',
  '#334155',
];

export const FUND_ICON_OPTIONS = [
  { value: 'Wallet', label: 'Billetera' },
  { value: 'Landmark', label: 'Banco' },
  { value: 'Banknote', label: 'Efectivo' },
  { value: 'PiggyBank', label: 'Alcancía' },
  { value: 'CreditCard', label: 'Tarjeta' },
  { value: 'Coins', label: 'Monedas' },
  { value: 'Briefcase', label: 'Negocio' },
  { value: 'Shield', label: 'Reserva' },
] as const;

const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;
const INITIAL_BALANCE_REGEX = /^\d{1,12}(\.\d{1,2})?$/;
const MAX_INITIAL_BALANCE = '999999999999.99';
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUuid(value: string): boolean {
  return UUID_REGEX.test(value.trim());
}

export function normalizeOptionalText(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

const optionalHexColorSchema = z
  .string()
  .refine((val) => {
    const trimmed = val.trim();
    return trimmed.length === 0 || HEX_COLOR_REGEX.test(trimmed);
  }, 'El color debe tener formato hexadecimal #RRGGBB.')
  .optional()
  .default('');

const optionalIconSchema = z
  .string()
  .refine((val) => val.trim().length <= 50, 'El ícono no puede superar los 50 caracteres.')
  .optional()
  .default('');

export const createFundSchema = z.object({
  name: z
    .string()
    .refine((val) => val.trim().length >= 1, 'El nombre del fondo es obligatorio.')
    .refine((val) => val.trim().length <= 100, 'El nombre no puede superar los 100 caracteres.'),
  type: z.enum(['CASH', 'BANK', 'WALLET', 'SAVINGS', 'OTHER'], {
    message: 'Selecciona un tipo de fondo válido.',
  }),
  currency: z.enum(['PEN', 'USD'], {
    message: 'Selecciona una moneda válida.',
  }),
  color: optionalHexColorSchema,
  icon: optionalIconSchema,
  allowNegativeBalance: z.boolean(),
  initialBalance: z
    .string()
    .refine((val) => {
      const trimmed = val.trim();
      if (trimmed.length === 0) {
        return true;
      }
      if (!INITIAL_BALANCE_REGEX.test(trimmed)) {
        return false;
      }
      return compareMoney(trimmed, MAX_INITIAL_BALANCE) <= 0;
    }, 'Ingresa un monto válido no negativo con hasta 2 decimales (máx. 999999999999.99).')
    .optional()
    .default(''),
});

export type CreateFundFormValues = z.input<typeof createFundSchema>;

export const updateFundSchema = z.object({
  name: z
    .string()
    .refine((val) => val.trim().length >= 1, 'El nombre del fondo es obligatorio.')
    .refine((val) => val.trim().length <= 100, 'El nombre no puede superar los 100 caracteres.'),
  type: z.enum(['CASH', 'BANK', 'WALLET', 'SAVINGS', 'OTHER'], {
    message: 'Selecciona un tipo de fondo válido.',
  }),
  color: optionalHexColorSchema,
  icon: optionalIconSchema,
  allowNegativeBalance: z.boolean(),
});

export type UpdateFundFormValues = z.input<typeof updateFundSchema>;

export function buildCreateFundPayload(values: CreateFundFormValues): CreateFundPayload {
  const payload: CreateFundPayload = {
    name: values.name.trim(),
    type: values.type,
    currency: values.currency,
    allowNegativeBalance: values.allowNegativeBalance,
  };

  const normalizedColor = normalizeOptionalText(values.color);
  if (normalizedColor !== null) {
    payload.color = normalizedColor;
  }

  const normalizedIcon = normalizeOptionalText(values.icon);
  if (normalizedIcon !== null) {
    payload.icon = normalizedIcon;
  }

  const normalizedInitialBalance = normalizeOptionalText(values.initialBalance);
  if (normalizedInitialBalance !== null) {
    payload.initialBalance = normalizedInitialBalance;
  }

  return payload;
}

export function buildUpdateFundPayload(
  initialFund: Pick<FundView, 'name' | 'type' | 'color' | 'icon' | 'allowNegativeBalance'>,
  values: UpdateFundFormValues,
): UpdateFundPayload | null {
  const payload: UpdateFundPayload = {};

  const nextName = values.name.trim();
  const initialName = initialFund.name.trim();
  if (nextName !== initialName) {
    payload.name = nextName;
  }

  if (values.type !== initialFund.type) {
    payload.type = values.type;
  }

  const nextColor = normalizeOptionalText(values.color);
  const initialColor = normalizeOptionalText(initialFund.color);
  if (nextColor !== initialColor) {
    payload.color = nextColor;
  }

  const nextIcon = normalizeOptionalText(values.icon);
  const initialIcon = normalizeOptionalText(initialFund.icon);
  if (nextIcon !== initialIcon) {
    payload.icon = nextIcon;
  }

  if (values.allowNegativeBalance !== initialFund.allowNegativeBalance) {
    payload.allowNegativeBalance = values.allowNegativeBalance;
  }

  return Object.keys(payload).length > 0 ? payload : null;
}

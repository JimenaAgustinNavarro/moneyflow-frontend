import { z } from 'zod';
import { isValidGregorianDateString } from '@/lib/formatters';
import { FUND_CURRENCIES, isValidUuid } from '@/lib/funds-schemas';
import {
  compareMoney,
  isPositiveMoneyString,
  normalizeMoney,
  subMoney,
  sumMoney,
} from '@/lib/money';
import type { FundCurrencyCode } from '@/types/funds';
import type {
  AdjustmentDirection,
  ListTransactionsParams,
  RecordAdjustmentPayload,
  RecordableTransactionType,
  RecordTransactionPayload,
  RecordTransferPayload,
  RefundTransactionPayload,
  TransactionSplitInput,
  TransactionStatusValue,
  TransactionTypeValue,
  TransactionView,
  VoidTransactionPayload,
} from '@/types/ledger';

export const POSITIVE_MONEY_INPUT_REGEX = /^\d{1,12}(\.\d{1,2})?$/;
export const MAX_LEDGER_AMOUNT = '999999999999.99';
export const DESCRIPTION_MAX_LENGTH = 200;
export const NOTES_MAX_LENGTH = 500;
export const SPLIT_NOTE_MAX_LENGTH = 200;
export const MIN_SPLITS_COUNT = 2;
export const MAX_SPLITS_COUNT = 50;

export type LedgerFormMode = 'INCOME' | 'EXPENSE' | 'TRANSFER' | 'ADJUSTMENT';
export type AllocationMode = 'SINGLE' | 'SPLITS';

export interface SplitFormItemValues {
  categoryId: string;
  amount: string;
  note?: string;
}

export interface RecordTransactionFormValues {
  type: RecordableTransactionType;
  fundId: string;
  amount: string;
  occurredOn: string;
  description: string;
  notes?: string;
  allocationMode: AllocationMode;
  categoryId?: string;
  splits: SplitFormItemValues[];
}

export interface RecordTransferFormValues {
  sourceFundId: string;
  destinationFundId: string;
  amount: string;
  occurredOn: string;
  description: string;
  notes?: string;
}

export interface RecordAdjustmentFormValues {
  fundId: string;
  direction: AdjustmentDirection;
  amount: string;
  occurredOn: string;
  description: string;
  notes?: string;
}

export function parseInitialLedgerMode(rawType: string | null | undefined): LedgerFormMode {
  const normalized = rawType?.trim().toUpperCase();
  if (
    normalized === 'INCOME' ||
    normalized === 'EXPENSE' ||
    normalized === 'TRANSFER' ||
    normalized === 'ADJUSTMENT'
  ) {
    return normalized;
  }
  return 'EXPENSE';
}

export function isValidPositiveLedgerAmount(raw: string): boolean {
  const trimmed = raw.trim();
  if (!POSITIVE_MONEY_INPUT_REGEX.test(trimmed)) {
    return false;
  }
  if (!isPositiveMoneyString(trimmed)) {
    return false;
  }
  return compareMoney(trimmed, MAX_LEDGER_AMOUNT) <= 0;
}

const positiveAmountSchema = z
  .string()
  .trim()
  .min(1, 'El monto es obligatorio.')
  .refine(
    (val) => POSITIVE_MONEY_INPUT_REGEX.test(val),
    'El monto debe ser un número decimal positivo con hasta 2 decimales (máx. 12 dígitos enteros).',
  )
  .refine(
    (val) => isPositiveMoneyString(val) && compareMoney(val, MAX_LEDGER_AMOUNT) <= 0,
    'El monto debe ser mayor a 0.00 y no superar 999,999,999,999.99.',
  );

const gregorianDateSchema = z
  .string()
  .trim()
  .min(1, 'La fecha de operación es obligatoria.')
  .refine(
    (val) => isValidGregorianDateString(val),
    'Ingresa una fecha calendario válida en formato YYYY-MM-DD.',
  );

const descriptionSchema = z
  .string()
  .trim()
  .min(1, 'La descripción es obligatoria.')
  .max(
    DESCRIPTION_MAX_LENGTH,
    `La descripción no puede superar los ${DESCRIPTION_MAX_LENGTH} caracteres.`,
  );

const optionalNotesSchema = z
  .string()
  .optional()
  .refine(
    (val) => (val === undefined ? true : val.trim().length <= NOTES_MAX_LENGTH),
    `Las notas no pueden superar los ${NOTES_MAX_LENGTH} caracteres.`,
  );

export const splitItemSchema = z.object({
  categoryId: z.string().trim().min(1, 'Selecciona una categoría para esta división.'),
  amount: positiveAmountSchema,
  note: z
    .string()
    .optional()
    .refine(
      (val) => (val === undefined ? true : val.trim().length <= SPLIT_NOTE_MAX_LENGTH),
      `La nota de la división no puede superar los ${SPLIT_NOTE_MAX_LENGTH} caracteres.`,
    ),
});

const splitRawItemSchema = z.object({
  categoryId: z.string(),
  amount: z.string(),
  note: z.string().optional(),
});

export const recordTransactionFormSchema = z
  .object({
    type: z.enum(['INCOME', 'EXPENSE']),
    fundId: z.string().trim().min(1, 'Selecciona un fondo.'),
    amount: positiveAmountSchema,
    occurredOn: gregorianDateSchema,
    description: descriptionSchema,
    notes: optionalNotesSchema,
    allocationMode: z.enum(['SINGLE', 'SPLITS']),
    categoryId: z.string().optional(),
    splits: z.array(splitRawItemSchema),
  })
  .superRefine((data, ctx) => {
    if (data.allocationMode === 'SINGLE') {
      const catId = data.categoryId?.trim() ?? '';
      if (catId.length === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['categoryId'],
          message: 'Selecciona una categoría.',
        });
      }
      return;
    }

    if (data.splits.length < MIN_SPLITS_COUNT) {
      ctx.addIssue({
        code: 'custom',
        path: ['splits'],
        message: `Debes registrar al menos ${MIN_SPLITS_COUNT} divisiones.`,
      });
      return;
    }

    if (data.splits.length > MAX_SPLITS_COUNT) {
      ctx.addIssue({
        code: 'custom',
        path: ['splits'],
        message: `No puedes registrar más de ${MAX_SPLITS_COUNT} divisiones.`,
      });
      return;
    }

    let hasRowValidationErrors = false;
    data.splits.forEach((row, index) => {
      const rowResult = splitItemSchema.safeParse(row);
      if (!rowResult.success) {
        hasRowValidationErrors = true;
        for (const issue of rowResult.error.issues) {
          ctx.addIssue({
            code: 'custom',
            path: ['splits', index, ...issue.path],
            message: issue.message,
          });
        }
      }
    });

    if (hasRowValidationErrors || !isValidPositiveLedgerAmount(data.amount)) {
      return;
    }

    const totalNormalized = normalizeMoney(data.amount.trim());
    const splitsSum = sumMoney(data.splits.map((s) => normalizeMoney(s.amount.trim())));
    const remainingDiff = subMoney(totalNormalized, splitsSum);

    if (remainingDiff !== '0.00') {
      ctx.addIssue({
        code: 'custom',
        path: ['splits'],
        message: `La suma de las divisiones (${splitsSum}) debe coincidir exactamente con el monto total (${totalNormalized}). Diferencia restante: ${remainingDiff}.`,
      });
    }
  });

export const recordTransferFormSchema = z
  .object({
    sourceFundId: z.string().trim().min(1, 'Selecciona el fondo de origen.'),
    destinationFundId: z.string().trim().min(1, 'Selecciona el fondo de destino.'),
    amount: positiveAmountSchema,
    occurredOn: gregorianDateSchema,
    description: descriptionSchema,
    notes: optionalNotesSchema,
  })
  .superRefine((data, ctx) => {
    const source = data.sourceFundId.trim().toLowerCase();
    const dest = data.destinationFundId.trim().toLowerCase();
    if (source.length > 0 && dest.length > 0 && source === dest) {
      ctx.addIssue({
        code: 'custom',
        path: ['destinationFundId'],
        message: 'El fondo de destino debe ser distinto al fondo de origen.',
      });
    }
  });

export const recordAdjustmentFormSchema = z.object({
  fundId: z.string().trim().min(1, 'Selecciona un fondo.'),
  direction: z.enum(['INCREASE', 'DECREASE']),
  amount: positiveAmountSchema,
  occurredOn: gregorianDateSchema,
  description: descriptionSchema,
  notes: optionalNotesSchema,
});

export function buildRecordTransactionPayload(
  values: RecordTransactionFormValues,
): RecordTransactionPayload {
  const trimmedNotes = values.notes?.trim() ?? '';
  const basePayload: RecordTransactionPayload = {
    type: values.type,
    fundId: values.fundId.trim(),
    amount: normalizeMoney(values.amount.trim()),
    occurredOn: values.occurredOn.trim(),
    description: values.description.trim(),
    ...(trimmedNotes.length > 0 ? { notes: trimmedNotes } : {}),
  };

  if (values.allocationMode === 'SINGLE') {
    return {
      ...basePayload,
      categoryId: (values.categoryId ?? '').trim(),
    };
  }

  const normalizedSplits: TransactionSplitInput[] = values.splits.map((item) => {
    const trimmedNote = item.note?.trim() ?? '';
    return {
      categoryId: item.categoryId.trim(),
      amount: normalizeMoney(item.amount.trim()),
      ...(trimmedNote.length > 0 ? { note: trimmedNote } : {}),
    };
  });

  return {
    ...basePayload,
    splits: normalizedSplits,
  };
}

export function buildRecordTransferPayload(
  values: RecordTransferFormValues,
): RecordTransferPayload {
  const trimmedNotes = values.notes?.trim() ?? '';
  return {
    sourceFundId: values.sourceFundId.trim(),
    destinationFundId: values.destinationFundId.trim(),
    amount: normalizeMoney(values.amount.trim()),
    occurredOn: values.occurredOn.trim(),
    description: values.description.trim(),
    ...(trimmedNotes.length > 0 ? { notes: trimmedNotes } : {}),
  };
}

export function buildRecordAdjustmentPayload(
  values: RecordAdjustmentFormValues,
): RecordAdjustmentPayload {
  const trimmedNotes = values.notes?.trim() ?? '';
  return {
    fundId: values.fundId.trim(),
    direction: values.direction,
    amount: normalizeMoney(values.amount.trim()),
    occurredOn: values.occurredOn.trim(),
    description: values.description.trim(),
    ...(trimmedNotes.length > 0 ? { notes: trimmedNotes } : {}),
  };
}

export function buildLedgerPayloadFingerprint(
  mode: LedgerFormMode,
  payload: RecordTransactionPayload | RecordTransferPayload | RecordAdjustmentPayload,
): string {
  return `${mode}:${JSON.stringify(payload)}`;
}

// --- MF-021: Filtros de historial, detalle, anulación (VOID) y reembolso (REFUND) ---

export const SEARCH_MAX_LENGTH = 100;
export const DEFAULT_TRANSACTIONS_PAGE = 1;
export const DEFAULT_TRANSACTIONS_LIMIT = 20;
export const MAX_TRANSACTIONS_LIMIT = 100;

export const TRANSACTION_TYPES: readonly TransactionTypeValue[] = [
  'INCOME',
  'EXPENSE',
  'TRANSFER',
  'ADJUSTMENT',
  'VOID',
  'REFUND',
];

export const TRANSACTION_TYPE_LABELS: Record<TransactionTypeValue, string> = {
  INCOME: 'Ingreso',
  EXPENSE: 'Gasto',
  TRANSFER: 'Transferencia',
  ADJUSTMENT: 'Ajuste',
  VOID: 'Anulación',
  REFUND: 'Reembolso',
};

export const TRANSACTION_STATUSES: readonly TransactionStatusValue[] = ['POSTED', 'VOIDED'];

export const TRANSACTION_STATUS_LABELS: Record<TransactionStatusValue, string> = {
  POSTED: 'Vigente',
  VOIDED: 'Anulada',
};

export function canVoidTransaction(tx: Pick<TransactionView, 'type' | 'status'>): boolean {
  if (tx.status !== 'POSTED') {
    return false;
  }
  return (
    tx.type === 'INCOME' ||
    tx.type === 'EXPENSE' ||
    tx.type === 'TRANSFER' ||
    tx.type === 'ADJUSTMENT'
  );
}

export function canRefundTransaction(tx: Pick<TransactionView, 'type' | 'status'>): boolean {
  return tx.type === 'EXPENSE' && tx.status === 'POSTED';
}

export interface TransactionFiltersState {
  page: number;
  limit: number;
  fundId?: string;
  categoryId?: string;
  type?: TransactionTypeValue;
  status?: TransactionStatusValue;
  currency?: FundCurrencyCode;
  fromDate?: string;
  toDate?: string;
  search?: string;
}

export interface ParsedTransactionsFiltersResult {
  filters: TransactionFiltersState;
  rawFromDate: string;
  rawToDate: string;
  dateError: string | null;
  hasActiveFilters: boolean;
}

export function validateTransactionDateRange(fromDate: string, toDate: string): string | null {
  const trimmedFrom = fromDate.trim();
  const trimmedTo = toDate.trim();

  if (trimmedFrom.length > 0 && !isValidGregorianDateString(trimmedFrom)) {
    return 'La fecha "Desde" debe ser una fecha calendario válida (YYYY-MM-DD).';
  }

  if (trimmedTo.length > 0 && !isValidGregorianDateString(trimmedTo)) {
    return 'La fecha "Hasta" debe ser una fecha calendario válida (YYYY-MM-DD).';
  }

  if (trimmedFrom.length > 0 && trimmedTo.length > 0 && trimmedFrom > trimmedTo) {
    return 'La fecha "Desde" no puede ser posterior a la fecha "Hasta".';
  }

  return null;
}

function parsePositiveIntWithBounds(
  raw: string | null,
  fallback: number,
  maxValue?: number,
): number {
  if (!raw) {
    return fallback;
  }
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) {
    return fallback;
  }
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    return fallback;
  }
  if (maxValue !== undefined && parsed > maxValue) {
    return maxValue;
  }
  return parsed;
}

export function parseTransactionsSearchParams(
  searchParams: Pick<URLSearchParams, 'get'>,
): ParsedTransactionsFiltersResult {
  const page = parsePositiveIntWithBounds(searchParams.get('page'), DEFAULT_TRANSACTIONS_PAGE);
  const limit = parsePositiveIntWithBounds(
    searchParams.get('limit'),
    DEFAULT_TRANSACTIONS_LIMIT,
    MAX_TRANSACTIONS_LIMIT,
  );

  const rawFundId = searchParams.get('fundId')?.trim() ?? '';
  const fundId = rawFundId.length > 0 && isValidUuid(rawFundId) ? rawFundId : undefined;

  const rawCategoryId = searchParams.get('categoryId')?.trim() ?? '';
  const categoryId =
    rawCategoryId.length > 0 && isValidUuid(rawCategoryId) ? rawCategoryId : undefined;

  const rawType = searchParams.get('type')?.trim().toUpperCase() ?? '';
  const type = TRANSACTION_TYPES.includes(rawType as TransactionTypeValue)
    ? (rawType as TransactionTypeValue)
    : undefined;

  const rawStatus = searchParams.get('status')?.trim().toUpperCase() ?? '';
  const status = TRANSACTION_STATUSES.includes(rawStatus as TransactionStatusValue)
    ? (rawStatus as TransactionStatusValue)
    : undefined;

  const rawCurrency = searchParams.get('currency')?.trim().toUpperCase() ?? '';
  const currency = FUND_CURRENCIES.includes(rawCurrency as FundCurrencyCode)
    ? (rawCurrency as FundCurrencyCode)
    : undefined;

  const rawFromDate = searchParams.get('fromDate')?.trim() ?? '';
  const rawToDate = searchParams.get('toDate')?.trim() ?? '';
  const dateError = validateTransactionDateRange(rawFromDate, rawToDate);

  const fromDate =
    rawFromDate.length > 0 && isValidGregorianDateString(rawFromDate) ? rawFromDate : undefined;
  const toDate =
    rawToDate.length > 0 && isValidGregorianDateString(rawToDate) ? rawToDate : undefined;

  const rawSearch = searchParams.get('search')?.trim() ?? '';
  const search =
    rawSearch.length > 0 ? rawSearch.slice(0, SEARCH_MAX_LENGTH) : undefined;

  const filters: TransactionFiltersState = {
    page,
    limit,
    ...(fundId ? { fundId } : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(type ? { type } : {}),
    ...(status ? { status } : {}),
    ...(currency ? { currency } : {}),
    ...(fromDate ? { fromDate } : {}),
    ...(toDate ? { toDate } : {}),
    ...(search ? { search } : {}),
  };

  const hasActiveFilters = Boolean(
    fundId ||
      categoryId ||
      type ||
      status ||
      currency ||
      rawFromDate.length > 0 ||
      rawToDate.length > 0 ||
      search ||
      limit !== DEFAULT_TRANSACTIONS_LIMIT,
  );

  return {
    filters,
    rawFromDate,
    rawToDate,
    dateError,
    hasActiveFilters,
  };
}

export function buildTransactionsUrlSearchParams(
  filters: ListTransactionsParams,
): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.page !== undefined && filters.page > DEFAULT_TRANSACTIONS_PAGE) {
    params.set('page', String(filters.page));
  }
  if (filters.limit !== undefined && filters.limit !== DEFAULT_TRANSACTIONS_LIMIT) {
    params.set('limit', String(filters.limit));
  }
  if (filters.fundId) {
    params.set('fundId', filters.fundId);
  }
  if (filters.categoryId) {
    params.set('categoryId', filters.categoryId);
  }
  if (filters.type) {
    params.set('type', filters.type);
  }
  if (filters.status) {
    params.set('status', filters.status);
  }
  if (filters.currency) {
    params.set('currency', filters.currency);
  }
  if (filters.fromDate) {
    params.set('fromDate', filters.fromDate);
  }
  if (filters.toDate) {
    params.set('toDate', filters.toDate);
  }
  if (filters.search) {
    params.set('search', filters.search);
  }

  return params;
}

export interface VoidTransactionFormValues {
  reason?: string;
  occurredOn: string;
  notes?: string;
}

export function createVoidTransactionFormSchema(originalOccurredOn: string) {
  return z.object({
    reason: z
      .string()
      .optional()
      .refine(
        (val) => (val === undefined ? true : val.trim().length <= DESCRIPTION_MAX_LENGTH),
        `El motivo no puede superar los ${DESCRIPTION_MAX_LENGTH} caracteres.`,
      ),
    occurredOn: gregorianDateSchema.refine(
      (val) => val.trim() >= originalOccurredOn,
      'La fecha de anulación no puede ser anterior a la fecha del movimiento original.',
    ),
    notes: optionalNotesSchema,
  });
}

export function buildVoidTransactionPayload(
  values: VoidTransactionFormValues,
): VoidTransactionPayload {
  const trimmedReason = values.reason?.trim() ?? '';
  const trimmedNotes = values.notes?.trim() ?? '';

  return {
    ...(trimmedReason.length > 0 ? { reason: trimmedReason } : {}),
    occurredOn: values.occurredOn.trim(),
    ...(trimmedNotes.length > 0 ? { notes: trimmedNotes } : {}),
  };
}

export function buildVoidPayloadFingerprint(
  transactionId: string,
  payload: VoidTransactionPayload,
): string {
  return `VOID:${transactionId}:${JSON.stringify(payload)}`;
}

export interface RefundTransactionFormValues {
  amount: string;
  occurredOn: string;
  description?: string;
  notes?: string;
}

export function createRefundTransactionFormSchema(
  originalAmount: string,
  originalOccurredOn: string,
) {
  return z.object({
    amount: positiveAmountSchema.refine(
      (val) => compareMoney(normalizeMoney(val.trim()), normalizeMoney(originalAmount)) <= 0,
      'El reembolso no puede superar el monto del gasto original.',
    ),
    occurredOn: gregorianDateSchema.refine(
      (val) => val.trim() >= originalOccurredOn,
      'La fecha de reembolso no puede ser anterior a la fecha del gasto original.',
    ),
    description: z
      .string()
      .optional()
      .refine(
        (val) => (val === undefined ? true : val.trim().length <= DESCRIPTION_MAX_LENGTH),
        `La descripción no puede superar los ${DESCRIPTION_MAX_LENGTH} caracteres.`,
      ),
    notes: optionalNotesSchema,
  });
}

export function buildRefundTransactionPayload(
  values: RefundTransactionFormValues,
): RefundTransactionPayload {
  const trimmedDescription = values.description?.trim() ?? '';
  const trimmedNotes = values.notes?.trim() ?? '';

  return {
    amount: normalizeMoney(values.amount.trim()),
    occurredOn: values.occurredOn.trim(),
    ...(trimmedDescription.length > 0 ? { description: trimmedDescription } : {}),
    ...(trimmedNotes.length > 0 ? { notes: trimmedNotes } : {}),
  };
}

export function buildRefundPayloadFingerprint(
  transactionId: string,
  payload: RefundTransactionPayload,
): string {
  return `REFUND:${transactionId}:${JSON.stringify(payload)}`;
}

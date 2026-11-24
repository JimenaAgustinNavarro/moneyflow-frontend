import { z } from 'zod';
import { isValidGregorianDateString } from '@/lib/formatters';
import {
  compareMoney,
  isPositiveMoneyString,
  normalizeMoney,
  subMoney,
  sumMoney,
} from '@/lib/money';
import type {
  AdjustmentDirection,
  RecordAdjustmentPayload,
  RecordableTransactionType,
  RecordTransactionPayload,
  RecordTransferPayload,
  TransactionSplitInput,
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

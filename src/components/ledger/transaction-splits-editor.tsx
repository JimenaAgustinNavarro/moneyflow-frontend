'use client';

import * as React from 'react';
import type { FieldArrayWithId, FieldErrors, UseFormRegister } from 'react-hook-form';
import { AlertCircle, CheckCircle2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  isValidPositiveLedgerAmount,
  MAX_SPLITS_COUNT,
  MIN_SPLITS_COUNT,
  SPLIT_NOTE_MAX_LENGTH,
  type RecordTransactionFormValues,
} from '@/lib/ledger-schemas';
import {
  formatCurrency,
  isZeroMoney,
  normalizeMoney,
  subMoney,
  sumMoney,
} from '@/lib/money';
import type { CategoryView } from '@/types/categories';
import type { FundCurrencyCode } from '@/types/funds';

export interface TransactionSplitsEditorProps {
  fields: FieldArrayWithId<RecordTransactionFormValues, 'splits', 'id'>[];
  watchedSplits: RecordTransactionFormValues['splits'];
  totalAmount: string;
  currency: FundCurrencyCode;
  availableCategories: CategoryView[];
  register: UseFormRegister<RecordTransactionFormValues>;
  errors: FieldErrors<RecordTransactionFormValues>;
  disabled?: boolean;
  onAddSplit: () => void;
  onRemoveSplit: (index: number) => void;
}

export function TransactionSplitsEditor({
  fields,
  watchedSplits,
  totalAmount,
  currency,
  availableCategories,
  register,
  errors,
  disabled = false,
  onAddSplit,
  onRemoveSplit,
}: TransactionSplitsEditorProps): React.JSX.Element {
  const hasValidTotal = isValidPositiveLedgerAmount(totalAmount);
  const normalizedTotal = hasValidTotal ? normalizeMoney(totalAmount.trim()) : '0.00';

  const validRowAmounts = (watchedSplits ?? []).map((row) => {
    const raw = row?.amount ?? '';
    return isValidPositiveLedgerAmount(raw) ? normalizeMoney(raw.trim()) : '0.00';
  });

  const allRowsValid =
    (watchedSplits?.length ?? 0) >= MIN_SPLITS_COUNT &&
    watchedSplits.every((row) => isValidPositiveLedgerAmount(row?.amount ?? ''));
  const splitsSum = sumMoney(validRowAmounts);
  const remainingDiff = subMoney(normalizedTotal, splitsSum);
  const isBalanced = hasValidTotal && allRowsValid && isZeroMoney(remainingDiff);

  const rootSplitsError =
    errors.splits && typeof errors.splits === 'object' && 'message' in errors.splits
      ? (errors.splits.message as string | undefined)
      : errors.splits?.root?.message;

  return (
    <div className="space-y-4 rounded-xl border border-border bg-muted/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Desglose por categorías (Splits)
          </h3>
          <p className="text-xs text-muted-foreground">
            Divide el movimiento entre {MIN_SPLITS_COUNT} y {MAX_SPLITS_COUNT} categorías. La suma
            debe cuadrar exactamente con el total.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onAddSplit}
          disabled={disabled || fields.length >= MAX_SPLITS_COUNT}
          className="gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" />
          Agregar división
        </Button>
      </div>

      <div className="space-y-3">
        {fields.map((field, index) => {
          const rowErrors = Array.isArray(errors.splits) ? errors.splits[index] : undefined;
          const catFieldId = `split-category-${index}`;
          const amtFieldId = `split-amount-${index}`;
          const noteFieldId = `split-note-${index}`;

          return (
            <div
              key={field.id}
              data-testid={`split-row-${index}`}
              className="grid gap-3 rounded-lg border border-border bg-card p-3 sm:grid-cols-12"
            >
              <div className="space-y-1 sm:col-span-5">
                <Label htmlFor={catFieldId} className="text-xs">
                  Categoría #{index + 1}
                </Label>
                <select
                  id={catFieldId}
                  disabled={disabled}
                  aria-invalid={Boolean(rowErrors?.categoryId)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  {...register(`splits.${index}.categoryId`)}
                >
                  <option value="">Selecciona categoría...</option>
                  {availableCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
                {rowErrors?.categoryId?.message && (
                  <p role="alert" className="text-xs text-destructive">
                    {rowErrors.categoryId.message}
                  </p>
                )}
              </div>

              <div className="space-y-1 sm:col-span-3">
                <Label htmlFor={amtFieldId} className="text-xs">
                  Monto ({currency})
                </Label>
                <Input
                  id={amtFieldId}
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  disabled={disabled}
                  aria-invalid={Boolean(rowErrors?.amount)}
                  {...register(`splits.${index}.amount`)}
                />
                {rowErrors?.amount?.message && (
                  <p role="alert" className="text-xs text-destructive">
                    {rowErrors.amount.message}
                  </p>
                )}
              </div>

              <div className="space-y-1 sm:col-span-3">
                <Label htmlFor={noteFieldId} className="text-xs">
                  Nota opcional
                </Label>
                <Input
                  id={noteFieldId}
                  type="text"
                  maxLength={SPLIT_NOTE_MAX_LENGTH}
                  placeholder="Detalle breve"
                  disabled={disabled}
                  aria-invalid={Boolean(rowErrors?.note)}
                  {...register(`splits.${index}.note`)}
                />
                {rowErrors?.note?.message && (
                  <p role="alert" className="text-xs text-destructive">
                    {rowErrors.note.message}
                  </p>
                )}
              </div>

              <div className="flex items-end justify-end sm:col-span-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => onRemoveSplit(index)}
                  disabled={disabled || fields.length <= MIN_SPLITS_COUNT}
                  aria-label={`Eliminar división ${index + 1}`}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <div
        data-testid="splits-summary-panel"
        className="grid gap-3 rounded-lg border border-border bg-card p-3 sm:grid-cols-3"
      >
        <div>
          <p className="text-xs text-muted-foreground">Total operación</p>
          <p data-testid="splits-total-operation" className="text-sm font-semibold text-foreground">
            {formatCurrency(normalizedTotal, currency)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Suma splits</p>
          <p data-testid="splits-sum-amount" className="text-sm font-semibold text-foreground">
            {formatCurrency(splitsSum, currency)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Diferencia restante</p>
          <div className="flex items-center gap-1.5">
            {isBalanced ? (
              <CheckCircle2 className="h-4 w-4 text-income" aria-hidden="true" />
            ) : (
              <AlertCircle className="h-4 w-4 text-destructive" aria-hidden="true" />
            )}
            <p
              data-testid="splits-remaining-diff"
              className={`text-sm font-semibold ${
                isBalanced ? 'text-income' : 'text-destructive'
              }`}
            >
              {formatCurrency(remainingDiff, currency)}
            </p>
          </div>
        </div>
      </div>

      {!isBalanced && hasValidTotal && (
        <p role="alert" className="text-xs font-medium text-destructive">
          La diferencia restante debe ser exactamente 0.00 para registrar el movimiento.
        </p>
      )}

      {rootSplitsError && (
        <p role="alert" className="text-xs font-medium text-destructive">
          {rootSplitsError}
        </p>
      )}
    </div>
  );
}

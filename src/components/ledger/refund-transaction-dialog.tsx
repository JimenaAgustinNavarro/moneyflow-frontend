'use client';

import * as React from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, ArrowRight, CheckCircle2, Loader2, RotateCcw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getApiErrorMessage } from '@/lib/api-error-messages';
import { formatDate, getTodayLimaDateString } from '@/lib/formatters';
import { ledgerApi } from '@/lib/ledger-api';
import {
  buildRefundPayloadFingerprint,
  buildRefundTransactionPayload,
  createRefundTransactionFormSchema,
  DESCRIPTION_MAX_LENGTH,
  NOTES_MAX_LENGTH,
  type RefundTransactionFormValues,
} from '@/lib/ledger-schemas';
import { formatCurrency } from '@/lib/money';
import { useIdempotencyKey } from '@/lib/use-idempotency-key';
import type { RefundTransactionResponse, TransactionDetailView } from '@/types/ledger';

export interface RefundTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: TransactionDetailView;
  fundName?: string;
  onSuccess: () => void | Promise<void>;
}

function resolveDefaultOccurredOn(originalOccurredOn: string): string {
  const todayLima = getTodayLimaDateString();
  return todayLima >= originalOccurredOn ? todayLima : originalOccurredOn;
}

export function RefundTransactionDialog({
  open,
  onOpenChange,
  transaction,
  fundName,
  onSuccess,
}: RefundTransactionDialogProps): React.JSX.Element {
  const titleId = React.useId();
  const descriptionId = React.useId();
  const amountId = React.useId();
  const occurredOnId = React.useId();
  const refundDescriptionId = React.useId();
  const notesId = React.useId();

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const isSubmittingRef = React.useRef(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [confirmationResult, setConfirmationResult] =
    React.useState<RefundTransactionResponse | null>(null);

  const { getOrCreateKey, invalidateKey, rotateKey } = useIdempotencyKey();

  const schema = React.useMemo(
    () => createRefundTransactionFormSchema(transaction.amount, transaction.occurredOn),
    [transaction.amount, transaction.occurredOn],
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RefundTransactionFormValues>({
    resolver: zodResolver(schema),
    mode: 'onSubmit',
    defaultValues: {
      amount: '',
      occurredOn: resolveDefaultOccurredOn(transaction.occurredOn),
      description: '',
      notes: '',
    },
  });

  React.useEffect(() => {
    if (open) {
      reset({
        amount: '',
        occurredOn: resolveDefaultOccurredOn(transaction.occurredOn),
        description: '',
        notes: '',
      });
      setSubmitError(null);
      setConfirmationResult(null);
      setIsSubmitting(false);
      isSubmittingRef.current = false;
      invalidateKey();
    }
  }, [open, transaction.id, transaction.occurredOn, reset, invalidateKey]);

  const defaultDescriptionPreview = `Reembolso: ${transaction.description}`.slice(
    0,
    DESCRIPTION_MAX_LENGTH,
  );

  const onSubmit = async (values: RefundTransactionFormValues): Promise<void> => {
    if (isSubmittingRef.current || isSubmitting) {
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const payload = buildRefundTransactionPayload(values);
      const fingerprint = buildRefundPayloadFingerprint(transaction.id, payload);
      const idempotencyKey = getOrCreateKey(fingerprint);

      const response = await ledgerApi.refundTransaction(transaction.id, payload, {
        idempotencyKey,
      });

      setConfirmationResult(response);
      rotateKey();
      await onSuccess();
    } catch (error) {
      setSubmitError(
        getApiErrorMessage(error, 'No se pudo registrar el reembolso. Inténtalo nuevamente.'),
      );
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      titleId={titleId}
      descriptionId={descriptionId}
      closeDisabled={isSubmitting}
    >
      <DialogHeader>
        <DialogTitle id={titleId} className="flex items-center gap-2">
          <RotateCcw className="h-5 w-5 text-income" />
          <span>Registrar reembolso</span>
        </DialogTitle>
        <DialogDescription id={descriptionId}>
          Acredita una devolución total o parcial en el fondo original del gasto sin superar su monto
          acumulado.
        </DialogDescription>
      </DialogHeader>

      {confirmationResult ? (
        <div className="space-y-4" data-testid="refund-confirmation-panel">
          <Alert variant="success">
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>Reembolso registrado correctamente</AlertTitle>
            <AlertDescription className="space-y-1">
              <p>
                Se acreditaron{' '}
                <strong>
                  {formatCurrency(
                    confirmationResult.refundTransaction.amount,
                    transaction.currency,
                  )}
                </strong>{' '}
                el <strong>{formatDate(confirmationResult.refundTransaction.occurredOn)}</strong>.
              </p>
              <Link
                href={`/transactions/${confirmationResult.refundTransaction.id}`}
                onClick={() => onOpenChange(false)}
                className="inline-flex items-center gap-1 font-medium text-primary underline underline-offset-4"
              >
                <span>Ver movimiento de reembolso</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </AlertDescription>
          </Alert>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-border bg-secondary/30 p-3">
              <p className="text-xs text-muted-foreground">Total reembolsado</p>
              <p
                data-testid="refund-total-after"
                className="mt-1 text-sm font-semibold tabular-nums text-foreground"
              >
                {formatCurrency(confirmationResult.totalRefundedAfter, transaction.currency)}
              </p>
            </div>

            <div className="rounded-lg border border-border bg-secondary/30 p-3">
              <p className="text-xs text-muted-foreground">Saldo reembolsable</p>
              <p
                data-testid="refund-remaining-amount"
                className="mt-1 text-sm font-semibold tabular-nums text-foreground"
              >
                {formatCurrency(
                  confirmationResult.remainingRefundableAmount,
                  transaction.currency,
                )}
              </p>
            </div>

            <div className="rounded-lg border border-border bg-secondary/30 p-3">
              <p className="text-xs text-muted-foreground">
                Saldo en {fundName ?? 'el fondo'}
              </p>
              <p
                data-testid="refund-fund-balance-after"
                className="mt-1 text-sm font-semibold tabular-nums text-foreground"
              >
                {formatCurrency(confirmationResult.fundBalanceAfter, transaction.currency)}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="rounded-lg border border-border bg-secondary/30 p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-medium text-foreground">{transaction.description}</span>
              <span className="shrink-0 font-semibold tabular-nums text-foreground">
                {formatCurrency(transaction.amount, transaction.currency)}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Gasto original del {formatDate(transaction.occurredOn)}
              {fundName ? ` · Fondo: ${fundName}` : ''}
            </p>
          </div>

          {submitError && (
            <Alert variant="destructive" data-testid="refund-submit-error">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-1.5">
            <Label htmlFor={amountId}>Monto a reembolsar ({transaction.currency})</Label>
            <Input
              id={amountId}
              type="text"
              inputMode="decimal"
              placeholder={`Máximo ${transaction.amount}`}
              aria-invalid={Boolean(errors.amount)}
              disabled={isSubmitting}
              {...register('amount')}
            />
            {errors.amount && (
              <p className="text-xs text-destructive" role="alert">
                {errors.amount.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={occurredOnId}>Fecha de reembolso</Label>
            <Input
              id={occurredOnId}
              type="date"
              min={transaction.occurredOn}
              aria-invalid={Boolean(errors.occurredOn)}
              disabled={isSubmitting}
              {...register('occurredOn')}
            />
            {errors.occurredOn && (
              <p className="text-xs text-destructive" role="alert">
                {errors.occurredOn.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={refundDescriptionId}>Descripción (opcional)</Label>
            <Input
              id={refundDescriptionId}
              type="text"
              maxLength={DESCRIPTION_MAX_LENGTH}
              placeholder={`Por defecto: ${defaultDescriptionPreview}`}
              aria-invalid={Boolean(errors.description)}
              disabled={isSubmitting}
              {...register('description')}
            />
            {errors.description && (
              <p className="text-xs text-destructive" role="alert">
                {errors.description.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={notesId}>Notas (opcional)</Label>
            <Input
              id={notesId}
              type="text"
              maxLength={NOTES_MAX_LENGTH}
              placeholder="Detalle adicional del reembolso"
              aria-invalid={Boolean(errors.notes)}
              disabled={isSubmitting}
              {...register('notes')}
            />
            {errors.notes && (
              <p className="text-xs text-destructive" role="alert">
                {errors.notes.message}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting} className="gap-2">
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>{isSubmitting ? 'Registrando...' : 'Confirmar reembolso'}</span>
            </Button>
          </DialogFooter>
        </form>
      )}
    </Dialog>
  );
}

'use client';

import * as React from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, ArrowRight, CheckCircle2, Loader2, Ban } from 'lucide-react';
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
  buildVoidPayloadFingerprint,
  buildVoidTransactionPayload,
  createVoidTransactionFormSchema,
  DESCRIPTION_MAX_LENGTH,
  NOTES_MAX_LENGTH,
  type VoidTransactionFormValues,
} from '@/lib/ledger-schemas';
import { formatCurrency } from '@/lib/money';
import { useIdempotencyKey } from '@/lib/use-idempotency-key';
import type { FundView } from '@/types/funds';
import type { TransactionDetailView, VoidTransactionResponse } from '@/types/ledger';

export interface VoidTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: TransactionDetailView;
  fundsById: ReadonlyMap<string, FundView>;
  onSuccess: () => void | Promise<void>;
}

function resolveDefaultOccurredOn(originalOccurredOn: string): string {
  const todayLima = getTodayLimaDateString();
  return todayLima >= originalOccurredOn ? todayLima : originalOccurredOn;
}

export function VoidTransactionDialog({
  open,
  onOpenChange,
  transaction,
  fundsById,
  onSuccess,
}: VoidTransactionDialogProps): React.JSX.Element {
  const titleId = React.useId();
  const descriptionId = React.useId();
  const reasonId = React.useId();
  const occurredOnId = React.useId();
  const notesId = React.useId();

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const isSubmittingRef = React.useRef(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [confirmationResult, setConfirmationResult] = React.useState<VoidTransactionResponse | null>(
    null,
  );

  const { getOrCreateKey, invalidateKey, rotateKey } = useIdempotencyKey();

  const schema = React.useMemo(
    () => createVoidTransactionFormSchema(transaction.occurredOn),
    [transaction.occurredOn],
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<VoidTransactionFormValues>({
    resolver: zodResolver(schema),
    mode: 'onSubmit',
    defaultValues: {
      reason: '',
      occurredOn: resolveDefaultOccurredOn(transaction.occurredOn),
      notes: '',
    },
  });

  React.useEffect(() => {
    if (open) {
      reset({
        reason: '',
        occurredOn: resolveDefaultOccurredOn(transaction.occurredOn),
        notes: '',
      });
      setSubmitError(null);
      setConfirmationResult(null);
      setIsSubmitting(false);
      isSubmittingRef.current = false;
      invalidateKey();
    }
  }, [open, transaction.id, transaction.occurredOn, reset, invalidateKey]);

  const defaultReasonPreview = `Anulación: ${transaction.description}`.slice(
    0,
    DESCRIPTION_MAX_LENGTH,
  );

  const onSubmit = async (values: VoidTransactionFormValues): Promise<void> => {
    if (isSubmittingRef.current || isSubmitting) {
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const payload = buildVoidTransactionPayload(values);
      const fingerprint = buildVoidPayloadFingerprint(transaction.id, payload);
      const idempotencyKey = getOrCreateKey(fingerprint);

      const response = await ledgerApi.voidTransaction(transaction.id, payload, {
        idempotencyKey,
      });

      setConfirmationResult(response);
      rotateKey();
      await onSuccess();
    } catch (error) {
      setSubmitError(
        getApiErrorMessage(error, 'No se pudo anular el movimiento. Inténtalo nuevamente.'),
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
          <Ban className="h-5 w-5 text-destructive" />
          <span>Anular movimiento</span>
        </DialogTitle>
        <DialogDescription id={descriptionId}>
          Esta acción creará un contra-asiento contable de tipo Anulación y marcará el movimiento
          original como Anulada.
        </DialogDescription>
      </DialogHeader>

      {confirmationResult ? (
        <div className="space-y-4" data-testid="void-confirmation-panel">
          <Alert variant="success">
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>Movimiento anulado correctamente</AlertTitle>
            <AlertDescription className="space-y-1">
              <p>
                Se generó la anulación{' '}
                <strong>{confirmationResult.voidTransaction.description}</strong> con fecha{' '}
                <strong>{formatDate(confirmationResult.voidTransaction.occurredOn)}</strong>.
              </p>
              <Link
                href={`/transactions/${confirmationResult.voidTransaction.id}`}
                onClick={() => onOpenChange(false)}
                className="inline-flex items-center gap-1 font-medium text-primary underline underline-offset-4"
              >
                <span>Ver movimiento de anulación</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </AlertDescription>
          </Alert>

          <div className="space-y-2 rounded-lg border border-border bg-secondary/30 p-3">
            <p className="text-xs font-medium text-muted-foreground">
              Saldos actualizados tras la anulación
            </p>
            <ul className="space-y-1.5 text-sm">
              {confirmationResult.affectedFundBalances.map((item) => {
                const fund = fundsById.get(item.fundId.toLowerCase());
                const currency = fund?.currency ?? transaction.currency;
                return (
                  <li key={item.fundId} className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium text-foreground">
                      {fund?.name ?? 'Fondo afectado'}
                    </span>
                    <span className="font-semibold tabular-nums text-foreground">
                      {formatCurrency(item.balanceAfter, currency)}
                    </span>
                  </li>
                );
              })}
            </ul>
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
              Fecha original: {formatDate(transaction.occurredOn)}
            </p>
          </div>

          {submitError && (
            <Alert variant="destructive" data-testid="void-submit-error">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-1.5">
            <Label htmlFor={reasonId}>Motivo (opcional)</Label>
            <Input
              id={reasonId}
              type="text"
              maxLength={DESCRIPTION_MAX_LENGTH}
              placeholder={`Por defecto: ${defaultReasonPreview}`}
              aria-invalid={Boolean(errors.reason)}
              disabled={isSubmitting}
              {...register('reason')}
            />
            <p className="text-xs text-muted-foreground">
              Si se deja vacío, el servidor generará &ldquo;{defaultReasonPreview}&rdquo;.
            </p>
            {errors.reason && (
              <p className="text-xs text-destructive" role="alert">
                {errors.reason.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={occurredOnId}>Fecha de anulación</Label>
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
            <Label htmlFor={notesId}>Notas (opcional)</Label>
            <Input
              id={notesId}
              type="text"
              maxLength={NOTES_MAX_LENGTH}
              placeholder="Detalle adicional sobre la anulación"
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
            <Button
              type="submit"
              variant="destructive"
              disabled={isSubmitting}
              className="gap-2"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>{isSubmitting ? 'Anulando...' : 'Confirmar anulación'}</span>
            </Button>
          </DialogFooter>
        </form>
      )}
    </Dialog>
  );
}

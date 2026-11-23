'use client';

import * as React from 'react';
import Link from 'next/link';
import { AlertCircle, AlertTriangle, ArrowLeftRight } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getApiErrorMessage } from '@/lib/api-error-messages';
import { fundsApi } from '@/lib/funds-api';
import { formatCurrency, isZeroMoney } from '@/lib/money';
import type { FundView } from '@/types/funds';

export interface ArchiveFundDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fund: FundView | null;
  onSuccess: (archivedFund: FundView) => void;
}

export function ArchiveFundDialog({
  open,
  onOpenChange,
  fund,
  onSuccess,
}: ArchiveFundDialogProps): React.JSX.Element {
  const titleId = React.useId();
  const descriptionId = React.useId();

  const [isArchiving, setIsArchiving] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setErrorMessage(null);
      setIsArchiving(false);
    }
  }, [open, fund?.id]);

  const hasNonZeroBalance = fund ? !isZeroMoney(fund.balance) : false;

  const handleConfirmArchive = async (): Promise<void> => {
    if (!fund || hasNonZeroBalance) {
      return;
    }

    setIsArchiving(true);
    setErrorMessage(null);
    try {
      const response = await fundsApi.archive(fund.id);
      onOpenChange(false);
      onSuccess(response.fund);
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'No se pudo archivar el fondo.'));
    } finally {
      setIsArchiving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      titleId={titleId}
      descriptionId={descriptionId}
      closeDisabled={isArchiving}
    >
      <DialogHeader>
        <DialogTitle id={titleId}>Archivar fondo</DialogTitle>
        <DialogDescription id={descriptionId}>
          Esta acción realizará un archivado lógico. El historial contable en el ledger se
          conservará intacto.
        </DialogDescription>
      </DialogHeader>

      {fund && (
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-secondary/30 p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-foreground">{fund.name}</span>
              <span className="font-semibold text-foreground">
                {formatCurrency(fund.balance, fund.currency)}
              </span>
            </div>
          </div>

          {hasNonZeroBalance && (
            <Alert variant="warning">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Saldo distinto de cero</AlertTitle>
              <AlertDescription className="space-y-2">
                <p>
                  El saldo actual debe quedar en 0.00 (mediante una transferencia o ajuste) antes de
                  poder archivar este fondo.
                </p>
                <Link
                  href={`/transactions/new?type=TRANSFER&fundId=${encodeURIComponent(fund.id)}`}
                  className="inline-flex items-center gap-1.5 font-medium text-primary underline underline-offset-4 hover:text-primary/80"
                >
                  <ArrowLeftRight className="h-3.5 w-3.5" />
                  <span>Registrar transferencia</span>
                </Link>
              </AlertDescription>
            </Alert>
          )}

          {errorMessage && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}
        </div>
      )}

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          disabled={isArchiving}
          onClick={() => onOpenChange(false)}
        >
          Cancelar
        </Button>
        <Button
          type="button"
          variant="destructive"
          disabled={isArchiving || !fund || hasNonZeroBalance}
          onClick={() => void handleConfirmArchive()}
        >
          {isArchiving ? 'Archivando...' : 'Confirmar archivado'}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

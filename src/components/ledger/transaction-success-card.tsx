'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowLeftRight, CheckCircle2, PlusCircle, Wallet } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { formatDate } from '@/lib/formatters';
import { formatCurrency } from '@/lib/money';
import type { FundView } from '@/types/funds';
import type {
  RecordAdjustmentResponse,
  RecordTransactionResponse,
  RecordTransferResponse,
} from '@/types/ledger';

export type LedgerCreationResult =
  | {
      kind: 'TRANSACTION';
      response: RecordTransactionResponse;
      fund: FundView | undefined;
    }
  | {
      kind: 'TRANSFER';
      response: RecordTransferResponse;
      sourceFund: FundView | undefined;
      destinationFund: FundView | undefined;
    }
  | {
      kind: 'ADJUSTMENT';
      response: RecordAdjustmentResponse;
      fund: FundView | undefined;
      direction: 'INCREASE' | 'DECREASE';
    };

export interface TransactionSuccessCardProps {
  result: LedgerCreationResult;
  onRecordAnother: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  INCOME: 'Ingreso registrado',
  EXPENSE: 'Egreso registrado',
  TRANSFER: 'Transferencia registrada',
  ADJUSTMENT: 'Ajuste manual registrado',
};

export function TransactionSuccessCard({
  result,
  onRecordAnother,
}: TransactionSuccessCardProps): React.JSX.Element {
  const { transaction } = result.response;
  const titleLabel = TYPE_LABELS[transaction.type] ?? 'Movimiento registrado';

  let safeFormattedDate = transaction.occurredOn;
  try {
    safeFormattedDate = formatDate(transaction.occurredOn);
  } catch {
    safeFormattedDate = transaction.occurredOn;
  }

  const targetFundId =
    result.kind === 'TRANSFER'
      ? (result.sourceFund?.id ?? result.response.transaction.entries[0]?.fundId)
      : (result.fund?.id ?? result.response.transaction.entries[0]?.fundId);
  const viewFundHref = targetFundId ? `/funds/${encodeURIComponent(targetFundId)}` : '/funds';

  return (
    <Card data-testid="transaction-success-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-income">
          <CheckCircle2 className="h-5 w-5" />
          <span>{titleLabel}</span>
        </CardTitle>
        <CardDescription>
          La operación fue confirmada en el ledger y los saldos han sido actualizados.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <Alert variant="success">
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>{transaction.description}</AlertTitle>
          <AlertDescription>
            Monto: <strong>{formatCurrency(transaction.amount, transaction.currency)}</strong> ·
            Fecha: <strong>{safeFormattedDate}</strong>
          </AlertDescription>
        </Alert>

        {result.kind === 'TRANSACTION' && (
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <p className="text-xs text-muted-foreground">
              Nuevo saldo en {result.fund?.name ?? 'fondo seleccionado'}
            </p>
            <p
              data-testid="confirmed-fund-balance-after"
              className="mt-1 text-lg font-bold text-foreground"
            >
              {formatCurrency(result.response.fundBalanceAfter, transaction.currency)}
            </p>
          </div>
        )}

        {result.kind === 'ADJUSTMENT' && (
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <p className="text-xs text-muted-foreground">
              Nuevo saldo en {result.fund?.name ?? 'fondo seleccionado'} (
              {result.direction === 'INCREASE' ? 'Aumento' : 'Disminución'})
            </p>
            <p
              data-testid="confirmed-fund-balance-after"
              className="mt-1 text-lg font-bold text-foreground"
            >
              {formatCurrency(result.response.fundBalanceAfter, transaction.currency)}
            </p>
          </div>
        )}

        {result.kind === 'TRANSFER' && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <p className="text-xs text-muted-foreground">
                Nuevo saldo origen ({result.sourceFund?.name ?? 'Origen'})
              </p>
              <p
                data-testid="confirmed-source-balance-after"
                className="mt-1 text-lg font-bold text-foreground"
              >
                {formatCurrency(result.response.sourceFundBalanceAfter, transaction.currency)}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <p className="text-xs text-muted-foreground">
                Nuevo saldo destino ({result.destinationFund?.name ?? 'Destino'})
              </p>
              <p
                data-testid="confirmed-destination-balance-after"
                className="mt-1 text-lg font-bold text-foreground"
              >
                {formatCurrency(result.response.destinationFundBalanceAfter, transaction.currency)}
              </p>
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
        <Button type="button" onClick={onRecordAnother} className="gap-2">
          <PlusCircle className="h-4 w-4" />
          Registrar otro movimiento
        </Button>

        <Link
          href={viewFundHref}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Wallet className="h-4 w-4" />
          Ver fondo
        </Link>

        <Link
          href="/transactions"
          className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeftRight className="h-4 w-4" />
          Ir a movimientos
        </Link>
      </CardFooter>
    </Card>
  );
}

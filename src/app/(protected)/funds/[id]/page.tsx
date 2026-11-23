'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  AlertCircle,
  Archive,
  ArrowLeft,
  ArrowRight,
  Pencil,
  Plus,
} from 'lucide-react';
import { ArchiveFundDialog } from '@/components/funds/archive-fund-dialog';
import { FundFormModal } from '@/components/funds/fund-form-modal';
import { FundIcon } from '@/components/funds/fund-icon';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getApiErrorMessage } from '@/lib/api-error-messages';
import { formatDate } from '@/lib/formatters';
import { fundsApi } from '@/lib/funds-api';
import { FUND_CURRENCY_LABELS, FUND_TYPE_LABELS, isValidUuid } from '@/lib/funds-schemas';
import { ledgerApi } from '@/lib/ledger-api';
import {
  formatCurrency,
  isNegativeMoney,
  isPositiveMoneyString,
  sumMoney,
} from '@/lib/money';
import type { FundDetailView } from '@/types/funds';
import type { TransactionDetailView, TransactionTypeValue } from '@/types/ledger';

const TRANSACTION_TYPE_LABELS: Record<TransactionTypeValue, string> = {
  INCOME: 'Ingreso',
  EXPENSE: 'Gasto',
  TRANSFER: 'Transferencia',
  ADJUSTMENT: 'Ajuste',
  VOID: 'Anulación',
  REFUND: 'Reembolso',
};

function computeFundImpact(tx: TransactionDetailView, fundId: string): string {
  const normalizedFundId = fundId.toLowerCase();
  const matchingAmounts = tx.entries
    .filter((entry) => entry.fundId.toLowerCase() === normalizedFundId)
    .map((entry) => entry.signedAmount);

  return sumMoney(matchingAmounts);
}

export default function FundDetailPage(): React.JSX.Element {
  const params = useParams();
  const rawId = params?.id;
  const fundId = typeof rawId === 'string' ? rawId : Array.isArray(rawId) ? rawId[0] ?? '' : '';
  const isUuidValid = isValidUuid(fundId);

  const [fund, setFund] = React.useState<FundDetailView | null>(null);
  const [transactions, setTransactions] = React.useState<TransactionDetailView[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const [isEditOpen, setIsEditOpen] = React.useState(false);
  const [isArchiveOpen, setIsArchiveOpen] = React.useState(false);

  const requestCounterRef = React.useRef(0);

  const loadDetail = React.useCallback(async () => {
    if (!isUuidValid) {
      setIsLoading(false);
      setFund(null);
      setTransactions([]);
      setErrorMessage('El identificador del fondo no es válido.');
      return;
    }

    const requestId = ++requestCounterRef.current;
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [fundResponse, ledgerResponse] = await Promise.all([
        fundsApi.getById(fundId),
        ledgerApi.list({ fundId, limit: 10 }),
      ]);

      if (requestId !== requestCounterRef.current) {
        return;
      }

      setFund(fundResponse.fund);
      setTransactions(ledgerResponse.items);
    } catch (error) {
      if (requestId !== requestCounterRef.current) {
        return;
      }
      setFund(null);
      setTransactions([]);
      setErrorMessage(getApiErrorMessage(error, 'No se pudo cargar el detalle del fondo.'));
    } finally {
      if (requestId === requestCounterRef.current) {
        setIsLoading(false);
      }
    }
  }, [fundId, isUuidValid]);

  React.useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  if (isLoading) {
    return (
      <section className="space-y-6" aria-busy="true">
        <div className="h-8 w-40 animate-pulse rounded-md bg-secondary" />
        <div className="h-44 animate-pulse rounded-xl border border-border bg-card/60" />
        <div className="h-64 animate-pulse rounded-xl border border-border bg-card/60" />
      </section>
    );
  }

  if (errorMessage || !fund) {
    return (
      <section className="space-y-6">
        <Link
          href="/funds"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Volver a fondos</span>
        </Link>

        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Fondo no disponible</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>{errorMessage ?? 'El fondo solicitado no fue encontrado.'}</p>
            <Link
              href="/funds"
              className="inline-flex items-center gap-1.5 text-sm font-medium underline underline-offset-4"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Ir al listado de fondos</span>
            </Link>
          </AlertDescription>
        </Alert>
      </section>
    );
  }

  const negativeBalance = isNegativeMoney(fund.balance);

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Link
            href="/funds"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Volver a fondos</span>
          </Link>

          <div className="flex flex-wrap items-center gap-3">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary text-foreground"
              style={
                fund.color
                  ? {
                      backgroundColor: `${fund.color}1A`,
                      borderColor: fund.color,
                      color: fund.color,
                    }
                  : undefined
              }
            >
              <FundIcon icon={fund.icon} type={fund.type} className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">{fund.name}</h1>
                <Badge variant="outline">{fund.currency}</Badge>
                {fund.isArchived && <Badge variant="secondary">Archivado</Badge>}
              </div>
              <p className="text-sm text-muted-foreground">
                {FUND_TYPE_LABELS[fund.type]} &middot; {FUND_CURRENCY_LABELS[fund.currency]}
              </p>
            </div>
          </div>
        </div>

        {!fund.isArchived && (
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/transactions/new?fundId=${encodeURIComponent(fund.id)}`}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              <span>Nuevo movimiento</span>
            </Link>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEditOpen(true)}
              className="gap-1.5"
            >
              <Pencil className="h-4 w-4" />
              <span>Editar</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsArchiveOpen(true)}
              className="gap-1.5 text-destructive hover:text-destructive"
            >
              <Archive className="h-4 w-4" />
              <span>Archivar</span>
            </Button>
          </div>
        )}
      </div>

      {/* Métricas derivadas del fondo */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Saldo derivado actual</CardDescription>
            <CardTitle
              className={`text-2xl ${negativeBalance ? 'text-destructive' : 'text-foreground'}`}
            >
              {formatCurrency(fund.balance, fund.currency)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Calculado desde el ledger contable</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Asientos registrados</CardDescription>
            <CardTitle className="text-2xl">{fund.entryCount}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Entradas históricas en este fondo</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Política de sobregiro</CardDescription>
            <CardTitle className="text-lg">
              {fund.allowNegativeBalance ? 'Permitido' : 'No permitido'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={fund.allowNegativeBalance ? 'warning' : 'secondary'}>
              {fund.allowNegativeBalance ? 'Permite saldo negativo' : 'Saldo mínimo 0.00'}
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Últimos 10 movimientos del fondo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Últimos 10 movimientos</CardTitle>
          <CardDescription>
            Impacto neto sobre {fund.name} en {fund.currency}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-secondary/20 p-8 text-center text-sm text-muted-foreground">
              Este fondo aún no tiene movimientos registrados.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {transactions.map((tx) => {
                const signedImpact = computeFundImpact(tx, fund.id);
                const isPositive = isPositiveMoneyString(signedImpact);
                const isNegative = isNegativeMoney(signedImpact);
                const formattedImpact = formatCurrency(signedImpact, fund.currency);
                const displayImpact = isPositive ? `+${formattedImpact}` : formattedImpact;

                return (
                  <li
                    key={tx.id}
                    className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/transactions/${tx.id}`}
                          className="truncate text-sm font-medium text-foreground hover:underline"
                        >
                          {tx.description}
                        </Link>
                        <Badge variant="outline">{TRANSACTION_TYPE_LABELS[tx.type]}</Badge>
                        {tx.status === 'VOIDED' && <Badge variant="secondary">Anulado</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Fecha: {formatDate(tx.occurredOn)}
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                      <span
                        className={`text-sm font-semibold tabular-nums ${
                          isPositive
                            ? 'text-income'
                            : isNegative
                              ? 'text-destructive'
                              : 'text-foreground'
                        }`}
                      >
                        {displayImpact}
                      </span>
                      <Link
                        href={`/transactions/${tx.id}`}
                        aria-label={`Ver movimiento ${tx.description}`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                      >
                        <span>Ver</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <FundFormModal
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        fund={fund}
        onSuccess={() => {
          void loadDetail();
        }}
      />

      <ArchiveFundDialog
        open={isArchiveOpen}
        onOpenChange={setIsArchiveOpen}
        fund={fund}
        onSuccess={() => {
          setIsArchiveOpen(false);
          void loadDetail();
        }}
      />
    </section>
  );
}

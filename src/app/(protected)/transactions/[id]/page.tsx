'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Ban,
  Calendar,
  Clock,
  Link2,
  RotateCcw,
  Split,
  Wallet,
} from 'lucide-react';
import { RefundTransactionDialog } from '@/components/ledger/refund-transaction-dialog';
import {
  TransactionStatusBadge,
  TransactionTypeBadge,
} from '@/components/ledger/transaction-badges';
import { VoidTransactionDialog } from '@/components/ledger/void-transaction-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getApiErrorMessage } from '@/lib/api-error-messages';
import { categoriesApi } from '@/lib/categories-api';
import { formatDate, formatDateTime } from '@/lib/formatters';
import { fundsApi } from '@/lib/funds-api';
import { isValidUuid } from '@/lib/funds-schemas';
import { ledgerApi } from '@/lib/ledger-api';
import { canRefundTransaction, canVoidTransaction } from '@/lib/ledger-schemas';
import { formatCurrency, isNegativeMoney, isPositiveMoneyString } from '@/lib/money';
import type { CategoryView } from '@/types/categories';
import type { FundView } from '@/types/funds';
import type { TransactionDetailView } from '@/types/ledger';

export default function TransactionDetailPage(): React.JSX.Element {
  const params = useParams();
  const rawId = params?.id;
  const transactionId =
    typeof rawId === 'string' ? rawId : Array.isArray(rawId) ? rawId[0] ?? '' : '';
  const isUuidValid = isValidUuid(transactionId);

  const [transaction, setTransaction] = React.useState<TransactionDetailView | null>(null);
  const [funds, setFunds] = React.useState<FundView[]>([]);
  const [categories, setCategories] = React.useState<CategoryView[]>([]);
  const [hasCatalogsLoaded, setHasCatalogsLoaded] = React.useState(false);

  const [isLoading, setIsLoading] = React.useState(true);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const [isVoidOpen, setIsVoidOpen] = React.useState(false);
  const [isRefundOpen, setIsRefundOpen] = React.useState(false);

  const detailRequestIdRef = React.useRef(0);

  const fundsById = React.useMemo(() => {
    const map = new Map<string, FundView>();
    for (const fund of funds) {
      map.set(fund.id.toLowerCase(), fund);
    }
    return map;
  }, [funds]);

  const categoriesById = React.useMemo(() => {
    const map = new Map<string, CategoryView>();
    for (const category of categories) {
      map.set(category.id.toLowerCase(), category);
    }
    return map;
  }, [categories]);

  const loadDetail = React.useCallback(
    async (options?: { silent?: boolean }) => {
      if (!isUuidValid) {
        setIsLoading(false);
        setTransaction(null);
        setErrorMessage('El identificador del movimiento no es válido.');
        return;
      }

      const requestId = ++detailRequestIdRef.current;
      if (!options?.silent) {
        setIsLoading(true);
      }
      setErrorMessage(null);

      try {
        const [txResult, fundsResult, categoriesResult] = await Promise.allSettled([
          ledgerApi.getById(transactionId),
          fundsApi.list({ includeArchived: true }),
          categoriesApi.list({ includeArchived: true }),
        ]);

        if (requestId !== detailRequestIdRef.current) {
          return;
        }

        if (txResult.status === 'rejected') {
          setTransaction(null);
          setErrorMessage(
            getApiErrorMessage(txResult.reason, 'No se pudo cargar el detalle del movimiento.'),
          );
          return;
        }

        setTransaction(txResult.value.transaction);

        if (fundsResult.status === 'fulfilled') {
          setFunds(fundsResult.value.funds);
        }
        if (categoriesResult.status === 'fulfilled') {
          setCategories(categoriesResult.value.categories);
        }
        setHasCatalogsLoaded(true);
      } finally {
        if (requestId === detailRequestIdRef.current && !options?.silent) {
          setIsLoading(false);
        }
      }
    },
    [transactionId, isUuidValid],
  );

  React.useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const resolveFundName = (fundId: string): { name: string; isArchived: boolean } => {
    const found = fundsById.get(fundId.toLowerCase());
    if (found) {
      return { name: found.name, isArchived: found.isArchived };
    }
    return {
      name: hasCatalogsLoaded ? 'Fondo no disponible' : 'Cargando fondo...',
      isArchived: false,
    };
  };

  const resolveCategoryName = (categoryId: string): { name: string; isArchived: boolean } => {
    const found = categoriesById.get(categoryId.toLowerCase());
    if (found) {
      return { name: found.name, isArchived: found.isArchived };
    }
    return {
      name: hasCatalogsLoaded ? 'Categoría no disponible' : 'Cargando categoría...',
      isArchived: false,
    };
  };

  if (isLoading) {
    return (
      <section className="space-y-6" aria-busy="true" data-testid="transaction-detail-loading">
        <div className="h-8 w-44 animate-pulse rounded-md bg-secondary" />
        <div className="h-44 animate-pulse rounded-xl border border-border bg-card/60" />
        <div className="h-56 animate-pulse rounded-xl border border-border bg-card/60" />
      </section>
    );
  }

  if (errorMessage || !transaction) {
    return (
      <section className="space-y-6">
        <Link
          href="/transactions"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Volver a movimientos</span>
        </Link>

        <Alert variant="destructive" data-testid="transaction-detail-error">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Movimiento no disponible</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>{errorMessage ?? 'El movimiento solicitado no fue encontrado.'}</p>
            <Link
              href="/transactions"
              className="inline-flex items-center gap-1.5 text-sm font-medium underline underline-offset-4"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Ir al historial de movimientos</span>
            </Link>
          </AlertDescription>
        </Alert>
      </section>
    );
  }

  const showVoidButton = canVoidTransaction(transaction);
  const showRefundButton = canRefundTransaction(transaction);
  const primaryFundName = transaction.entries[0]
    ? resolveFundName(transaction.entries[0].fundId).name
    : undefined;
  const singleCategoryInfo =
    transaction.categoryId && transaction.splits.length === 0
      ? resolveCategoryName(transaction.categoryId)
      : null;

  return (
    <section className="space-y-6">
      {/* Cabecera y acciones */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Link
            href="/transactions"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Volver a movimientos</span>
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {transaction.description}
            </h1>
            <TransactionTypeBadge type={transaction.type} />
            <TransactionStatusBadge status={transaction.status} />
            <Badge variant="outline">{transaction.currency}</Badge>
          </div>

          <p className="text-2xl font-bold tabular-nums text-foreground">
            {formatCurrency(transaction.amount, transaction.currency)}
          </p>
        </div>

        {(showVoidButton || showRefundButton) && (
          <div className="flex flex-wrap items-center gap-2">
            {showRefundButton && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsRefundOpen(true)}
                className="gap-1.5"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Registrar reembolso</span>
              </Button>
            )}
            {showVoidButton && (
              <Button
                type="button"
                variant="destructive"
                onClick={() => setIsVoidOpen(true)}
                className="gap-1.5"
              >
                <Ban className="h-4 w-4" />
                <span>Anular movimiento</span>
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Metadatos y dualidad temporal */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Detalle contable</CardTitle>
          <CardDescription>
            Información temporal, categoría y trazabilidad del registro en el ledger.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              <span>Fecha del movimiento</span>
            </p>
            <p
              data-testid="tx-occurred-on"
              className="text-sm font-semibold text-foreground"
            >
              {formatDate(transaction.occurredOn)}
            </p>
          </div>

          <div className="space-y-1">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span>Registrado el (America/Lima)</span>
            </p>
            <p
              data-testid="tx-recorded-at"
              className="text-sm font-semibold text-foreground"
            >
              {formatDateTime(transaction.recordedAt)}
            </p>
          </div>

          {singleCategoryInfo && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Categoría</p>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-sm font-semibold text-foreground">
                  {singleCategoryInfo.name}
                </span>
                {singleCategoryInfo.isArchived && (
                  <Badge variant="secondary">Archivada</Badge>
                )}
              </div>
            </div>
          )}

          {transaction.notes && (
            <div className="space-y-1 sm:col-span-2 lg:col-span-3">
              <p className="text-xs font-medium text-muted-foreground">Notas</p>
              <p className="text-sm text-foreground">{transaction.notes}</p>
            </div>
          )}

          {transaction.relatedTransactionId && (
            <div className="space-y-1 sm:col-span-2 lg:col-span-3">
              <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Link2 className="h-3.5 w-3.5" />
                <span>Trazabilidad contable</span>
              </p>
              <Link
                href={`/transactions/${transaction.relatedTransactionId}`}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary underline underline-offset-4"
              >
                <span>Ver movimiento original</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bloque origen -> destino para TRANSFER */}
      {transaction.type === 'TRANSFER' && transaction.entries.length === 2 && (
        <Card data-testid="transfer-entries-summary">
          <CardHeader>
            <CardTitle className="text-lg">Flujo de transferencia</CardTitle>
            <CardDescription>
              Movimiento de efecto neto cero entre fondos de la misma moneda.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {(() => {
              const sourceEntry = transaction.entries[0];
              const destEntry = transaction.entries[1];
              const sourceFund = resolveFundName(sourceEntry.fundId);
              const destFund = resolveFundName(destEntry.fundId);
              return (
                <>
                  <div className="rounded-lg border border-border bg-secondary/20 p-4">
                    <p className="text-xs font-medium text-muted-foreground">Fondo origen</p>
                    <Link
                      href={`/funds/${sourceEntry.fundId}`}
                      className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-foreground hover:underline"
                    >
                      <Wallet className="h-4 w-4 text-muted-foreground" />
                      <span>{sourceFund.name}</span>
                    </Link>
                    <p className="mt-2 text-base font-bold tabular-nums text-destructive">
                      {formatCurrency(sourceEntry.signedAmount, sourceEntry.currency)}
                    </p>
                  </div>

                  <div className="rounded-lg border border-border bg-secondary/20 p-4">
                    <p className="text-xs font-medium text-muted-foreground">Fondo destino</p>
                    <Link
                      href={`/funds/${destEntry.fundId}`}
                      className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-foreground hover:underline"
                    >
                      <Wallet className="h-4 w-4 text-muted-foreground" />
                      <span>{destFund.name}</span>
                    </Link>
                    <p className="mt-2 text-base font-bold tabular-nums text-income">
                      +{formatCurrency(destEntry.signedAmount, destEntry.currency)}
                    </p>
                  </div>
                </>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {/* Asientos contables (entries) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Asientos contables</CardTitle>
          <CardDescription>
            Impacto exacto registrado en el libro mayor por cada fondo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {transaction.entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay asientos registrados.</p>
          ) : (
            <ul className="divide-y divide-border" data-testid="transaction-entries-list">
              {transaction.entries.map((entry) => {
                const fundInfo = resolveFundName(entry.fundId);
                const isPos = isPositiveMoneyString(entry.signedAmount);
                const isNeg = isNegativeMoney(entry.signedAmount);
                const formattedSigned = formatCurrency(entry.signedAmount, entry.currency);
                const displaySigned = isPos ? `+${formattedSigned}` : formattedSigned;

                return (
                  <li
                    key={entry.id}
                    className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/funds/${entry.fundId}`}
                          className="text-sm font-semibold text-foreground hover:underline"
                        >
                          {fundInfo.name}
                        </Link>
                        {fundInfo.isArchived && <Badge variant="secondary">Archivado</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Fecha contable: {formatDate(entry.occurredOn)}
                      </p>
                    </div>

                    <span
                      className={`text-sm font-semibold tabular-nums ${
                        isPos
                          ? 'text-income'
                          : isNeg
                            ? 'text-destructive'
                            : 'text-foreground'
                      }`}
                    >
                      {displaySigned}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Desglose por categorías (splits) */}
      {transaction.splits.length > 0 && (
        <Card data-testid="transaction-splits-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Split className="h-4 w-4 text-accent" />
              <span>Desglose por categorías ({transaction.splits.length})</span>
            </CardTitle>
            <CardDescription>
              Distribución exacta del movimiento entre múltiples categorías.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border" data-testid="transaction-splits-list">
              {transaction.splits.map((split) => {
                const categoryInfo = resolveCategoryName(split.categoryId);
                return (
                  <li
                    key={split.id}
                    className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-foreground">
                          {categoryInfo.name}
                        </span>
                        {categoryInfo.isArchived && (
                          <Badge variant="secondary">Archivada</Badge>
                        )}
                      </div>
                      {split.note && (
                        <p className="text-xs text-muted-foreground">{split.note}</p>
                      )}
                    </div>

                    <span className="text-sm font-semibold tabular-nums text-foreground">
                      {formatCurrency(split.amount, transaction.currency)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      <VoidTransactionDialog
        open={isVoidOpen}
        onOpenChange={setIsVoidOpen}
        transaction={transaction}
        fundsById={fundsById}
        onSuccess={() => loadDetail({ silent: true })}
      />

      <RefundTransactionDialog
        open={isRefundOpen}
        onOpenChange={setIsRefundOpen}
        transaction={transaction}
        fundName={primaryFundName}
        onSuccess={() => loadDetail({ silent: true })}
      />
    </section>
  );
}

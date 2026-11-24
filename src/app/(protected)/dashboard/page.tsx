'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Landmark,
  PlusCircle,
  RotateCcw,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { CategoryBreakdownChart } from '@/components/dashboard/category-breakdown-chart';
import { FundIcon } from '@/components/funds/fund-icon';
import {
  TransactionStatusBadge,
  TransactionTypeBadge,
} from '@/components/ledger/transaction-badges';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getApiErrorMessage } from '@/lib/api-error-messages';
import {
  formatMonthLabelEs,
  getAvailableCurrencies,
  isValidMonthString,
  resolveCurrencySummary,
  resolveEffectiveCurrency,
  resolvePatrimonyKpi,
} from '@/lib/dashboard-utils';
import { formatDate, getCurrentLimaMonthString, shiftMonth } from '@/lib/formatters';
import { fundsApi } from '@/lib/funds-api';
import { ledgerApi } from '@/lib/ledger-api';
import { formatCurrency, isNegativeMoney, isZeroMoney, sumMoney } from '@/lib/money';
import { cn } from '@/lib/utils';
import type { CurrencyBalanceSummary, FundCurrencyCode, FundView } from '@/types/funds';
import type { MonthlySummaryResponse, TransactionDetailView } from '@/types/ledger';

const SELECT_CLASS =
  'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-auto';

const CURRENCY_LABELS: Record<FundCurrencyCode, string> = {
  PEN: 'Soles (PEN)',
  USD: 'Dólares (USD)',
};

function formatDashboardTransactionAmount(
  tx: TransactionDetailView,
  selectedFundId: string,
): { text: string; colorClass: string } {
  const formatted = formatCurrency(tx.amount, tx.currency);
  const isVoided = tx.status === 'VOIDED';

  if (tx.type === 'INCOME' || tx.type === 'REFUND') {
    return {
      text: `+${formatted}`,
      colorClass: isVoided ? 'text-muted-foreground line-through' : 'text-income',
    };
  }

  if (tx.type === 'EXPENSE') {
    return {
      text: `-${formatted}`,
      colorClass: isVoided ? 'text-muted-foreground line-through' : 'text-destructive',
    };
  }

  if (tx.type === 'ADJUSTMENT') {
    const firstSigned = tx.entries[0]?.signedAmount;
    const isNeg = firstSigned ? isNegativeMoney(firstSigned) : false;
    return {
      text: isNeg ? `-${formatted}` : `+${formatted}`,
      colorClass: isVoided
        ? 'text-muted-foreground line-through'
        : isNeg
          ? 'text-destructive'
          : 'text-income',
    };
  }

  if (tx.type === 'TRANSFER' && selectedFundId) {
    const normalizedFundId = selectedFundId.toLowerCase();
    const fundEntries = tx.entries.filter(
      (entry) => entry.fundId.toLowerCase() === normalizedFundId,
    );
    if (fundEntries.length > 0) {
      const netAmount = sumMoney(fundEntries.map((entry) => entry.signedAmount));
      const formattedNet = formatCurrency(netAmount, tx.currency);
      if (isZeroMoney(netAmount)) {
        return {
          text: formattedNet,
          colorClass: isVoided ? 'text-muted-foreground line-through' : 'text-foreground',
        };
      }
      const isNeg = isNegativeMoney(netAmount);
      return {
        text: isNeg ? formattedNet : `+${formattedNet}`,
        colorClass: isVoided
          ? 'text-muted-foreground line-through'
          : isNeg
            ? 'text-destructive'
            : 'text-income',
      };
    }
  }

  return {
    text: formatted,
    colorClass: isVoided ? 'text-muted-foreground line-through' : 'text-foreground',
  };
}

function DashboardSkeleton(): React.JSX.Element {
  return (
    <div className="space-y-6" aria-label="Cargando panel financiero">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((idx) => (
          <div
            key={idx}
            className="h-32 animate-pulse rounded-xl border border-border bg-card p-6"
          >
            <div className="h-4 w-24 rounded bg-secondary" />
            <div className="mt-4 h-7 w-36 rounded bg-secondary" />
            <div className="mt-3 h-3 w-28 rounded bg-secondary" />
          </div>
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-xl border border-border bg-card" />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-64 animate-pulse rounded-xl border border-border bg-card" />
        <div className="h-64 animate-pulse rounded-xl border border-border bg-card" />
      </div>
    </div>
  );
}

export default function DashboardPage(): React.JSX.Element {
  const currentLimaMonth = React.useMemo(() => getCurrentLimaMonthString(), []);

  const [month, setMonth] = React.useState<string>(currentLimaMonth);
  const [selectedFundId, setSelectedFundId] = React.useState<string>('');
  const [selectedCurrency, setSelectedCurrency] = React.useState<FundCurrencyCode | null>(null);

  const [funds, setFunds] = React.useState<FundView[]>([]);
  const [totalsByCurrency, setTotalsByCurrency] = React.useState<CurrencyBalanceSummary[]>([]);
  const [summary, setSummary] = React.useState<MonthlySummaryResponse | null>(null);
  const [recentTransactions, setRecentTransactions] = React.useState<TransactionDetailView[]>([]);

  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = React.useState<number>(0);

  const requestIdRef = React.useRef<number>(0);

  React.useEffect(() => {
    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    setErrorMessage(null);

    const fundFilter = selectedFundId || undefined;

    Promise.all([
      fundsApi.list({ includeArchived: false }),
      ledgerApi.getMonthlySummary({ month, fundId: fundFilter }),
      ledgerApi.list({ limit: 5, fundId: fundFilter }),
    ])
      .then(([fundsRes, summaryRes, listRes]) => {
        if (requestId !== requestIdRef.current) {
          return;
        }
        setFunds(fundsRes.funds);
        setTotalsByCurrency(fundsRes.totalsByCurrency);
        setSummary(summaryRes);
        setRecentTransactions(listRes.items);
      })
      .catch((error: unknown) => {
        if (requestId !== requestIdRef.current) {
          return;
        }
        setErrorMessage(getApiErrorMessage(error, 'No se pudo cargar el resumen financiero.'));
      })
      .finally(() => {
        if (requestId !== requestIdRef.current) {
          return;
        }
        setIsLoading(false);
      });
  }, [month, selectedFundId, reloadNonce]);

  const selectedFund = React.useMemo(() => {
    if (!selectedFundId) {
      return null;
    }
    return funds.find((fund) => fund.id === selectedFundId) ?? null;
  }, [funds, selectedFundId]);

  const availableCurrencies = React.useMemo(
    () => getAvailableCurrencies(totalsByCurrency, summary?.currencies ?? [], selectedFund),
    [totalsByCurrency, summary, selectedFund],
  );

  const effectiveCurrency = resolveEffectiveCurrency(
    availableCurrencies,
    selectedCurrency,
    selectedFund,
  );

  const currencySummary = React.useMemo(
    () => resolveCurrencySummary(summary, effectiveCurrency),
    [summary, effectiveCurrency],
  );

  const patrimony = React.useMemo(
    () => resolvePatrimonyKpi(totalsByCurrency, effectiveCurrency, selectedFund),
    [totalsByCurrency, effectiveCurrency, selectedFund],
  );

  const monthLabel = formatMonthLabelEs(month);
  const isCurrentMonth = month === currentLimaMonth;
  const hasAnyFunds = funds.length > 0;
  const hasMonthlyMovements = (summary?.currencies.length ?? 0) > 0;
  const hasRefunds = !isZeroMoney(currencySummary.totalRefunds);

  const netFlowPositive =
    !isNegativeMoney(currencySummary.netCashFlow) && !isZeroMoney(currencySummary.netCashFlow);
  const netFlowNegative = isNegativeMoney(currencySummary.netCashFlow);

  const handleMonthInputChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const nextValue = event.target.value;
    if (isValidMonthString(nextValue)) {
      setMonth(nextValue);
    }
  };

  return (
    <section className="space-y-6">
      {/* Cabecera y accesos rápidos */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Panel Principal</h1>
            {selectedFund ? (
              <Badge variant="outline" className="gap-1">
                Filtrado por: {selectedFund.name} ({selectedFund.currency})
              </Badge>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            Resumen financiero de {monthLabel} (zona horaria America/Lima).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/transactions/new"
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
          >
            <PlusCircle className="h-4 w-4" aria-hidden="true" />
            Registrar movimiento
          </Link>
          <Link
            href="/transactions/new?type=TRANSFER"
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
            Transferir
          </Link>
        </div>
      </div>

      {/* Controles superiores: Mes, Filtro de fondo y Moneda */}
      <Card>
        <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label="Mes anterior"
              onClick={() => setMonth((prev) => shiftMonth(prev, -1))}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only sm:not-sr-only sm:ml-1">Mes anterior</span>
            </Button>

            <div className="flex items-center gap-2 rounded-md border border-border bg-secondary/30 px-3 py-1.5 text-sm font-semibold text-foreground">
              <Calendar className="h-4 w-4 text-primary" aria-hidden="true" />
              <span>{monthLabel}</span>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label="Mes siguiente"
              onClick={() => setMonth((prev) => shiftMonth(prev, 1))}
            >
              <span className="sr-only sm:not-sr-only sm:mr-1">Mes siguiente</span>
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Button>

            <input
              type="month"
              aria-label="Seleccionar mes"
              value={month}
              onChange={handleMonthInputChange}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />

            {!isCurrentMonth ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setMonth(currentLimaMonth)}
              >
                Mes actual
              </Button>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label htmlFor="dashboard-fund-filter" className="text-xs font-medium text-muted-foreground">
                Fondo:
              </label>
              <select
                id="dashboard-fund-filter"
                aria-label="Filtrar por fondo"
                value={selectedFundId}
                onChange={(e) => setSelectedFundId(e.target.value)}
                className={SELECT_CLASS}
              >
                <option value="">Todos los fondos</option>
                {funds.map((fund) => (
                  <option key={fund.id} value={fund.id}>
                    {fund.name} ({fund.currency})
                  </option>
                ))}
              </select>
            </div>

            {availableCurrencies.length > 1 && !selectedFund ? (
              <div
                role="tablist"
                aria-label="Moneda del resumen"
                className="inline-flex rounded-lg border border-border bg-secondary/40 p-1"
              >
                {availableCurrencies.map((code) => (
                  <button
                    key={code}
                    type="button"
                    role="tab"
                    aria-selected={effectiveCurrency === code}
                    onClick={() => setSelectedCurrency(code)}
                    className={cn(
                      'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                      effectiveCurrency === code
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {CURRENCY_LABELS[code]}
                  </button>
                ))}
              </div>
            ) : (
              <Badge variant="outline" aria-label="Moneda activa">
                {CURRENCY_LABELS[effectiveCurrency]}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {errorMessage ? (
        <Alert variant="destructive" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <AlertDescription>{errorMessage}</AlertDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setReloadNonce((prev) => prev + 1)}
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            Reintentar
          </Button>
        </Alert>
      ) : null}

      {isLoading && !summary ? (
        <DashboardSkeleton />
      ) : (
        <>
          {!hasAnyFunds && !isLoading ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center gap-3 p-6 text-center sm:flex-row sm:justify-between sm:text-left">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">
                    Aún no tienes fondos activos registrados
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Crea tu primer fondo (efectivo, banco o billetera) para empezar a registrar movimientos.
                  </p>
                </div>
                <Link
                  href="/funds"
                  className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
                >
                  Ir a Fondos
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </CardContent>
            </Card>
          ) : null}

          {/* 4 Tarjetas KPI */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Indicadores principales">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardDescription className="text-xs font-medium uppercase tracking-wide">
                  Patrimonio total
                </CardDescription>
                <Landmark className="h-4 w-4 text-primary" aria-hidden="true" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold tabular-nums text-foreground">
                  {formatCurrency(patrimony.totalBalance, effectiveCurrency)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {patrimony.isFilteredByFund
                    ? `Saldo de ${patrimony.fundName}`
                    : `${patrimony.fundCount} ${patrimony.fundCount === 1 ? 'fondo activo' : 'fondos activos'} en ${effectiveCurrency}`}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardDescription className="text-xs font-medium uppercase tracking-wide">
                  Ingresos del mes
                </CardDescription>
                <ArrowDownLeft className="h-4 w-4 text-income" aria-hidden="true" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold tabular-nums text-income">
                  {formatCurrency(currencySummary.totalIncome, effectiveCurrency)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Entradas confirmadas en {monthLabel}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardDescription className="text-xs font-medium uppercase tracking-wide">
                  Gastos netos del mes
                </CardDescription>
                <ArrowUpRight className="h-4 w-4 text-destructive" aria-hidden="true" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold tabular-nums text-destructive">
                  {formatCurrency(currencySummary.totalExpenseNet, effectiveCurrency)}
                </p>
                {hasRefunds ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Bruto: {formatCurrency(currencySummary.totalExpenseGross, effectiveCurrency)} ·
                    Reembolsos: {formatCurrency(currencySummary.totalRefunds, effectiveCurrency)}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Sin reembolsos registrados este mes
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardDescription className="text-xs font-medium uppercase tracking-wide">
                  Flujo neto mensual
                </CardDescription>
                <TrendingUp className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              </CardHeader>
              <CardContent>
                <p
                  className={cn(
                    'text-2xl font-bold tabular-nums',
                    netFlowPositive
                      ? 'text-income'
                      : netFlowNegative
                        ? 'text-destructive'
                        : 'text-foreground',
                  )}
                >
                  {formatCurrency(currencySummary.netCashFlow, effectiveCurrency)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {currencySummary.transactionCount}{' '}
                  {currencySummary.transactionCount === 1
                    ? 'movimiento en el mes'
                    : 'movimientos en el mes'}
                </p>
              </CardContent>
            </Card>
          </div>

          {!hasMonthlyMovements && !isLoading ? (
            <div className="rounded-lg border border-dashed border-border bg-secondary/20 px-4 py-4 text-center text-sm text-muted-foreground">
              Sin movimientos registrados en {monthLabel}. Puedes registrar un ingreso, gasto o
              navegar a otro mes.
            </div>
          ) : null}

          {/* Desglose por categoría */}
          <CategoryBreakdownChart
            currencySummary={currencySummary}
            activeCurrency={effectiveCurrency}
          />

          {/* Bloques inferiores: Fondos principales + Últimos 5 movimientos */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Fondos principales */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Wallet className="h-5 w-5 text-primary" aria-hidden="true" />
                    Fondos principales
                  </CardTitle>
                  <CardDescription>Tus cuentas activas con saldo derivado.</CardDescription>
                </div>
                <Link
                  href="/funds"
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  Ver todos
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </CardHeader>
              <CardContent>
                {funds.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border bg-secondary/20 p-6 text-center text-sm text-muted-foreground">
                    No hay fondos activos.{' '}
                    <Link href="/funds" className="font-medium text-primary hover:underline">
                      Crear primer fondo
                    </Link>
                  </div>
                ) : (
                  <ul className="divide-y divide-border">
                    {funds.slice(0, 5).map((fund) => {
                      const isOverdrawn = isNegativeMoney(fund.balance);
                      return (
                        <li
                          key={fund.id}
                          className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary/60 text-foreground">
                              <FundIcon icon={fund.icon} type={fund.type} className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <Link
                                href={`/funds/${fund.id}`}
                                className="block truncate text-sm font-medium text-foreground hover:text-primary hover:underline"
                              >
                                {fund.name}
                              </Link>
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <span>{fund.currency}</span>
                                {isOverdrawn ? (
                                  <Badge variant="destructive" className="px-1.5 py-0 text-[10px]">
                                    Sobregiro
                                  </Badge>
                                ) : null}
                              </div>
                            </div>
                          </div>

                          <p
                            className={cn(
                              'shrink-0 text-sm font-semibold tabular-nums',
                              isOverdrawn ? 'text-destructive' : 'text-foreground',
                            )}
                          >
                            {formatCurrency(fund.balance, fund.currency)}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>

            {/* Últimos 5 movimientos */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <div className="space-y-1">
                  <CardTitle className="text-lg">Últimos 5 movimientos</CardTitle>
                  <CardDescription>
                    {selectedFund
                      ? `Movimientos recientes de ${selectedFund.name}.`
                      : 'Actividad reciente del libro mayor.'}
                  </CardDescription>
                </div>
                <Link
                  href="/transactions"
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  Ver historial completo
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </CardHeader>
              <CardContent>
                {recentTransactions.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border bg-secondary/20 p-6 text-center text-sm text-muted-foreground">
                    No hay movimientos registrados todavía.{' '}
                    <Link
                      href="/transactions/new"
                      className="font-medium text-primary hover:underline"
                    >
                      Registrar movimiento
                    </Link>
                  </div>
                ) : (
                  <ul className="divide-y divide-border">
                    {recentTransactions.slice(0, 5).map((tx) => {
                      const amountDisplay = formatDashboardTransactionAmount(tx, selectedFundId);
                      return (
                        <li
                          key={tx.id}
                          className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                        >
                          <div className="min-w-0 space-y-1">
                            <Link
                              href={`/transactions/${tx.id}`}
                              className="block truncate text-sm font-medium text-foreground hover:text-primary hover:underline"
                            >
                              {tx.description}
                            </Link>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <TransactionTypeBadge type={tx.type} />
                              <TransactionStatusBadge status={tx.status} />
                              <span className="text-xs text-muted-foreground">
                                {formatDate(tx.occurredOn)}
                              </span>
                            </div>
                          </div>

                          <p
                            className={cn(
                              'shrink-0 text-sm font-semibold tabular-nums',
                              amountDisplay.colorClass,
                            )}
                          >
                            {amountDisplay.text}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </section>
  );
}

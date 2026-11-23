'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  Archive,
  ArrowRight,
  Pencil,
  Plus,
  RefreshCw,
  Wallet,
} from 'lucide-react';
import { ArchiveFundDialog } from '@/components/funds/archive-fund-dialog';
import { FundFormModal } from '@/components/funds/fund-form-modal';
import { FundIcon } from '@/components/funds/fund-icon';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { getApiErrorMessage } from '@/lib/api-error-messages';
import { fundsApi } from '@/lib/funds-api';
import {
  FUND_CURRENCIES,
  FUND_CURRENCY_LABELS,
  FUND_TYPE_LABELS,
  FUND_TYPES,
} from '@/lib/funds-schemas';
import { formatCurrency, isNegativeMoney } from '@/lib/money';
import type {
  CurrencyBalanceSummary,
  FundCurrencyCode,
  FundTypeValue,
  FundView,
} from '@/types/funds';

const CURRENCY_SORT_ORDER: Record<FundCurrencyCode, number> = {
  PEN: 0,
  USD: 1,
};

const FILTER_SELECT_CLASS =
  'flex h-9 rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

function sortTotalsByCurrency(
  totals: readonly CurrencyBalanceSummary[],
): CurrencyBalanceSummary[] {
  return [...totals].sort(
    (a, b) => CURRENCY_SORT_ORDER[a.currency] - CURRENCY_SORT_ORDER[b.currency],
  );
}

export default function FundsPage(): React.JSX.Element {
  const [currencyFilter, setCurrencyFilter] = React.useState<FundCurrencyCode | 'ALL'>('ALL');
  const [typeFilter, setTypeFilter] = React.useState<FundTypeValue | 'ALL'>('ALL');
  const [includeArchived, setIncludeArchived] = React.useState(false);

  const [funds, setFunds] = React.useState<FundView[]>([]);
  const [totalsByCurrency, setTotalsByCurrency] = React.useState<CurrencyBalanceSummary[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [editingFund, setEditingFund] = React.useState<FundView | null>(null);
  const [archivingFund, setArchivingFund] = React.useState<FundView | null>(null);

  const requestCounterRef = React.useRef(0);

  const loadFunds = React.useCallback(async () => {
    const requestId = ++requestCounterRef.current;
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fundsApi.list({
        includeArchived,
        currency: currencyFilter === 'ALL' ? undefined : currencyFilter,
        type: typeFilter === 'ALL' ? undefined : typeFilter,
      });

      if (requestId !== requestCounterRef.current) {
        return;
      }

      setFunds(response.funds);
      setTotalsByCurrency(sortTotalsByCurrency(response.totalsByCurrency));
    } catch (error) {
      if (requestId !== requestCounterRef.current) {
        return;
      }
      setErrorMessage(getApiErrorMessage(error, 'No se pudieron cargar los fondos.'));
    } finally {
      if (requestId === requestCounterRef.current) {
        setIsLoading(false);
      }
    }
  }, [currencyFilter, typeFilter, includeArchived]);

  React.useEffect(() => {
    void loadFunds();
  }, [loadFunds]);

  const handleOpenCreate = (): void => {
    setEditingFund(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (fund: FundView): void => {
    setEditingFund(fund);
    setIsFormOpen(true);
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Fondos</h1>
          <p className="text-sm text-muted-foreground">
            Gestión de cuentas, billeteras y saldos derivados por moneda.
          </p>
        </div>

        <Button type="button" onClick={handleOpenCreate} className="gap-2 self-start sm:self-auto">
          <Plus className="h-4 w-4" />
          <span>Nuevo fondo</span>
        </Button>
      </div>

      {/* Patrimonio separado estrictamente por moneda (PEN primero, USD segundo) */}
      {totalsByCurrency.length > 0 && (
        <div
          aria-label="Resumen de patrimonio por moneda"
          className="grid gap-4 sm:grid-cols-2"
        >
          {totalsByCurrency.map((summary) => (
            <Card key={summary.currency}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardDescription>{FUND_CURRENCY_LABELS[summary.currency]}</CardDescription>
                  <Badge variant="outline">{summary.currency}</Badge>
                </div>
                <CardTitle
                  className={`text-2xl ${
                    isNegativeMoney(summary.totalBalance) ? 'text-destructive' : 'text-foreground'
                  }`}
                >
                  {formatCurrency(summary.totalBalance, summary.currency)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  {summary.fundCount === 1 ? '1 fondo activo' : `${summary.fundCount} fondos activos`}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Barra de filtros combinables */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="grid flex-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="filter-currency">Moneda</Label>
                <select
                  id="filter-currency"
                  value={currencyFilter}
                  onChange={(event) =>
                    setCurrencyFilter(event.target.value as FundCurrencyCode | 'ALL')
                  }
                  className={`${FILTER_SELECT_CLASS} w-full`}
                >
                  <option value="ALL">Todas las monedas</option>
                  {FUND_CURRENCIES.map((currency) => (
                    <option key={currency} value={currency}>
                      {FUND_CURRENCY_LABELS[currency]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="filter-type">Tipo</Label>
                <select
                  id="filter-type"
                  value={typeFilter}
                  onChange={(event) => setTypeFilter(event.target.value as FundTypeValue | 'ALL')}
                  className={`${FILTER_SELECT_CLASS} w-full`}
                >
                  <option value="ALL">Todos los tipos</option>
                  {FUND_TYPES.map((typeOption) => (
                    <option key={typeOption} value={typeOption}>
                      {FUND_TYPE_LABELS[typeOption]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2.5 pt-2 sm:pt-6">
                <input
                  id="filter-include-archived"
                  type="checkbox"
                  checked={includeArchived}
                  onChange={(event) => setIncludeArchived(event.target.checked)}
                  className="h-4 w-4 rounded border-input accent-primary"
                />
                <Label htmlFor="filter-include-archived" className="cursor-pointer">
                  Mostrar archivados
                </Label>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void loadFunds()}
              disabled={isLoading}
              className="gap-2 self-start md:self-auto"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Actualizar</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {errorMessage && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span>{errorMessage}</span>
            <Button type="button" variant="outline" size="sm" onClick={() => void loadFunds()}>
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" aria-busy="true">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-44 animate-pulse rounded-xl border border-border bg-card/60 p-6"
            />
          ))}
        </div>
      ) : funds.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card p-10 text-center">
          <Wallet className="h-8 w-8 text-accent" />
          <p className="text-sm font-medium text-foreground">No hay fondos que coincidan</p>
          <p className="text-xs text-muted-foreground">
            Crea tu primer fondo o ajusta los filtros seleccionados.
          </p>
          <Button type="button" size="sm" onClick={handleOpenCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            <span>Crear fondo</span>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {funds.map((fund) => {
            const negativeBalance = isNegativeMoney(fund.balance);

            return (
              <Card
                key={fund.id}
                className={fund.isArchived ? 'border-dashed opacity-80' : undefined}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary text-foreground"
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
                      <div className="min-w-0">
                        <Link
                          href={`/funds/${fund.id}`}
                          className="block truncate text-base font-semibold text-foreground hover:underline"
                        >
                          {fund.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {FUND_TYPE_LABELS[fund.type]}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Badge variant="outline">{fund.currency}</Badge>
                      {fund.isArchived && <Badge variant="secondary">Archivado</Badge>}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Saldo actual</p>
                    <p
                      className={`text-xl font-bold tracking-tight ${
                        negativeBalance ? 'text-destructive' : 'text-foreground'
                      }`}
                    >
                      {formatCurrency(fund.balance, fund.currency)}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={fund.allowNegativeBalance ? 'warning' : 'secondary'}>
                      {fund.allowNegativeBalance ? 'Permite sobregiro' : 'Sin sobregiro'}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                    <Link
                      href={`/funds/${fund.id}`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                    >
                      <span>Ver detalle</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>

                    {!fund.isArchived && (
                      <div className="flex items-center gap-1.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenEdit(fund)}
                          aria-label={`Editar ${fund.name}`}
                          className="h-8 gap-1 px-2.5 text-xs"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          <span>Editar</span>
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setArchivingFund(fund)}
                          aria-label={`Archivar ${fund.name}`}
                          className="h-8 gap-1 px-2.5 text-xs text-destructive hover:text-destructive"
                        >
                          <Archive className="h-3.5 w-3.5" />
                          <span>Archivar</span>
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <FundFormModal
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        fund={editingFund}
        onSuccess={() => {
          void loadFunds();
        }}
      />

      <ArchiveFundDialog
        open={Boolean(archivingFund)}
        onOpenChange={(open) => {
          if (!open) {
            setArchivingFund(null);
          }
        }}
        fund={archivingFund}
        onSuccess={() => {
          setArchivingFund(null);
          void loadFunds();
        }}
      />
    </section>
  );
}

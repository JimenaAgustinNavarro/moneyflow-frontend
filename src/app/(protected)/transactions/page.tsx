'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeftRight,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Loader2,
  PlusCircle,
  RotateCcw,
  Search,
  Split,
} from 'lucide-react';
import {
  TransactionStatusBadge,
  TransactionTypeBadge,
} from '@/components/ledger/transaction-badges';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getApiErrorMessage } from '@/lib/api-error-messages';
import { categoriesApi } from '@/lib/categories-api';
import { formatDate } from '@/lib/formatters';
import { fundsApi } from '@/lib/funds-api';
import { FUND_CURRENCIES } from '@/lib/funds-schemas';
import { ledgerApi } from '@/lib/ledger-api';
import {
  buildTransactionsUrlSearchParams,
  DEFAULT_TRANSACTIONS_LIMIT,
  DEFAULT_TRANSACTIONS_PAGE,
  parseTransactionsSearchParams,
  SEARCH_MAX_LENGTH,
  TRANSACTION_STATUS_LABELS,
  TRANSACTION_STATUSES,
  TRANSACTION_TYPE_LABELS,
  TRANSACTION_TYPES,
  validateTransactionDateRange,
  type TransactionFiltersState,
} from '@/lib/ledger-schemas';
import { formatCurrency, isNegativeMoney } from '@/lib/money';
import type { CategoryView } from '@/types/categories';
import type { FundCurrencyCode, FundView } from '@/types/funds';
import type {
  ListTransactionsResponse,
  TransactionDetailView,
  TransactionStatusValue,
  TransactionTypeValue,
} from '@/types/ledger';

const SELECT_CLASS =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

const LIMIT_OPTIONS = [10, 20, 50, 100] as const;
const SEARCH_DEBOUNCE_MS = 300;

function formatTransactionAmountDisplay(tx: TransactionDetailView): {
  text: string;
  colorClass: string;
} {
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

  return {
    text: formatted,
    colorClass: isVoided ? 'text-muted-foreground line-through' : 'text-foreground',
  };
}

function resolveFundSummary(
  tx: TransactionDetailView,
  fundsById: ReadonlyMap<string, FundView>,
  hasCatalog: boolean,
): string {
  if (tx.entries.length === 0) {
    return 'Sin fondos asociados';
  }

  const getFundLabel = (fundId: string): string => {
    const found = fundsById.get(fundId.toLowerCase());
    if (found) {
      return found.isArchived ? `${found.name} (Archivado)` : found.name;
    }
    return hasCatalog ? 'Fondo no disponible' : 'Cargando fondo...';
  };

  if (tx.type === 'TRANSFER' && tx.entries.length >= 2) {
    return `${getFundLabel(tx.entries[0].fundId)} → ${getFundLabel(tx.entries[1].fundId)}`;
  }

  const uniqueNames = Array.from(
    new Set(tx.entries.map((entry) => getFundLabel(entry.fundId))),
  );
  return uniqueNames.join(' · ');
}

function TransactionsPageContent(): React.JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const parsed = React.useMemo(
    () => parseTransactionsSearchParams(searchParams),
    [searchParams],
  );

  const [funds, setFunds] = React.useState<FundView[]>([]);
  const [categories, setCategories] = React.useState<CategoryView[]>([]);
  const [hasCatalogsLoaded, setHasCatalogsLoaded] = React.useState(false);

  const [listData, setListData] = React.useState<ListTransactionsResponse | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const [searchInput, setSearchInput] = React.useState(parsed.filters.search ?? '');
  const [fromDateInput, setFromDateInput] = React.useState(parsed.rawFromDate);
  const [toDateInput, setToDateInput] = React.useState(parsed.rawToDate);
  const [clientDateError, setClientDateError] = React.useState<string | null>(null);

  const catalogsRequestIdRef = React.useRef(0);
  const listRequestIdRef = React.useRef(0);
  const searchDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

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

  React.useEffect(() => {
    setSearchInput(parsed.filters.search ?? '');
  }, [parsed.filters.search]);

  React.useEffect(() => {
    setFromDateInput(parsed.rawFromDate);
    setToDateInput(parsed.rawToDate);
    setClientDateError(null);
  }, [parsed.rawFromDate, parsed.rawToDate]);

  React.useEffect(() => {
    return () => {
      if (searchDebounceRef.current !== null) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, []);

  const loadCatalogs = React.useCallback(async () => {
    const requestId = ++catalogsRequestIdRef.current;
    try {
      const [fundsRes, categoriesRes] = await Promise.all([
        fundsApi.list({ includeArchived: true }),
        categoriesApi.list({ includeArchived: true }),
      ]);
      if (requestId !== catalogsRequestIdRef.current) {
        return;
      }
      setFunds(fundsRes.funds);
      setCategories(categoriesRes.categories);
      setHasCatalogsLoaded(true);
    } catch {
      if (requestId === catalogsRequestIdRef.current) {
        setHasCatalogsLoaded(true);
      }
    }
  }, []);

  React.useEffect(() => {
    void loadCatalogs();
  }, [loadCatalogs]);

  const effectiveDateError = clientDateError ?? parsed.dateError;

  const loadTransactions = React.useCallback(async () => {
    if (effectiveDateError !== null) {
      setIsLoading(false);
      return;
    }

    const requestId = ++listRequestIdRef.current;
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await ledgerApi.list(parsed.filters);
      if (requestId !== listRequestIdRef.current) {
        return;
      }
      setListData(response);
    } catch (error) {
      if (requestId !== listRequestIdRef.current) {
        return;
      }
      setErrorMessage(getApiErrorMessage(error, 'No se pudo cargar el historial de movimientos.'));
    } finally {
      if (requestId === listRequestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [parsed.filters, effectiveDateError]);

  React.useEffect(() => {
    void loadTransactions();
  }, [loadTransactions]);

  const replaceUrlWithFilters = React.useCallback(
    (nextFilters: TransactionFiltersState) => {
      const params = buildTransactionsUrlSearchParams(nextFilters);
      const query = params.toString();
      router.replace(query.length > 0 ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router],
  );

  const handleFilterChange = (patch: Partial<TransactionFiltersState>): void => {
    const nextFilters: TransactionFiltersState = {
      ...parsed.filters,
      ...patch,
      page: patch.page ?? DEFAULT_TRANSACTIONS_PAGE,
    };
    replaceUrlWithFilters(nextFilters);
  };

  const handleSearchChange = (value: string): void => {
    const clamped = value.slice(0, SEARCH_MAX_LENGTH);
    setSearchInput(clamped);

    if (searchDebounceRef.current !== null) {
      clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = null;
    }

    searchDebounceRef.current = setTimeout(() => {
      searchDebounceRef.current = null;
      const trimmedNext = clamped.trim();
      const currentSearch = parsed.filters.search ?? '';
      if (trimmedNext !== currentSearch) {
        handleFilterChange({
          search: trimmedNext.length > 0 ? trimmedNext : undefined,
          page: DEFAULT_TRANSACTIONS_PAGE,
        });
      }
    }, SEARCH_DEBOUNCE_MS);
  };

  const handleDateChange = (field: 'fromDate' | 'toDate', value: string): void => {
    const nextFrom = field === 'fromDate' ? value : fromDateInput;
    const nextTo = field === 'toDate' ? value : toDateInput;

    if (field === 'fromDate') {
      setFromDateInput(value);
    } else {
      setToDateInput(value);
    }

    const validationError = validateTransactionDateRange(nextFrom, nextTo);
    setClientDateError(validationError);

    if (validationError !== null) {
      setIsLoading(false);
      return;
    }

    handleFilterChange({
      fromDate: nextFrom.trim() || undefined,
      toDate: nextTo.trim() || undefined,
      page: DEFAULT_TRANSACTIONS_PAGE,
    });
  };

  const handleClearFilters = (): void => {
    if (searchDebounceRef.current !== null) {
      clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = null;
    }
    setSearchInput('');
    setFromDateInput('');
    setToDateInput('');
    setClientDateError(null);
    router.replace(pathname, { scroll: false });
  };

  const showClearFilters =
    parsed.hasActiveFilters ||
    clientDateError !== null ||
    searchInput.trim().length > 0 ||
    fromDateInput.trim().length > 0 ||
    toDateInput.trim().length > 0;

  const items = listData?.items ?? [];
  const total = listData?.total ?? 0;
  const currentPage = listData?.page ?? parsed.filters.page;
  const rawTotalPages = listData?.totalPages ?? 0;
  const displayTotalPages = rawTotalPages === 0 ? 1 : rawTotalPages;

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Movimientos</h1>
          <p className="text-sm text-muted-foreground">
            Historial filtrado de ingresos, gastos, transferencias, ajustes, anulaciones y
            reembolsos.
          </p>
        </div>

        <Link
          href="/transactions/new"
          className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <PlusCircle className="h-4 w-4" />
          <span>Registrar movimiento</span>
        </Link>
      </div>

      {/* Barra de filtros combinables */}
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="filter-search">Buscar por descripción o notas</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="filter-search"
                  type="text"
                  maxLength={SEARCH_MAX_LENGTH}
                  value={searchInput}
                  onChange={(event) => handleSearchChange(event.target.value)}
                  placeholder="Ej. Supermercado, alquiler, recibo..."
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="filter-type">Tipo</Label>
              <select
                id="filter-type"
                value={parsed.filters.type ?? 'ALL'}
                onChange={(event) =>
                  handleFilterChange({
                    type:
                      event.target.value === 'ALL'
                        ? undefined
                        : (event.target.value as TransactionTypeValue),
                  })
                }
                className={SELECT_CLASS}
              >
                <option value="ALL">Todos los tipos</option>
                {TRANSACTION_TYPES.map((typeOption) => (
                  <option key={typeOption} value={typeOption}>
                    {TRANSACTION_TYPE_LABELS[typeOption]}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="filter-status">Estado</Label>
              <select
                id="filter-status"
                value={parsed.filters.status ?? 'ALL'}
                onChange={(event) =>
                  handleFilterChange({
                    status:
                      event.target.value === 'ALL'
                        ? undefined
                        : (event.target.value as TransactionStatusValue),
                  })
                }
                className={SELECT_CLASS}
              >
                <option value="ALL">Todos los estados</option>
                {TRANSACTION_STATUSES.map((statusOption) => (
                  <option key={statusOption} value={statusOption}>
                    {TRANSACTION_STATUS_LABELS[statusOption]}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="filter-fund">Fondo</Label>
              <select
                id="filter-fund"
                value={parsed.filters.fundId ?? 'ALL'}
                onChange={(event) =>
                  handleFilterChange({
                    fundId: event.target.value === 'ALL' ? undefined : event.target.value,
                  })
                }
                className={SELECT_CLASS}
              >
                <option value="ALL">Todos los fondos</option>
                {funds.map((fund) => (
                  <option key={fund.id} value={fund.id}>
                    {fund.name} ({fund.currency}){fund.isArchived ? ' - Archivado' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="filter-category">Categoría</Label>
              <select
                id="filter-category"
                value={parsed.filters.categoryId ?? 'ALL'}
                onChange={(event) =>
                  handleFilterChange({
                    categoryId: event.target.value === 'ALL' ? undefined : event.target.value,
                  })
                }
                className={SELECT_CLASS}
              >
                <option value="ALL">Todas las categorías</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                    {category.isArchived ? ' - Archivada' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="filter-currency">Moneda</Label>
              <select
                id="filter-currency"
                value={parsed.filters.currency ?? 'ALL'}
                onChange={(event) =>
                  handleFilterChange({
                    currency:
                      event.target.value === 'ALL'
                        ? undefined
                        : (event.target.value as FundCurrencyCode),
                  })
                }
                className={SELECT_CLASS}
              >
                <option value="ALL">Todas</option>
                {FUND_CURRENCIES.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="filter-limit">Por página</Label>
              <select
                id="filter-limit"
                value={parsed.filters.limit}
                onChange={(event) =>
                  handleFilterChange({
                    limit: Number.parseInt(event.target.value, 10) || DEFAULT_TRANSACTIONS_LIMIT,
                    page: DEFAULT_TRANSACTIONS_PAGE,
                  })
                }
                className={SELECT_CLASS}
              >
                {LIMIT_OPTIONS.map((limitOption) => (
                  <option key={limitOption} value={limitOption}>
                    {limitOption} movimientos
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="filter-from-date">Desde</Label>
              <Input
                id="filter-from-date"
                type="date"
                value={fromDateInput}
                aria-invalid={Boolean(effectiveDateError)}
                onChange={(event) => handleDateChange('fromDate', event.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="filter-to-date">Hasta</Label>
              <Input
                id="filter-to-date"
                type="date"
                value={toDateInput}
                aria-invalid={Boolean(effectiveDateError)}
                onChange={(event) => handleDateChange('toDate', event.target.value)}
              />
            </div>

            {showClearFilters && (
              <div className="flex items-end sm:col-span-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClearFilters}
                  className="gap-2"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span>Limpiar filtros</span>
                </Button>
              </div>
            )}
          </div>

          {effectiveDateError && (
            <Alert variant="destructive" data-testid="transactions-date-range-error">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{effectiveDateError}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {errorMessage && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span>{errorMessage}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void loadTransactions()}
            >
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="space-y-3" aria-busy="true" data-testid="transactions-loading">
          {[1, 2, 3, 4].map((row) => (
            <div
              key={row}
              className="h-20 animate-pulse rounded-xl border border-border bg-card/60"
            />
          ))}
        </div>
      ) : effectiveDateError !== null ? null : items.length === 0 ? (
        <div
          data-testid="transactions-empty-state"
          className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card p-10 text-center"
        >
          <ArrowLeftRight className="h-8 w-8 text-accent" />
          <p className="text-sm font-medium text-foreground">
            {showClearFilters
              ? 'No hay movimientos que coincidan con los filtros'
              : 'Aún no tienes movimientos registrados'}
          </p>
          <p className="text-xs text-muted-foreground">
            {showClearFilters
              ? 'Prueba ajustando el rango de fechas, tipo o búsqueda.'
              : 'Registra tu primer ingreso, gasto, transferencia o ajuste.'}
          </p>
          <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
            {showClearFilters && (
              <Button type="button" variant="outline" size="sm" onClick={handleClearFilters}>
                Limpiar filtros
              </Button>
            )}
            <Link
              href="/transactions/new"
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
            >
              <PlusCircle className="h-4 w-4" />
              <span>Registrar movimiento</span>
            </Link>
          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-border" data-testid="transactions-list">
              {items.map((tx) => {
                const amountDisplay = formatTransactionAmountDisplay(tx);
                const fundSummary = resolveFundSummary(tx, fundsById, hasCatalogsLoaded);
                const singleCategory =
                  tx.categoryId && tx.splits.length === 0
                    ? categoriesById.get(tx.categoryId.toLowerCase())
                    : undefined;
                const categoryLabel = singleCategory
                  ? singleCategory.isArchived
                    ? `${singleCategory.name} (Archivada)`
                    : singleCategory.name
                  : tx.categoryId && tx.splits.length === 0 && hasCatalogsLoaded
                    ? 'Categoría no disponible'
                    : null;

                return (
                  <li
                    key={tx.id}
                    className={`flex flex-col gap-3 p-4 transition-colors hover:bg-secondary/20 sm:flex-row sm:items-center sm:justify-between ${
                      tx.status === 'VOIDED' ? 'opacity-75' : ''
                    }`}
                  >
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/transactions/${tx.id}`}
                          className={`truncate text-sm font-semibold hover:underline ${
                            tx.status === 'VOIDED'
                              ? 'text-muted-foreground line-through'
                              : 'text-foreground'
                          }`}
                        >
                          {tx.description}
                        </Link>
                        <TransactionTypeBadge type={tx.type} />
                        <TransactionStatusBadge status={tx.status} />
                        {tx.splits.length > 0 && (
                          <Badge variant="outline" className="gap-1">
                            <Split className="h-3 w-3" />
                            <span>Dividido ({tx.splits.length})</span>
                          </Badge>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span>{formatDate(tx.occurredOn)}</span>
                        <span>&middot;</span>
                        <span>{fundSummary}</span>
                        {categoryLabel && (
                          <>
                            <span>&middot;</span>
                            <span>{categoryLabel}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-4 sm:justify-end">
                      <span
                        className={`text-sm font-semibold tabular-nums ${amountDisplay.colorClass}`}
                      >
                        {amountDisplay.text}
                      </span>

                      <Link
                        href={`/transactions/${tx.id}`}
                        aria-label={`Ver detalle de ${tx.description}`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                      >
                        <span>Ver detalle</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Paginación */}
      {!isLoading && effectiveDateError === null && listData !== null && (
        <div
          data-testid="transactions-pagination"
          className="flex flex-col items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm sm:flex-row"
        >
          <p className="text-muted-foreground">
            Total: <strong className="text-foreground">{total}</strong>{' '}
            {total === 1 ? 'movimiento' : 'movimientos'} &middot; Página{' '}
            <strong className="text-foreground">{currentPage}</strong> de{' '}
            <strong className="text-foreground">{displayTotalPages}</strong>
          </p>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={currentPage <= 1 || isLoading}
              onClick={() => handleFilterChange({ page: currentPage - 1 })}
              className="gap-1"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Anterior</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={rawTotalPages === 0 || currentPage >= rawTotalPages || isLoading}
              onClick={() => handleFilterChange({ page: currentPage + 1 })}
              className="gap-1"
            >
              <span>Siguiente</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

export default function TransactionsPage(): React.JSX.Element {
  return (
    <React.Suspense
      fallback={
        <section className="space-y-6">
          <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-8 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin text-accent" />
            <span>Cargando historial de movimientos...</span>
          </div>
        </section>
      }
    >
      <TransactionsPageContent />
    </React.Suspense>
  );
}

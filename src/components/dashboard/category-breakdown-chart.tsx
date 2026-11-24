'use client';

import * as React from 'react';
import { BarChart3, Info } from 'lucide-react';
import { CategoryIconBadge } from '@/components/categories/category-icon';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { HEX_COLOR_REGEX } from '@/lib/category-schemas';
import { calculateCategoryPercentage } from '@/lib/dashboard-utils';
import { formatCurrency, isZeroMoney } from '@/lib/money';
import { cn } from '@/lib/utils';
import type { CategoryKind } from '@/types/categories';
import type { FundCurrencyCode } from '@/types/funds';
import type { CurrencyMonthlySummaryView } from '@/types/ledger';

export interface CategoryBreakdownChartProps {
  currencySummary: CurrencyMonthlySummaryView;
  activeCurrency: FundCurrencyCode;
}

export function CategoryBreakdownChart({
  currencySummary,
  activeCurrency,
}: CategoryBreakdownChartProps): React.JSX.Element {
  const [activeKind, setActiveKind] = React.useState<CategoryKind>('EXPENSE');

  const items = React.useMemo(
    () => currencySummary.byCategory.filter((item) => item.kind === activeKind),
    [currencySummary.byCategory, activeKind],
  );

  // El desglose por categoría refleja montos brutos POSTED:
  // en EXPENSE el denominador es totalExpenseGross (jamás totalExpenseNet).
  const denominator =
    activeKind === 'EXPENSE' ? currencySummary.totalExpenseGross : currencySummary.totalIncome;

  const hasRefunds = !isZeroMoney(currencySummary.totalRefunds);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-lg">
            <BarChart3 className="h-5 w-5 text-primary" aria-hidden="true" />
            Desglose por categoría
          </CardTitle>
          <CardDescription>
            Distribución mensual en {activeCurrency} sobre movimientos confirmados.
          </CardDescription>
        </div>

        <div
          role="tablist"
          aria-label="Tipo de desglose por categoría"
          className="inline-flex rounded-lg border border-border bg-secondary/40 p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeKind === 'EXPENSE'}
            onClick={() => setActiveKind('EXPENSE')}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              activeKind === 'EXPENSE'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Gastos
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeKind === 'INCOME'}
            onClick={() => setActiveKind('INCOME')}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              activeKind === 'INCOME'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Ingresos
          </button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-secondary/20 px-4 py-8 text-center text-sm text-muted-foreground">
            {activeKind === 'EXPENSE'
              ? `No hay gastos por categoría registrados en ${activeCurrency} para este mes.`
              : `No hay ingresos por categoría registrados en ${activeCurrency} para este mes.`}
          </div>
        ) : (
          <ul className="space-y-3" aria-label={`Categorías de ${activeKind === 'EXPENSE' ? 'gastos' : 'ingresos'}`}>
            {items.map((item) => {
              const percentage = calculateCategoryPercentage(item.totalAmount, denominator);
              const barColor =
                item.color && HEX_COLOR_REGEX.test(item.color.trim())
                  ? item.color.trim()
                  : undefined;

              return (
                <li key={item.categoryId} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <CategoryIconBadge
                        iconName={item.icon}
                        colorHex={item.color}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {item.categoryName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {item.transactionCount}{' '}
                          {item.transactionCount === 1 ? 'movimiento' : 'movimientos'}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold tabular-nums text-foreground">
                        {formatCurrency(item.totalAmount, activeCurrency)}
                      </p>
                      <p className="text-xs tabular-nums text-muted-foreground">{percentage}%</p>
                    </div>
                  </div>

                  <div
                    role="progressbar"
                    aria-label={`${item.categoryName}: ${percentage}%`}
                    aria-valuenow={percentage}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    className="h-2 w-full overflow-hidden rounded-full bg-secondary"
                  >
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-300',
                        !barColor && (activeKind === 'EXPENSE' ? 'bg-destructive' : 'bg-income'),
                      )}
                      style={{
                        width: `${percentage}%`,
                        backgroundColor: barColor,
                      }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {activeKind === 'EXPENSE' && hasRefunds ? (
          <p className="flex items-start gap-2 rounded-md border border-border bg-secondary/30 px-3 py-2 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
            <span>
              El desglose por categoría refleja gastos brutos confirmados (POSTED); el KPI superior
              muestra el gasto neto tras descontar reembolsos.
            </span>
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

import * as React from 'react';
import Link from 'next/link';
import { ArrowLeftRight, PlusCircle } from 'lucide-react';

export default function TransactionsPage(): React.JSX.Element {
  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Movimientos</h1>
          <p className="text-sm text-muted-foreground">
            Historial de ingresos, gastos, transferencias y ajustes del ledger.
          </p>
        </div>
        <Link
          href="/transactions/new"
          className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <PlusCircle className="h-4 w-4" />
          Registrar movimiento
        </Link>
      </div>
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card p-10 text-center">
        <ArrowLeftRight className="h-8 w-8 text-accent" />
        <p className="text-sm font-medium text-foreground">Módulo de Movimientos en preparación</p>
        <p className="text-xs text-muted-foreground">
          Aquí podrás registrar, filtrar, anular y reembolsar operaciones financieras.
        </p>
        <Link
          href="/transactions/new"
          className="mt-1 inline-flex h-9 items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <PlusCircle className="h-4 w-4" />
          Nuevo movimiento
        </Link>
      </div>
    </section>
  );
}

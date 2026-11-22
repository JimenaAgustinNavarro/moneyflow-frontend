import * as React from 'react';
import { ArrowLeftRight } from 'lucide-react';

export default function TransactionsPage(): React.JSX.Element {
  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Movimientos</h1>
        <p className="text-sm text-muted-foreground">
          Historial de ingresos, gastos, transferencias y ajustes del ledger.
        </p>
      </div>
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card p-10 text-center">
        <ArrowLeftRight className="h-8 w-8 text-accent" />
        <p className="text-sm font-medium text-foreground">Módulo de Movimientos en preparación</p>
        <p className="text-xs text-muted-foreground">
          Aquí podrás registrar, filtrar, anular y reembolsar operaciones financieras.
        </p>
      </div>
    </section>
  );
}

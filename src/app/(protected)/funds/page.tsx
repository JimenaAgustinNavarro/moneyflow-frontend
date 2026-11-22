import * as React from 'react';
import { Wallet } from 'lucide-react';

export default function FundsPage(): React.JSX.Element {
  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Fondos</h1>
        <p className="text-sm text-muted-foreground">
          Gestión de cuentas, billeteras y saldos por moneda.
        </p>
      </div>
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card p-10 text-center">
        <Wallet className="h-8 w-8 text-accent" />
        <p className="text-sm font-medium text-foreground">Módulo de Fondos en preparación</p>
        <p className="text-xs text-muted-foreground">
          Aquí podrás crear, editar y consultar el detalle de tus fondos en PEN y USD.
        </p>
      </div>
    </section>
  );
}

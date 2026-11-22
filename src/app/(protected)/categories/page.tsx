import * as React from 'react';
import { Tags } from 'lucide-react';

export default function CategoriesPage(): React.JSX.Element {
  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Categorías</h1>
        <p className="text-sm text-muted-foreground">
          Clasificación de ingresos y gastos del sistema y personalizadas.
        </p>
      </div>
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card p-10 text-center">
        <Tags className="h-8 w-8 text-accent" />
        <p className="text-sm font-medium text-foreground">Módulo de Categorías en preparación</p>
        <p className="text-xs text-muted-foreground">
          Aquí podrás administrar tus categorías de ingresos y gastos.
        </p>
      </div>
    </section>
  );
}

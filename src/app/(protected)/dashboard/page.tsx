'use client';

import * as React from 'react';
import { User } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';

export default function DashboardPage(): React.JSX.Element {
  const { user } = useAuth();

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Panel Principal</h1>
        <p className="text-sm text-muted-foreground">
          Resumen general de tus fondos y movimientos en MoneyFlow.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
            <User className="h-5 w-5 text-foreground" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {user ? user.fullName : 'Usuario autenticado'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {user ? user.email : 'Sesión activa'}
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-dashed border-border bg-secondary/30 p-6 text-center text-sm text-muted-foreground">
          Resumen de fondos y movimientos en preparación. Tu sesión se mantiene protegida con
          refresco automático.
        </div>
      </div>
    </section>
  );
}

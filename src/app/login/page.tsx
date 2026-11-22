'use client';

import * as React from 'react';
import Link from 'next/link';
import { Wallet, ArrowLeft } from 'lucide-react';
import { GuestOnlyRoute } from '@/components/auth/route-guards';

export default function LoginPlaceholderPage(): React.JSX.Element {
  return (
    <GuestOnlyRoute>
      <main className="flex min-h-screen flex-col items-center justify-center bg-background p-6">
        <div className="w-full max-w-md space-y-6 rounded-xl border border-border bg-card p-8 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow">
            <Wallet className="h-6 w-6 text-accent" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Iniciar sesión en MoneyFlow
            </h1>
            <p className="text-sm text-muted-foreground">
              El formulario completo de autenticación estará disponible en la siguiente etapa.
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al inicio
          </Link>
        </div>
      </main>
    </GuestOnlyRoute>
  );
}

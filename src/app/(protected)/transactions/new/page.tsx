'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { TransactionForm } from '@/components/ledger/transaction-form';
import { Card, CardContent } from '@/components/ui/card';
import { parseInitialLedgerMode } from '@/lib/ledger-schemas';

function NewTransactionPageContent(): React.JSX.Element {
  const searchParams = useSearchParams();
  const initialMode = parseInitialLedgerMode(searchParams.get('type'));
  const initialFundId = searchParams.get('fundId');

  return (
    <TransactionForm
      initialMode={initialMode}
      initialFundId={initialFundId}
    />
  );
}

export default function NewTransactionPage(): React.JSX.Element {
  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Registrar movimiento
          </h1>
          <p className="text-sm text-muted-foreground">
            Registra ingresos, gastos con o sin splits, transferencias entre fondos y ajustes
            manuales.
          </p>
        </div>

        <Link
          href="/transactions"
          className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-input bg-background px-3.5 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a movimientos
        </Link>
      </div>

      <React.Suspense
        fallback={
          <Card>
            <CardContent className="flex items-center gap-3 p-8 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin text-accent" />
              <span>Preparando registro contable...</span>
            </CardContent>
          </Card>
        }
      >
        <NewTransactionPageContent />
      </React.Suspense>
    </section>
  );
}

'use client';

import * as React from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/auth/auth-provider';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { getHealth, ApiError } from '@/lib/api-client';
import { formatMoney, formatDateTime } from '@/lib/formatters';
import { GatewayHealthResponse } from '@/types/api';
import { Activity, CheckCircle2, AlertTriangle, XCircle, RefreshCw, ArrowUpRight, ArrowDownRight, Wallet } from 'lucide-react';

export default function HomePage(): React.JSX.Element {
  const { status } = useAuth();
  const [health, setHealth] = React.useState<GatewayHealthResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);

  const checkConnection = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await getHealth();
      setHealth(response);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(`${err.error}: ${err.message}`);
      } else {
        setError('Error inesperado al conectar con el servidor');
      }
      setHealth(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void checkConnection();
  }, [checkConnection]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-6 sm:p-12 md:p-24">
      {/* Header con Brand y Selector de Tema */}
      <header className="w-full max-w-5xl flex items-center justify-between border-b border-border pb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow">
            <Wallet className="h-6 w-6 text-accent" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">MoneyFlow</h1>
            <p className="text-xs text-muted-foreground">Plataforma de Finanzas Personales</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {status === 'authenticated' && (
            <Link
              href="/dashboard"
              className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-3.5 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Ir al dashboard
            </Link>
          )}
          {status === 'unauthenticated' && (
            <nav aria-label="Acceso de cuenta" className="flex items-center gap-2">
              <Link
                href="/login"
                className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Iniciar sesión
              </Link>
              <Link
                href="/register"
                className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Registrarse
              </Link>
            </nav>
          )}
          <ThemeToggle />
        </div>
      </header>

      {/* Contenido Central */}
      <section className="w-full max-w-5xl my-10 space-y-8">
        {/* Banner de Estado de Conexión al Gateway */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-accent" />
              <h2 className="text-lg font-semibold text-foreground">Estado del Backend (API Gateway)</h2>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void checkConnection()}
              disabled={isLoading}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Reintentar
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center gap-3 text-sm text-muted-foreground py-4">
              <RefreshCw className="h-4 w-4 animate-spin text-accent" />
              <span>Verificando conectividad con GET /api/v1/health...</span>
            </div>
          ) : health ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-income font-medium text-sm">
                <CheckCircle2 className="h-5 w-5" />
                <span>Todos los servicios y base de datos se encuentran operativos</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
                <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                  <span className="text-muted-foreground block">API Gateway</span>
                  <span className="font-semibold text-foreground capitalize">{health.gateway}</span>
                </div>
                <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                  <span className="text-muted-foreground block">Core Service</span>
                  <span className="font-semibold text-foreground capitalize">{health.coreService}</span>
                </div>
                <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                  <span className="text-muted-foreground block">PostgreSQL</span>
                  <span className="font-semibold text-foreground capitalize">{health.database}</span>
                </div>
                <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                  <span className="text-muted-foreground block">Último Latido (Lima)</span>
                  <span className="font-semibold text-foreground">{formatDateTime(health.timestamp)}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-destructive font-medium text-sm">
                <XCircle className="h-5 w-5" />
                <span>No se pudo establecer conexión con el API Gateway</span>
              </div>
              <p className="text-xs text-muted-foreground font-mono bg-destructive/10 p-3 rounded border border-destructive/20">
                {error}
              </p>
            </div>
          )}
        </div>

        {/* Demostración de Sistema Visual y Formateo Monetario String */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Demostración de Tokens Visuales y Formateo PEN (100% Cadenas)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Ingreso */}
            <div className="p-4 rounded-lg border border-border bg-secondary/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Ingreso Registrado</span>
                <ArrowUpRight className="h-4 w-4 text-income" />
              </div>
              <div className="text-2xl font-bold text-income">
                {formatMoney('1250.50')}
              </div>
              <p className="text-[11px] text-muted-foreground">Entrada exacta: "1250.50"</p>
            </div>

            {/* Egreso */}
            <div className="p-4 rounded-lg border border-border bg-secondary/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Gasto Registrado</span>
                <ArrowDownRight className="h-4 w-4 text-expense" />
              </div>
              <div className="text-2xl font-bold text-expense">
                {formatMoney('-45.00')}
              </div>
              <p className="text-[11px] text-muted-foreground">Entrada exacta: "-45.00"</p>
            </div>

            {/* Advertencia / Saldo Cero */}
            <div className="p-4 rounded-lg border border-border bg-secondary/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Saldo Neutro / Alerta</span>
                <AlertTriangle className="h-4 w-4 text-warning" />
              </div>
              <div className="text-2xl font-bold text-foreground">
                {formatMoney('0.00')}
              </div>
              <p className="text-[11px] text-muted-foreground">Normalizado desde "-0.00"</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full max-w-5xl text-center text-xs text-muted-foreground border-t border-border pt-6">
        MoneyFlow Personal Finance &copy; 2026 &mdash; MF-004 Scaffolding Next.js App Router
      </footer>
    </main>
  );
}

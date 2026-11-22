'use client';

import * as React from 'react';
import { LogOut, User, Wallet } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';

export default function DashboardPage(): React.JSX.Element {
  const { user, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);

  const handleLogout = async (): Promise<void> => {
    setIsLoggingOut(true);
    try {
      await logout();
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-6 sm:p-12">
      <header className="flex w-full max-w-5xl items-center justify-between border-b border-border pb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow">
            <Wallet className="h-6 w-6 text-accent" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">MoneyFlow</h1>
            <p className="text-xs text-muted-foreground">Panel Principal</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleLogout()}
            disabled={isLoggingOut}
            className="gap-2"
          >
            <LogOut className="h-4 w-4" />
            {isLoggingOut ? 'Cerrando...' : 'Cerrar sesión'}
          </Button>
        </div>
      </header>

      <section className="my-10 w-full max-w-5xl space-y-6">
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

      <footer className="w-full max-w-5xl border-t border-border pt-6 text-center text-xs text-muted-foreground">
        MoneyFlow Personal Finance &copy; 2026
      </footer>
    </main>
  );
}

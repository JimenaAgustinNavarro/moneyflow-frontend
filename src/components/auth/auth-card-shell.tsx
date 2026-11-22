'use client';

import * as React from 'react';
import Link from 'next/link';
import { Wallet } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';

interface AuthCardShellProps {
  children: React.ReactNode;
}

export function AuthCardShell({ children }: AuthCardShellProps): React.JSX.Element {
  return (
    <div className="flex min-h-screen flex-col justify-between bg-background px-4 py-6 sm:px-6">
      <header className="mx-auto flex w-full max-w-md items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow">
            <Wallet className="h-5 w-5 text-accent" />
          </span>
          <span className="text-lg font-bold tracking-tight text-foreground">MoneyFlow</span>
        </Link>
        <ThemeToggle />
      </header>

      <main className="mx-auto my-8 w-full max-w-md">{children}</main>

      <footer className="mx-auto w-full max-w-md text-center text-xs text-muted-foreground">
        MoneyFlow &copy; 2026 &mdash; Finanzas Personales
      </footer>
    </div>
  );
}

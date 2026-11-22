'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';

function AuthLoadingFallback({ label }: { label: string }): React.JSX.Element {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-screen items-center justify-center bg-background p-6 text-sm text-muted-foreground"
    >
      <div className="flex items-center gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-accent" />
        <span>{label}</span>
      </div>
    </div>
  );
}

export function ProtectedRoute({ children }: { children: React.ReactNode }): React.JSX.Element | null {
  const { status } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [status, router]);

  if (status === 'loading') {
    return <AuthLoadingFallback label="Verificando sesión..." />;
  }

  if (status === 'unauthenticated') {
    return null;
  }

  return <>{children}</>;
}

export function GuestOnlyRoute({ children }: { children: React.ReactNode }): React.JSX.Element | null {
  const { status } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/dashboard');
    }
  }, [status, router]);

  if (status === 'loading') {
    return <AuthLoadingFallback label="Comprobando estado de sesión..." />;
  }

  if (status === 'authenticated') {
    return null;
  }

  return <>{children}</>;
}

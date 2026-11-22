'use client';

import * as React from 'react';
import { ProtectedRoute } from '@/components/auth/route-guards';
import { AppShell } from '@/components/layout/app-shell';

export default function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): React.JSX.Element {
  return (
    <ProtectedRoute>
      <AppShell>{children}</AppShell>
    </ProtectedRoute>
  );
}

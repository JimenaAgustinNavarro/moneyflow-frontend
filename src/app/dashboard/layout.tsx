'use client';

import * as React from 'react';
import { ProtectedRoute } from '@/components/auth/route-guards';

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): React.JSX.Element {
  return <ProtectedRoute>{children}</ProtectedRoute>;
}

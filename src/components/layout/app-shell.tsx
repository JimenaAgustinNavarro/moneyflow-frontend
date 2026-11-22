'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ArrowLeftRight,
  LayoutDashboard,
  LogOut,
  Menu,
  Tags,
  User,
  Wallet,
  X,
} from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: readonly NavItem[] = [
  { href: '/dashboard', label: 'Panel Principal', icon: LayoutDashboard },
  { href: '/funds', label: 'Fondos', icon: Wallet },
  { href: '/transactions', label: 'Movimientos', icon: ArrowLeftRight },
  { href: '/categories', label: 'Categorías', icon: Tags },
];

function isRouteActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

interface SidebarContentProps {
  pathname: string;
  fullName: string;
  email: string;
  isLoggingOut: boolean;
  onLogout: () => void;
  onNavigate?: () => void;
}

function SidebarContent({
  pathname,
  fullName,
  email,
  isLoggingOut,
  onLogout,
  onNavigate,
}: SidebarContentProps): React.JSX.Element {
  return (
    <div className="flex h-full flex-col justify-between bg-card text-card-foreground">
      <div className="space-y-6 p-4">
        <div className="flex items-center gap-3 border-b border-border pb-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow">
            <Wallet className="h-5 w-5 text-accent" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-bold tracking-tight text-foreground">MoneyFlow</p>
            <p className="truncate text-xs text-muted-foreground">Finanzas Personales</p>
          </div>
        </div>

        <nav aria-label="Navegación principal" className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const active = isRouteActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  active
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                )}
              >
                <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-accent' : '')} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="space-y-4 border-t border-border p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground">Tema</span>
          <ThemeToggle />
        </div>

        <div className="flex items-center gap-3 rounded-lg border border-border bg-secondary/40 p-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary">
            <User className="h-4 w-4 text-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{fullName}</p>
            <p className="truncate text-xs text-muted-foreground">{email}</p>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onLogout}
          disabled={isLoggingOut}
          className="w-full justify-center gap-2"
        >
          <LogOut className="h-4 w-4" />
          <span>{isLoggingOut ? 'Cerrando...' : 'Cerrar sesión'}</span>
        </Button>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }): React.JSX.Element {
  const pathname = usePathname() ?? '/dashboard';
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);

  const fullName = user?.fullName ?? 'Usuario autenticado';
  const email = user?.email ?? 'Sesión activa';

  React.useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    if (!isMobileMenuOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setIsMobileMenuOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMobileMenuOpen]);

  const handleLogout = async (): Promise<void> => {
    setIsLoggingOut(true);
    try {
      await logout();
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Sidebar fijo en escritorio */}
      <aside className="hidden border-r border-border md:fixed md:inset-y-0 md:left-0 md:z-30 md:flex md:w-64 md:flex-col">
        <SidebarContent
          pathname={pathname}
          fullName={fullName}
          email={email}
          isLoggingOut={isLoggingOut}
          onLogout={() => void handleLogout()}
        />
      </aside>

      {/* Barra superior móvil */}
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-card px-4 md:hidden">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground shadow">
            <Wallet className="h-4 w-4 text-accent" />
          </div>
          <span className="text-base font-bold tracking-tight text-foreground">MoneyFlow</span>
        </div>

        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Abrir menú de navegación"
          aria-expanded={isMobileMenuOpen}
          aria-controls="mobile-navigation-drawer"
          onClick={() => setIsMobileMenuOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </Button>
      </header>

      {/* Drawer móvil accesible */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-sm"
            aria-hidden="true"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div
            id="mobile-navigation-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Menú de navegación"
            className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-border bg-card shadow-xl"
          >
            <div className="flex items-center justify-end border-b border-border px-4 py-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Cerrar menú de navegación"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <SidebarContent
                pathname={pathname}
                fullName={fullName}
                email={email}
                isLoggingOut={isLoggingOut}
                onLogout={() => void handleLogout()}
                onNavigate={() => setIsMobileMenuOpen(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Área principal de contenido */}
      <div className="flex min-h-screen flex-col md:pl-64">
        <main className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
        <footer className="border-t border-border px-4 py-4 text-center text-xs text-muted-foreground sm:px-6 lg:px-8">
          MoneyFlow Personal Finance &copy; 2026
        </footer>
      </div>
    </div>
  );
}

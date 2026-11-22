import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AppShell } from '../app-shell';

const mockUsePathname = vi.fn<() => string>();
const mockLogout = vi.fn<() => Promise<void>>();

vi.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
}));

vi.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'light', setTheme: vi.fn() }),
}));

vi.mock('@/components/auth/auth-provider', () => ({
  useAuth: () => ({
    status: 'authenticated',
    user: {
      id: 'user-1',
      email: 'jimena@example.com',
      fullName: 'Jimena García',
      preferredCurrency: 'PEN',
      timezone: 'America/Lima',
      emailVerifiedAt: '2026-11-20T10:00:00.000Z',
      isActive: true,
      createdAt: '2026-11-20T10:00:00.000Z',
    },
    refreshUser: vi.fn(),
    setAuthenticatedUser: vi.fn(),
    logout: mockLogout,
  }),
}));

describe('AppShell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePathname.mockReturnValue('/dashboard');
    mockLogout.mockResolvedValue(undefined);
  });

  it('renderiza los enlaces principales, datos del usuario y marca la ruta activa', () => {
    render(
      <AppShell>
        <div>Contenido protegido</div>
      </AppShell>,
    );

    expect(screen.getByText('Contenido protegido')).toBeInTheDocument();
    expect(screen.getByText('Jimena García')).toBeInTheDocument();
    expect(screen.getByText('jimena@example.com')).toBeInTheDocument();

    const dashboardLink = screen.getByRole('link', { name: 'Panel Principal' });
    expect(dashboardLink).toHaveAttribute('aria-current', 'page');

    const fundsLink = screen.getByRole('link', { name: 'Fondos' });
    expect(fundsLink).not.toHaveAttribute('aria-current');
  });

  it('marca activo el enlace cuando la ruta actual es una subruta (/funds/123)', () => {
    mockUsePathname.mockReturnValue('/funds/123');

    render(
      <AppShell>
        <div>Detalle de fondo</div>
      </AppShell>,
    );

    const fundsLink = screen.getByRole('link', { name: 'Fondos' });
    expect(fundsLink).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Panel Principal' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('abre y cierra el drawer móvil accesible con Escape y ejecuta logout', async () => {
    render(
      <AppShell>
        <div>Vista móvil</div>
      </AppShell>,
    );

    const openBtn = screen.getByRole('button', { name: 'Abrir menú de navegación' });
    fireEvent.click(openBtn);

    expect(screen.getByRole('dialog', { name: 'Menú de navegación' })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Menú de navegación' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('button', { name: 'Cerrar sesión' })).not.toBeDisabled();
    });
  });
});

import * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ApiError } from '@/lib/api-client';
import { fundsApi } from '@/lib/funds-api';
import type { FundView, ListFundsResponse } from '@/types/funds';
import FundsPage from '../page';

vi.mock('@/lib/funds-api', () => ({
  fundsApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    archive: vi.fn(),
  },
}));

const FUND_PEN_ACTIVE: FundView = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Cuenta Sueldo BCP',
  type: 'BANK',
  currency: 'PEN',
  color: '#0F766E',
  icon: 'Landmark',
  allowNegativeBalance: false,
  isArchived: false,
  balance: '2500.50',
  createdAt: '2026-11-20T10:00:00.000Z',
  updatedAt: '2026-11-20T10:00:00.000Z',
};

const FUND_USD_ZERO: FundView = {
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Ahorros USD',
  type: 'SAVINGS',
  currency: 'USD',
  color: '#1D4ED8',
  icon: 'PiggyBank',
  allowNegativeBalance: false,
  isArchived: false,
  balance: '0.00',
  createdAt: '2026-11-20T10:00:00.000Z',
  updatedAt: '2026-11-20T10:00:00.000Z',
};

const FUND_ARCHIVED: FundView = {
  id: '33333333-3333-4333-8333-333333333333',
  name: 'Billetera Antigua',
  type: 'WALLET',
  currency: 'PEN',
  color: null,
  icon: null,
  allowNegativeBalance: false,
  isArchived: true,
  balance: '0.00',
  createdAt: '2026-11-19T10:00:00.000Z',
  updatedAt: '2026-11-20T10:00:00.000Z',
};

const INITIAL_LIST_RESPONSE: ListFundsResponse = {
  funds: [FUND_PEN_ACTIVE, FUND_USD_ZERO],
  totalsByCurrency: [
    { currency: 'USD', totalBalance: '0.00', fundCount: 1 },
    { currency: 'PEN', totalBalance: '2500.50', fundCount: 1 },
  ],
};

describe('FundsPage (/funds)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fundsApi.list).mockResolvedValue(INITIAL_LIST_RESPONSE);
  });

  it('renderiza totales separados por moneda (PEN primero, USD segundo) sin sumar monedas', async () => {
    render(<FundsPage />);

    await waitFor(() => {
      expect(screen.getByText('Cuenta Sueldo BCP')).toBeInTheDocument();
    });

    const summaryRegion = screen.getByLabelText('Resumen de patrimonio por moneda');
    const summaryText = summaryRegion.textContent ?? '';
    expect(summaryText.indexOf('Soles (PEN)')).toBeLessThan(summaryText.indexOf('Dólares (USD)'));
    expect(screen.getAllByText('S/ 2,500.50').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('$ 0.00').length).toBeGreaterThanOrEqual(1);
  });

  it('combina filtros de moneda, tipo y mostrar archivados y oculta acciones en archivados', async () => {
    vi.mocked(fundsApi.list).mockImplementation(async (params) => {
      if (params?.includeArchived) {
        return {
          funds: [FUND_PEN_ACTIVE, FUND_ARCHIVED],
          totalsByCurrency: [{ currency: 'PEN', totalBalance: '2500.50', fundCount: 1 }],
        };
      }
      return INITIAL_LIST_RESPONSE;
    });

    render(<FundsPage />);

    await waitFor(() => {
      expect(screen.getByText('Cuenta Sueldo BCP')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('Moneda'), { target: { value: 'PEN' } });
    fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'WALLET' } });
    fireEvent.click(screen.getByLabelText('Mostrar archivados'));

    await waitFor(() => {
      expect(fundsApi.list).toHaveBeenLastCalledWith({
        includeArchived: true,
        currency: 'PEN',
        type: 'WALLET',
      });
    });

    await waitFor(() => {
      expect(screen.getByText('Billetera Antigua')).toBeInTheDocument();
    });

    expect(screen.getByText('Archivado')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editar Billetera Antigua' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Archivar Billetera Antigua' }),
    ).not.toBeInTheDocument();
  });

  it('crea un fondo omitiendo initialBalance vacío y recarga el listado', async () => {
    vi.mocked(fundsApi.create).mockResolvedValue({
      fund: {
        ...FUND_PEN_ACTIVE,
        id: '44444444-4444-4444-8444-444444444444',
        name: 'Efectivo Casa',
        type: 'CASH',
        balance: '0.00',
      },
    });

    render(<FundsPage />);

    await waitFor(() => {
      expect(screen.getByText('Cuenta Sueldo BCP')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Nuevo fondo' }));
    fireEvent.change(screen.getByLabelText('Nombre del fondo'), {
      target: { value: '  Efectivo Casa  ' },
    });
    fireEvent.change(screen.getByLabelText('Tipo de fondo'), { target: { value: 'CASH' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear fondo' }));

    await waitFor(() => {
      expect(fundsApi.create).toHaveBeenCalledWith({
        name: 'Efectivo Casa',
        type: 'CASH',
        currency: 'PEN',
        allowNegativeBalance: false,
      });
    });
  });

  it('en edición muestra moneda en solo lectura, bloquea PATCH vacío y muestra error 409', async () => {
    vi.mocked(fundsApi.update).mockRejectedValue(
      new ApiError(
        409,
        'Conflict',
        'No se puede desactivar el sobregiro mientras el fondo tenga saldo negativo.',
      ),
    );

    render(<FundsPage />);

    await waitFor(() => {
      expect(screen.getByText('Cuenta Sueldo BCP')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Editar Cuenta Sueldo BCP' }));

    const dialog = screen.getByRole('dialog');
    const readonlyCurrency = within(dialog).getByLabelText('Moneda');
    expect(readonlyCurrency).toBeDisabled();

    // Intento sin cambios: no dispara PATCH
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => {
      expect(screen.getByText('No hay cambios para guardar.')).toBeInTheDocument();
    });
    expect(fundsApi.update).not.toHaveBeenCalled();

    // Cambio real -> dispara PATCH sin currency y muestra 409
    fireEvent.click(screen.getByLabelText('Permitir saldo negativo (sobregiro)'));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => {
      expect(fundsApi.update).toHaveBeenCalledWith(FUND_PEN_ACTIVE.id, {
        allowNegativeBalance: true,
      });
    });

    await waitFor(() => {
      expect(
        screen.getByText(
          'No se puede desactivar el sobregiro mientras el fondo tenga saldo negativo.',
        ),
      ).toBeInTheDocument();
    });
  });

  it('bloquea confirmación de archivado si saldo != 0.00 y archiva cuando es 0.00', async () => {
    vi.mocked(fundsApi.archive).mockResolvedValue({
      fund: { ...FUND_USD_ZERO, isArchived: true },
      message: 'Fondo archivado correctamente.',
    });

    render(<FundsPage />);

    await waitFor(() => {
      expect(screen.getByText('Cuenta Sueldo BCP')).toBeInTheDocument();
    });

    // Fondo con saldo > 0: advierte y deshabilita confirmación
    fireEvent.click(screen.getByRole('button', { name: 'Archivar Cuenta Sueldo BCP' }));
    expect(screen.getByText('Saldo distinto de cero')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Registrar transferencia' })).toHaveAttribute(
      'href',
      `/transactions/new?type=TRANSFER&fundId=${FUND_PEN_ACTIVE.id}`,
    );
    expect(screen.getByRole('button', { name: 'Confirmar archivado' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    // Fondo con saldo 0.00: permite archivar
    fireEvent.click(screen.getByRole('button', { name: 'Archivar Ahorros USD' }));
    const confirmBtn = screen.getByRole('button', { name: 'Confirmar archivado' });
    expect(confirmBtn).toBeEnabled();
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(fundsApi.archive).toHaveBeenCalledWith(FUND_USD_ZERO.id);
    });
  });
});

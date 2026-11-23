import * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ApiError } from '@/lib/api-client';
import { fundsApi } from '@/lib/funds-api';
import { ledgerApi } from '@/lib/ledger-api';
import type { FundDetailView } from '@/types/funds';
import type { ListTransactionsResponse } from '@/types/ledger';
import FundDetailPage from '../page';

const mockUseParams = vi.fn<() => { id?: string }>();

vi.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
}));

vi.mock('@/lib/funds-api', () => ({
  fundsApi: {
    getById: vi.fn(),
    update: vi.fn(),
    archive: vi.fn(),
  },
}));

vi.mock('@/lib/ledger-api', () => ({
  ledgerApi: {
    list: vi.fn(),
  },
}));

const FUND_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_FUND_ID = '99999999-9999-4999-8999-999999999999';

const SAMPLE_DETAIL_FUND: FundDetailView = {
  id: FUND_ID,
  name: 'Cuenta Sueldo BCP',
  type: 'BANK',
  currency: 'PEN',
  color: '#0F766E',
  icon: 'Landmark',
  allowNegativeBalance: false,
  isArchived: false,
  balance: '1350.00',
  entryCount: 2,
  createdAt: '2026-11-18T10:00:00.000Z',
  updatedAt: '2026-11-20T10:00:00.000Z',
};

const SAMPLE_TRANSACTIONS: ListTransactionsResponse = {
  items: [
    {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      type: 'INCOME',
      status: 'POSTED',
      amount: '500.00',
      currency: 'PEN',
      occurredOn: '2026-11-20',
      recordedAt: '2026-11-20T15:00:00.000Z',
      description: 'Abono quincena',
      notes: null,
      categoryId: 'cat-1',
      relatedTransactionId: null,
      idempotencyKey: null,
      createdAt: '2026-11-20T15:00:00.000Z',
      updatedAt: '2026-11-20T15:00:00.000Z',
      entries: [
        {
          id: 'entry-1',
          fundId: FUND_ID,
          signedAmount: '500.00',
          currency: 'PEN',
          occurredOn: '2026-11-20',
          createdAt: '2026-11-20T15:00:00.000Z',
        },
      ],
      splits: [],
    },
    {
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      type: 'TRANSFER',
      status: 'POSTED',
      amount: '150.00',
      currency: 'PEN',
      occurredOn: '2026-11-19',
      recordedAt: '2026-11-19T12:00:00.000Z',
      description: 'Transferencia a efectivo',
      notes: null,
      categoryId: null,
      relatedTransactionId: null,
      idempotencyKey: null,
      createdAt: '2026-11-19T12:00:00.000Z',
      updatedAt: '2026-11-19T12:00:00.000Z',
      entries: [
        {
          id: 'entry-2',
          fundId: FUND_ID,
          signedAmount: '-150.00',
          currency: 'PEN',
          occurredOn: '2026-11-19',
          createdAt: '2026-11-19T12:00:00.000Z',
        },
        {
          id: 'entry-3',
          fundId: OTHER_FUND_ID,
          signedAmount: '150.00',
          currency: 'PEN',
          occurredOn: '2026-11-19',
          createdAt: '2026-11-19T12:00:00.000Z',
        },
      ],
      splits: [],
    },
  ],
  page: 1,
  limit: 10,
  total: 2,
  totalPages: 1,
};

describe('FundDetailPage (/funds/[id])', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseParams.mockReturnValue({ id: FUND_ID });
    vi.mocked(fundsApi.getById).mockResolvedValue({ fund: SAMPLE_DETAIL_FUND });
    vi.mocked(ledgerApi.list).mockResolvedValue(SAMPLE_TRANSACTIONS);
  });

  it('carga detalle y últimos 10 movimientos mostrando impacto con signo y formatDate', async () => {
    render(<FundDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Cuenta Sueldo BCP')).toBeInTheDocument();
    });

    expect(fundsApi.getById).toHaveBeenCalledWith(FUND_ID);
    expect(ledgerApi.list).toHaveBeenCalledWith({ fundId: FUND_ID, limit: 10 });

    expect(screen.getByText('S/ 1,350.00')).toBeInTheDocument();
    expect(screen.getByText('+S/ 500.00')).toBeInTheDocument();
    expect(screen.getByText('-S/ 150.00')).toBeInTheDocument();
    expect(screen.getByText('Fecha: 20/11/2026')).toBeInTheDocument();
    expect(screen.getByText('Fecha: 19/11/2026')).toBeInTheDocument();

    expect(screen.getByRole('link', { name: 'Nuevo movimiento' })).toHaveAttribute(
      'href',
      `/transactions/new?fundId=${FUND_ID}`,
    );
    expect(screen.getByRole('link', { name: 'Abono quincena' })).toHaveAttribute(
      'href',
      '/transactions/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    );
  });

  it('rechaza UUID inválido sin llamar a la API y muestra enlace de regreso', async () => {
    mockUseParams.mockReturnValue({ id: 'invalid-uuid' });

    render(<FundDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('El identificador del fondo no es válido.')).toBeInTheDocument();
    });

    expect(fundsApi.getById).not.toHaveBeenCalled();
    expect(ledgerApi.list).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'Ir al listado de fondos' })).toHaveAttribute(
      'href',
      '/funds',
    );
  });

  it('maneja 404 del servidor mostrando estado controlado', async () => {
    vi.mocked(fundsApi.getById).mockRejectedValue(new ApiError(404, 'Not Found', 'Not found'));

    render(<FundDetailPage />);

    await waitFor(() => {
      expect(
        screen.getByText('El recurso solicitado no fue encontrado o ya no está disponible.'),
      ).toBeInTheDocument();
    });

    expect(screen.getByRole('link', { name: 'Ir al listado de fondos' })).toHaveAttribute(
      'href',
      '/funds',
    );
  });

  it('oculta Editar, Archivar y Nuevo movimiento cuando el fondo está archivado', async () => {
    vi.mocked(fundsApi.getById).mockResolvedValue({
      fund: { ...SAMPLE_DETAIL_FUND, isArchived: true, balance: '0.00' },
    });

    render(<FundDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Cuenta Sueldo BCP')).toBeInTheDocument();
    });

    expect(screen.getByText('Archivado')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Nuevo movimiento' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Archivar' })).not.toBeInTheDocument();
  });

  it('permite abrir el modal de edición desde detalle', async () => {
    vi.mocked(fundsApi.update).mockResolvedValue({
      fund: { ...SAMPLE_DETAIL_FUND, name: 'Cuenta Sueldo Renombrada' },
    });

    render(<FundDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Cuenta Sueldo BCP')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    fireEvent.change(screen.getByLabelText('Nombre del fondo'), {
      target: { value: 'Cuenta Sueldo Renombrada' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => {
      expect(fundsApi.update).toHaveBeenCalledWith(FUND_ID, {
        name: 'Cuenta Sueldo Renombrada',
      });
    });
  });
});

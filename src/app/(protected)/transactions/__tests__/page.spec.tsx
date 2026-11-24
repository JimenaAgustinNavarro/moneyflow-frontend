import * as React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TransactionsPage from '../page';
import { categoriesApi } from '@/lib/categories-api';
import { fundsApi } from '@/lib/funds-api';
import { ledgerApi } from '@/lib/ledger-api';
import type { CategoryView } from '@/types/categories';
import type { FundView } from '@/types/funds';
import type { ListTransactionsResponse, TransactionDetailView } from '@/types/ledger';

let mockSearchParams = new URLSearchParams();
const mockReplace = vi.fn((url: string) => {
  const queryIndex = url.indexOf('?');
  mockSearchParams = new URLSearchParams(queryIndex >= 0 ? url.slice(queryIndex + 1) : '');
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => '/transactions',
  useSearchParams: () => mockSearchParams,
}));

vi.mock('@/lib/funds-api', () => ({
  fundsApi: {
    list: vi.fn(),
  },
}));

vi.mock('@/lib/categories-api', () => ({
  categoriesApi: {
    list: vi.fn(),
  },
}));

vi.mock('@/lib/ledger-api', () => ({
  ledgerApi: {
    list: vi.fn(),
  },
}));

const FUND_ACTIVE: FundView = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Cuenta Sueldo BCP',
  type: 'BANK',
  currency: 'PEN',
  color: '#0F766E',
  icon: 'Landmark',
  allowNegativeBalance: false,
  isArchived: false,
  balance: '1500.00',
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
};

const FUND_ARCHIVED: FundView = {
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Caja Antigua',
  type: 'CASH',
  currency: 'PEN',
  color: '#334155',
  icon: 'Banknote',
  allowNegativeBalance: false,
  isArchived: true,
  balance: '0.00',
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-15T00:00:00.000Z',
};

const CATEGORY_ARCHIVED: CategoryView = {
  id: 'aaaa1111-1111-4111-8111-111111111111',
  userId: null,
  name: 'Restaurantes Históricos',
  kind: 'EXPENSE',
  color: '#EF4444',
  icon: 'utensils',
  isSystem: false,
  isArchived: true,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-15T00:00:00.000Z',
};

const CATEGORY_GROCERIES: CategoryView = {
  id: 'aaaa2222-2222-4222-8222-222222222222',
  userId: null,
  name: 'Alimentación',
  kind: 'EXPENSE',
  color: '#10B981',
  icon: 'shopping-cart',
  isSystem: true,
  isArchived: false,
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
};

const SAMPLE_ITEMS: TransactionDetailView[] = [
  {
    id: '90000001-0000-4000-8000-000000000001',
    type: 'EXPENSE',
    status: 'POSTED',
    amount: '120.00',
    currency: 'PEN',
    occurredOn: '2026-11-22',
    recordedAt: '2026-11-23T02:30:00.000Z',
    description: 'Supermercado mensual',
    notes: null,
    categoryId: null,
    relatedTransactionId: null,
    idempotencyKey: 'req-key-001',
    createdAt: '2026-11-23T02:30:00.000Z',
    updatedAt: '2026-11-23T02:30:00.000Z',
    entries: [
      {
        id: 'e0000001-0000-4000-8000-000000000001',
        fundId: FUND_ARCHIVED.id,
        signedAmount: '-120.00',
        currency: 'PEN',
        occurredOn: '2026-11-22',
        createdAt: '2026-11-23T02:30:00.000Z',
      },
    ],
    splits: [
      {
        id: 's1',
        categoryId: CATEGORY_GROCERIES.id,
        amount: '80.00',
        note: 'Alimentos',
        createdAt: '2026-11-23T02:30:00.000Z',
      },
      {
        id: 's2',
        categoryId: CATEGORY_ARCHIVED.id,
        amount: '40.00',
        note: 'Limpieza',
        createdAt: '2026-11-23T02:30:00.000Z',
      },
    ],
  },
  {
    id: '90000002-0000-4000-8000-000000000002',
    type: 'INCOME',
    status: 'VOIDED',
    amount: '500.00',
    currency: 'PEN',
    occurredOn: '2026-11-21',
    recordedAt: '2026-11-21T15:00:00.000Z',
    description: 'Bono duplicado',
    notes: null,
    categoryId: null,
    relatedTransactionId: null,
    idempotencyKey: null,
    createdAt: '2026-11-21T15:00:00.000Z',
    updatedAt: '2026-11-21T16:00:00.000Z',
    entries: [
      {
        id: 'e0000002-0000-4000-8000-000000000002',
        fundId: FUND_ACTIVE.id,
        signedAmount: '500.00',
        currency: 'PEN',
        occurredOn: '2026-11-21',
        createdAt: '2026-11-21T15:00:00.000Z',
      },
    ],
    splits: [],
  },
  {
    id: '90000003-0000-4000-8000-000000000003',
    type: 'ADJUSTMENT',
    status: 'POSTED',
    amount: '15.00',
    currency: 'PEN',
    occurredOn: '2026-11-20',
    recordedAt: '2026-11-20T14:00:00.000Z',
    description: 'Cuadre de caja',
    notes: null,
    categoryId: null,
    relatedTransactionId: null,
    idempotencyKey: null,
    createdAt: '2026-11-20T14:00:00.000Z',
    updatedAt: '2026-11-20T14:00:00.000Z',
    entries: [
      {
        id: 'e0000003-0000-4000-8000-000000000003',
        fundId: FUND_ACTIVE.id,
        signedAmount: '-15.00',
        currency: 'PEN',
        occurredOn: '2026-11-20',
        createdAt: '2026-11-20T14:00:00.000Z',
      },
    ],
    splits: [],
  },
];

describe('TransactionsPage (/transactions)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams();

    vi.mocked(fundsApi.list).mockResolvedValue({
      funds: [FUND_ACTIVE, FUND_ARCHIVED],
      totalsByCurrency: [{ currency: 'PEN', totalBalance: '1500.00', fundCount: 1 }],
    });
    vi.mocked(categoriesApi.list).mockResolvedValue({
      categories: [CATEGORY_GROCERIES, CATEGORY_ARCHIVED],
    });
    vi.mocked(ledgerApi.list).mockResolvedValue({
      items: SAMPLE_ITEMS,
      page: 1,
      limit: 20,
      total: 3,
      totalPages: 1,
    });
  });

  it('carga catálogos con archivados, resuelve nombres sin UUIDs crudos, muestra splits, fechas y signos consistentes', async () => {
    render(<TransactionsPage />);

    await waitFor(() => {
      expect(screen.getByText('Supermercado mensual')).toBeInTheDocument();
    });

    expect(fundsApi.list).toHaveBeenCalledWith({ includeArchived: true });
    expect(categoriesApi.list).toHaveBeenCalledWith({ includeArchived: true });
    expect(ledgerApi.list).toHaveBeenCalledWith({ page: 1, limit: 20 });

    // Resuelve fondo archivado por nombre legible
    expect(screen.getByText('Caja Antigua (Archivado)')).toBeInTheDocument();
    expect(screen.queryByText(FUND_ARCHIVED.id)).not.toBeInTheDocument();

    // Splits indicator y fecha formatDate
    expect(screen.getByText('Dividido (2)')).toBeInTheDocument();
    expect(screen.getByText('22/11/2026')).toBeInTheDocument();

    // Signos visuales consistentes
    expect(screen.getByText('-S/ 120.00')).toHaveClass('text-destructive');
    expect(screen.getByText('+S/ 500.00')).toHaveClass('line-through');
    expect(screen.getByText('-S/ 15.00')).toHaveClass('text-destructive');

    // Enlaces CTA y detalle
    expect(screen.getByRole('link', { name: /registrar movimiento/i })).toHaveAttribute(
      'href',
      '/transactions/new',
    );
    expect(
      screen.getByRole('link', { name: 'Ver detalle de Supermercado mensual' }),
    ).toHaveAttribute('href', `/transactions/${SAMPLE_ITEMS[0].id}`);
  });

  it('sanitiza searchParams malformados en URL antes de consultar la API', async () => {
    mockSearchParams = new URLSearchParams(
      'page=abc&limit=999&type=INVALID&status=BAD&currency=EUR&fundId=not-uuid',
    );

    render(<TransactionsPage />);

    await waitFor(() => {
      expect(ledgerApi.list).toHaveBeenCalledWith({
        page: 1,
        limit: 100,
      });
    });
  });

  it('bloquea fechas inválidas (2026-02-31) y rango fromDate > toDate sin llamar al backend ni colgar skeleton', async () => {
    // 1) Fecha gregoriana inválida recibida en URL (?fromDate=2026-02-31)
    mockSearchParams = new URLSearchParams('fromDate=2026-02-31');
    const { unmount } = render(<TransactionsPage />);

    expect(await screen.findByTestId('transactions-date-range-error')).toHaveTextContent(
      /fecha calendario válida/i,
    );
    expect(screen.queryByTestId('transactions-loading')).not.toBeInTheDocument();
    expect(ledgerApi.list).not.toHaveBeenCalled();
    unmount();

    // 2) Rango invertido desde los controles de fecha (fromDate > toDate)
    mockSearchParams = new URLSearchParams();
    render(<TransactionsPage />);

    await waitFor(() => {
      expect(ledgerApi.list).toHaveBeenCalledTimes(1);
    });

    const fromInput = screen.getByLabelText(/^desde$/i);
    const toInput = screen.getByLabelText(/^hasta$/i);

    fireEvent.change(fromInput, { target: { value: '2026-11-25' } });
    await waitFor(() => {
      expect(ledgerApi.list).toHaveBeenCalledTimes(2);
    });
    expect(ledgerApi.list).toHaveBeenLastCalledWith({
      page: 1,
      limit: 20,
      fromDate: '2026-11-25',
    });

    fireEvent.change(toInput, { target: { value: '2026-11-20' } });
    expect(await screen.findByTestId('transactions-date-range-error')).toHaveTextContent(
      /no puede ser posterior/i,
    );
    expect(screen.queryByTestId('transactions-loading')).not.toBeInTheDocument();
    expect(ledgerApi.list).toHaveBeenCalledTimes(2);
  });

  it('aplica debounce en search y cancela el timer al hacer clic en Limpiar filtros', async () => {
    vi.useFakeTimers();

    render(<TransactionsPage />);

    await act(async () => {
      await Promise.resolve();
    });

    const searchInput = screen.getByLabelText(/buscar por descripción o notas/i);
    fireEvent.change(searchInput, { target: { value: 'super' } });

    expect(mockReplace).not.toHaveBeenCalled();

    // Limpiar filtros antes de que venza el debounce debe cancelar el timer pendiente
    fireEvent.click(screen.getByRole('button', { name: /limpiar filtros/i }));
    expect(mockReplace).toHaveBeenCalledWith('/transactions', { scroll: false });

    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    // No debe haberse disparado una navegación tardía con ?search=super
    expect(mockReplace).toHaveBeenCalledTimes(1);

    // Ahora probamos debounce completado normalmente
    fireEvent.change(searchInput, { target: { value: 'alquiler' } });
    await act(async () => {
      vi.advanceTimersByTime(350);
    });
    expect(mockReplace).toHaveBeenLastCalledWith('/transactions?search=alquiler', {
      scroll: false,
    });

    vi.useRealTimers();
  });

  it('maneja paginación (incluyendo total=0) y descarta respuestas obsoletas (anti-race)', async () => {
    let resolveFirst!: (val: ListTransactionsResponse) => void;
    let resolveSecond!: (val: ListTransactionsResponse) => void;

    vi.mocked(ledgerApi.list)
      .mockImplementationOnce(
        () =>
          new Promise<ListTransactionsResponse>((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise<ListTransactionsResponse>((resolve) => {
            resolveSecond = resolve;
          }),
      );

    const { rerender } = render(<TransactionsPage />);

    // Cambiamos filtro antes de que responda la primera petición
    mockSearchParams = new URLSearchParams('type=INCOME');
    rerender(<TransactionsPage />);

    await act(async () => {
      resolveSecond({
        items: [SAMPLE_ITEMS[1]],
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      });
    });

    await waitFor(() => {
      expect(screen.getByText('Bono duplicado')).toBeInTheDocument();
    });

    // Respuesta tardía de la primera petición no debe sobrescribir la lista actual
    await act(async () => {
      resolveFirst({
        items: [SAMPLE_ITEMS[0]],
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      });
    });

    expect(screen.queryByText('Supermercado mensual')).not.toBeInTheDocument();
    expect(screen.getByText('Bono duplicado')).toBeInTheDocument();
  });
});

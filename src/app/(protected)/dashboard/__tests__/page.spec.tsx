import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ApiError } from '@/lib/api-client';
import { fundsApi } from '@/lib/funds-api';
import { ledgerApi } from '@/lib/ledger-api';
import type { FundView, ListFundsResponse } from '@/types/funds';
import type {
  ListTransactionsResponse,
  MonthlySummaryResponse,
  TransactionDetailView,
} from '@/types/ledger';
import DashboardPage from '../page';

vi.mock('@/lib/funds-api', () => ({
  fundsApi: {
    list: vi.fn(),
  },
}));

vi.mock('@/lib/ledger-api', () => ({
  ledgerApi: {
    getMonthlySummary: vi.fn(),
    list: vi.fn(),
  },
}));

const FUND_PEN: FundView = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Cuenta Sueldo BCP',
  type: 'BANK',
  currency: 'PEN',
  color: '#0F766E',
  icon: 'Landmark',
  allowNegativeBalance: false,
  isArchived: false,
  balance: '2400.00',
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
};

const FUND_USD: FundView = {
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Ahorros USD',
  type: 'SAVINGS',
  currency: 'USD',
  color: '#1D4ED8',
  icon: 'PiggyBank',
  allowNegativeBalance: false,
  isArchived: false,
  balance: '950.00',
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
};

const FUNDS_MULTI_RESPONSE: ListFundsResponse = {
  funds: [FUND_PEN, FUND_USD],
  totalsByCurrency: [
    { currency: 'USD', totalBalance: '950.00', fundCount: 1 },
    { currency: 'PEN', totalBalance: '2400.00', fundCount: 1 },
  ],
};

const SUMMARY_MULTI_RESPONSE: MonthlySummaryResponse = {
  month: '2026-11',
  fromDate: '2026-11-01',
  toDate: '2026-11-30',
  fundId: null,
  currencies: [
    {
      currency: 'PEN',
      totalIncome: '3500.00',
      totalExpenseGross: '200.00',
      totalRefunds: '50.00',
      totalExpenseNet: '150.00',
      netCashFlow: '3350.00',
      transactionCount: 4,
      byCategory: [
        {
          categoryId: 'cat-food',
          categoryName: 'Alimentación',
          kind: 'EXPENSE',
          color: '#10B981',
          icon: 'shopping-cart',
          totalAmount: '120.00',
          transactionCount: 2,
        },
        {
          categoryId: 'cat-transport',
          categoryName: 'Transporte',
          kind: 'EXPENSE',
          color: '#3B82F6',
          icon: 'car',
          totalAmount: '80.00',
          transactionCount: 1,
        },
        {
          categoryId: 'cat-salary',
          categoryName: 'Sueldo',
          kind: 'INCOME',
          color: '#0F766E',
          icon: 'briefcase',
          totalAmount: '3500.00',
          transactionCount: 1,
        },
      ],
    },
    {
      currency: 'USD',
      totalIncome: '400.00',
      totalExpenseGross: '100.00',
      totalRefunds: '0.00',
      totalExpenseNet: '100.00',
      netCashFlow: '300.00',
      transactionCount: 2,
      byCategory: [
        {
          categoryId: 'cat-subs',
          categoryName: 'Suscripciones',
          kind: 'EXPENSE',
          color: '#6366F1',
          icon: 'credit-card',
          totalAmount: '100.00',
          transactionCount: 1,
        },
      ],
    },
  ],
};

const RECENT_TRANSACTIONS: TransactionDetailView[] = [
  {
    id: 'tx-1',
    type: 'EXPENSE',
    status: 'POSTED',
    amount: '120.00',
    currency: 'PEN',
    occurredOn: '2026-11-24',
    recordedAt: '2026-11-24T15:00:00.000Z',
    description: 'Supermercado Wong',
    notes: null,
    categoryId: 'cat-food',
    relatedTransactionId: null,
    idempotencyKey: 'key-1',
    createdAt: '2026-11-24T15:00:00.000Z',
    updatedAt: '2026-11-24T15:00:00.000Z',
    entries: [
      {
        id: 'e-1',
        fundId: FUND_PEN.id,
        signedAmount: '-120.00',
        currency: 'PEN',
        occurredOn: '2026-11-24',
        createdAt: '2026-11-24T15:00:00.000Z',
      },
    ],
    splits: [],
  },
  {
    id: 'tx-transfer',
    type: 'TRANSFER',
    status: 'POSTED',
    amount: '150.00',
    currency: 'USD',
    occurredOn: '2026-11-23',
    recordedAt: '2026-11-23T15:00:00.000Z',
    description: 'Pase a Ahorros USD',
    notes: null,
    categoryId: null,
    relatedTransactionId: null,
    idempotencyKey: 'key-2',
    createdAt: '2026-11-23T15:00:00.000Z',
    updatedAt: '2026-11-23T15:00:00.000Z',
    entries: [
      {
        id: 'e-2',
        fundId: '33333333-3333-4333-8333-333333333333',
        signedAmount: '-150.00',
        currency: 'USD',
        occurredOn: '2026-11-23',
        createdAt: '2026-11-23T15:00:00.000Z',
      },
      {
        id: 'e-3',
        fundId: FUND_USD.id,
        signedAmount: '150.00',
        currency: 'USD',
        occurredOn: '2026-11-23',
        createdAt: '2026-11-23T15:00:00.000Z',
      },
    ],
    splits: [],
  },
];

const LIST_TRANSACTIONS_RESPONSE: ListTransactionsResponse = {
  items: RECENT_TRANSACTIONS,
  page: 1,
  limit: 5,
  total: 2,
  totalPages: 1,
};

describe('DashboardPage (/dashboard)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-11-24T17:00:00.000Z'));

    vi.mocked(fundsApi.list).mockResolvedValue(FUNDS_MULTI_RESPONSE);
    vi.mocked(ledgerApi.getMonthlySummary).mockResolvedValue(SUMMARY_MULTI_RESPONSE);
    vi.mocked(ledgerApi.list).mockResolvedValue(LIST_TRANSACTIONS_RESPONSE);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('inicializa en el mes correcto de America/Lima durante ventana nocturna UTC (2026-12-01T02:30:00Z -> 2026-11)', async () => {
    vi.setSystemTime(new Date('2026-12-01T02:30:00.000Z'));

    render(<DashboardPage />);

    await waitFor(() => {
      expect(ledgerApi.getMonthlySummary).toHaveBeenCalledWith({
        month: '2026-11',
        fundId: undefined,
      });
    });

    expect(screen.getByText('Noviembre 2026')).toBeInTheDocument();
    expect(screen.queryByText('Diciembre 2026')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Seleccionar mes')).toHaveValue('2026-11');
  });

  it('muestra KPIs en PEN/USD separados, reembolsos y porcentaje de barras calculado sobre totalExpenseGross', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getAllByText('S/ 2,400.00').length).toBeGreaterThanOrEqual(1);
    });

    // KPIs en PEN: patrimonio 2400.00, ingresos 3500.00, gastos netos 150.00, flujo neto 3350.00
    expect(screen.getByText('S/ 3,500.00')).toBeInTheDocument();
    expect(screen.getByText('S/ 150.00')).toBeInTheDocument();
    expect(screen.getByText('S/ 3,350.00')).toBeInTheDocument();
    expect(screen.getByText(/Bruto: S\/ 200\.00 · Reembolsos: S\/ 50\.00/)).toBeInTheDocument();

    // Desglose por categoría usa totalExpenseGross (200.00) como denominador:
    // Alimentación 120.00 / 200.00 = 60% (no 80% sobre neto 150.00)
    // Transporte 80.00 / 200.00 = 40%
    expect(screen.getByText('60%')).toBeInTheDocument();
    expect(screen.getByText('40%')).toBeInTheDocument();
    expect(
      screen.getByText(/El desglose por categoría refleja gastos brutos confirmados \(POSTED\)/),
    ).toBeInTheDocument();

    // Cambiar a tab USD actualiza KPIs y categorías sin mezclar monedas
    fireEvent.click(screen.getByRole('tab', { name: 'Dólares (USD)' }));

    await waitFor(() => {
      expect(screen.getAllByText('$ 950.00').length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getByText('$ 400.00')).toBeInTheDocument();
    expect(screen.getAllByText('$ 100.00').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('$ 300.00')).toBeInTheDocument();
    expect(screen.getByText('Suscripciones')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('soporta navegación de mes, input type="month" con guarda y botón Mes actual', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Noviembre 2026')).toBeInTheDocument();
    });

    // Navegar al mes anterior
    fireEvent.click(screen.getByRole('button', { name: 'Mes anterior' }));

    await waitFor(() => {
      expect(ledgerApi.getMonthlySummary).toHaveBeenLastCalledWith({
        month: '2026-10',
        fundId: undefined,
      });
    });
    expect(screen.getByText('Octubre 2026')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mes actual' })).toBeInTheDocument();

    // Input month con valor vacío es ignorado por la guarda
    const monthInput = screen.getByLabelText('Seleccionar mes');
    fireEvent.change(monthInput, { target: { value: '' } });
    expect(screen.getByText('Octubre 2026')).toBeInTheDocument();

    // Input month válido actualiza el mes
    fireEvent.change(monthInput, { target: { value: '2026-08' } });
    await waitFor(() => {
      expect(ledgerApi.getMonthlySummary).toHaveBeenLastCalledWith({
        month: '2026-08',
        fundId: undefined,
      });
    });

    // Botón Mes actual regresa a 2026-11
    fireEvent.click(screen.getByRole('button', { name: 'Mes actual' }));
    await waitFor(() => {
      expect(ledgerApi.getMonthlySummary).toHaveBeenLastCalledWith({
        month: '2026-11',
        fundId: undefined,
      });
    });
  });

  it('filtra por fondo USD, fija moneda a USD y muestra signo de TRANSFER desde entries del fondo', async () => {
    vi.mocked(ledgerApi.getMonthlySummary).mockImplementation(async (params) => {
      if (params?.fundId === FUND_USD.id) {
        return {
          ...SUMMARY_MULTI_RESPONSE,
          fundId: FUND_USD.id,
          currencies: [SUMMARY_MULTI_RESPONSE.currencies[1]],
        };
      }
      return SUMMARY_MULTI_RESPONSE;
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Pase a Ahorros USD')).toBeInTheDocument();
    });

    // En "Todos los fondos", TRANSFER es neutro ($ 150.00 sin + ni -)
    const transferRowAll = screen.getByText('Pase a Ahorros USD').closest('li') as HTMLElement;
    expect(within(transferRowAll).getByText('$ 150.00')).toBeInTheDocument();

    // Filtrar por fondo USD
    fireEvent.change(screen.getByLabelText('Filtrar por fondo'), {
      target: { value: FUND_USD.id },
    });

    await waitFor(() => {
      expect(ledgerApi.getMonthlySummary).toHaveBeenLastCalledWith({
        month: '2026-11',
        fundId: FUND_USD.id,
      });
      expect(ledgerApi.list).toHaveBeenLastCalledWith({
        limit: 5,
        fundId: FUND_USD.id,
      });
    });

    expect(screen.getByText(/Filtrado por: Ahorros USD \(USD\)/)).toBeInTheDocument();
    expect(screen.getByLabelText('Moneda activa')).toHaveTextContent('Dólares (USD)');

    // En fondo USD filtrado, TRANSFER muestra +$ 150.00 por entry positiva en ese fondo
    const transferRowFiltered = screen.getByText('Pase a Ahorros USD').closest('li') as HTMLElement;
    expect(within(transferRowFiltered).getByText('+$ 150.00')).toBeInTheDocument();
  });

  it('maneja mes vacío (currencies: []) y usuario sin fondos sin NaN ni errores', async () => {
    vi.mocked(fundsApi.list).mockResolvedValue({
      funds: [],
      totalsByCurrency: [],
    });
    vi.mocked(ledgerApi.getMonthlySummary).mockResolvedValue({
      month: '2026-11',
      fromDate: '2026-11-01',
      toDate: '2026-11-30',
      fundId: null,
      currencies: [],
    });
    vi.mocked(ledgerApi.list).mockResolvedValue({
      items: [],
      page: 1,
      limit: 5,
      total: 0,
      totalPages: 0,
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Aún no tienes fondos activos registrados')).toBeInTheDocument();
    });

    expect(screen.getByRole('link', { name: /Ir a Fondos/ })).toHaveAttribute('href', '/funds');
    expect(screen.getAllByText('S/ 0.00').length).toBe(4);
    expect(screen.getByText(/Sin movimientos registrados en Noviembre 2026/)).toBeInTheDocument();
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
  });

  it('descarta respuestas tardías obsoletas (anti-race) y permite reintentar ante error', async () => {
    let resolveSlowNov!: (value: MonthlySummaryResponse) => void;
    const slowNovPromise = new Promise<MonthlySummaryResponse>((resolve) => {
      resolveSlowNov = resolve;
    });

    vi.mocked(ledgerApi.getMonthlySummary).mockImplementation(async (params) => {
      if (params?.month === '2026-11') {
        return slowNovPromise;
      }
      if (params?.month === '2026-10') {
        return {
          ...SUMMARY_MULTI_RESPONSE,
          month: '2026-10',
          currencies: [
            {
              ...SUMMARY_MULTI_RESPONSE.currencies[0],
              totalIncome: '9999.00',
            },
          ],
        };
      }
      return SUMMARY_MULTI_RESPONSE;
    });

    render(<DashboardPage />);

    // Cambiar rápidamente a Octubre antes de que resuelva Noviembre
    fireEvent.click(screen.getByRole('button', { name: 'Mes anterior' }));

    await waitFor(() => {
      expect(screen.getByText('S/ 9,999.00')).toBeInTheDocument();
    });

    // Ahora resuelve la respuesta tardía de Noviembre -> debe descartarse
    await act(async () => {
      resolveSlowNov(SUMMARY_MULTI_RESPONSE);
    });

    expect(screen.getByText('S/ 9,999.00')).toBeInTheDocument();
    expect(screen.queryByText('S/ 3,500.00')).not.toBeInTheDocument();

    // Error y botón Reintentar
    vi.mocked(ledgerApi.getMonthlySummary).mockRejectedValueOnce(
      new ApiError(500, 'Internal Server Error', 'Error de servidor'),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Mes siguiente' }));

    await waitFor(() => {
      expect(
        screen.getByText(
          'El servicio no está disponible temporalmente. Inténtalo nuevamente en unos minutos.',
        ),
      ).toBeInTheDocument();
    });

    vi.mocked(ledgerApi.getMonthlySummary).mockResolvedValueOnce(SUMMARY_MULTI_RESPONSE);
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    await waitFor(() => {
      expect(screen.getByText('S/ 3,500.00')).toBeInTheDocument();
    });
  });
});

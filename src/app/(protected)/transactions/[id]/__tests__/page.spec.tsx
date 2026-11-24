import * as React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TransactionDetailPage from '../page';
import { ApiError } from '@/lib/api-client';
import { categoriesApi } from '@/lib/categories-api';
import * as formatters from '@/lib/formatters';
import { fundsApi } from '@/lib/funds-api';
import { ledgerApi } from '@/lib/ledger-api';
import type { CategoryView } from '@/types/categories';
import type { FundView } from '@/types/funds';
import type { TransactionDetailView } from '@/types/ledger';

const mockUseParams = vi.fn<() => { id?: string }>();

vi.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
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
    getById: vi.fn(),
    voidTransaction: vi.fn(),
    refundTransaction: vi.fn(),
  },
}));

const TX_ID = '99999999-9999-4999-8999-999999999999';
const RELATED_TX_ID = '77777777-7777-4777-8777-777777777777';
const FUND_SOURCE_ID = '11111111-1111-4111-8111-111111111111';
const FUND_DEST_ID = '22222222-2222-4222-8222-222222222222';
const CAT_ARCHIVED_ID = 'aaaa1111-1111-4111-8111-111111111111';

const FUNDS_MOCK: FundView[] = [
  {
    id: FUND_SOURCE_ID,
    name: 'Cuenta Sueldo BCP',
    type: 'BANK',
    currency: 'PEN',
    color: '#0F766E',
    icon: 'Landmark',
    allowNegativeBalance: false,
    isArchived: false,
    balance: '1000.00',
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
  },
  {
    id: FUND_DEST_ID,
    name: 'Billetera Efectivo',
    type: 'CASH',
    currency: 'PEN',
    color: '#1D4ED8',
    icon: 'Banknote',
    allowNegativeBalance: false,
    isArchived: false,
    balance: '300.00',
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
  },
];

const CATEGORIES_MOCK: CategoryView[] = [
  {
    id: CAT_ARCHIVED_ID,
    userId: null,
    name: 'Compras Especiales',
    kind: 'EXPENSE',
    color: '#EF4444',
    icon: 'shopping-bag',
    isSystem: false,
    isArchived: true,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-10T00:00:00.000Z',
  },
];

function buildExpenseDetail(overrides: Partial<TransactionDetailView> = {}): TransactionDetailView {
  return {
    id: TX_ID,
    type: 'EXPENSE',
    status: 'POSTED',
    amount: '120.00',
    currency: 'PEN',
    occurredOn: '2026-11-22',
    recordedAt: '2026-11-23T02:30:00.000Z',
    description: 'Supermercado',
    notes: 'Compra semanal',
    categoryId: null,
    relatedTransactionId: null,
    idempotencyKey: 'req-key-001',
    createdAt: '2026-11-23T02:30:00.000Z',
    updatedAt: '2026-11-23T02:30:00.000Z',
    entries: [
      {
        id: 'entry-1',
        fundId: FUND_SOURCE_ID,
        signedAmount: '-120.00',
        currency: 'PEN',
        occurredOn: '2026-11-22',
        createdAt: '2026-11-23T02:30:00.000Z',
      },
    ],
    splits: [
      {
        id: 'split-1',
        categoryId: CAT_ARCHIVED_ID,
        amount: '120.00',
        note: 'Víveres',
        createdAt: '2026-11-23T02:30:00.000Z',
      },
    ],
    ...overrides,
  };
}

describe('TransactionDetailPage (/transactions/[id])', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseParams.mockReturnValue({ id: TX_ID });
    vi.mocked(fundsApi.list).mockResolvedValue({
      funds: FUNDS_MOCK,
      totalsByCurrency: [{ currency: 'PEN', totalBalance: '1300.00', fundCount: 2 }],
    });
    vi.mocked(categoriesApi.list).mockResolvedValue({
      categories: CATEGORIES_MOCK,
    });
  });

  it('rechaza UUID inválido sin llamar a la API y maneja 404 Not Found con enlace a /transactions', async () => {
    mockUseParams.mockReturnValue({ id: 'invalid-uuid' });
    const { rerender } = render(<TransactionDetailPage />);

    await waitFor(() => {
      expect(screen.getByTestId('transaction-detail-error')).toHaveTextContent(
        /identificador del movimiento no es válido/i,
      );
    });
    expect(ledgerApi.getById).not.toHaveBeenCalled();

    mockUseParams.mockReturnValue({ id: TX_ID });
    vi.mocked(ledgerApi.getById).mockRejectedValueOnce(
      new ApiError(404, 'Not Found', 'Transaction not found'),
    );
    rerender(<TransactionDetailPage />);

    await waitFor(() => {
      expect(screen.getByTestId('transaction-detail-error')).toBeInTheDocument();
    });
    expect(
      screen.getByRole('link', { name: /ir al historial de movimientos/i }),
    ).toHaveAttribute('href', '/transactions');
  });

  it('renderiza dualidad temporal correcta en ventana nocturna 19:00-23:59 America/Lima y splits archivados', async () => {
    vi.mocked(ledgerApi.getById).mockResolvedValueOnce({
      transaction: buildExpenseDetail({
        occurredOn: '2026-11-22',
        recordedAt: '2026-11-23T02:30:00.000Z',
      }),
    });

    render(<TransactionDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Supermercado')).toBeInTheDocument();
    });

    expect(screen.getByTestId('tx-occurred-on')).toHaveTextContent('22/11/2026');
    const recordedText = screen.getByTestId('tx-recorded-at').textContent ?? '';
    expect(recordedText).toContain('22/11/2026');
    expect(recordedText).toContain('21:30:00');
    expect(recordedText).not.toContain('23/11/2026');

    expect(screen.getByTestId('transaction-splits-card')).toBeInTheDocument();
    expect(screen.getByText('Compras Especiales')).toBeInTheDocument();
    expect(screen.getByText('Archivada')).toBeInTheDocument();
  });

  it('muestra flujo origen -> destino para TRANSFER y oculta acciones según tipo/estado', async () => {
    vi.mocked(ledgerApi.getById).mockResolvedValueOnce({
      transaction: buildExpenseDetail({
        type: 'TRANSFER',
        status: 'POSTED',
        amount: '250.00',
        description: 'Traspaso a efectivo',
        splits: [],
        entries: [
          {
            id: 'e1',
            fundId: FUND_SOURCE_ID,
            signedAmount: '-250.00',
            currency: 'PEN',
            occurredOn: '2026-11-22',
            createdAt: '2026-11-22T15:00:00.000Z',
          },
          {
            id: 'e2',
            fundId: FUND_DEST_ID,
            signedAmount: '250.00',
            currency: 'PEN',
            occurredOn: '2026-11-22',
            createdAt: '2026-11-22T15:00:00.000Z',
          },
        ],
      }),
    });

    const { unmount } = render(<TransactionDetailPage />);

    await waitFor(() => {
      expect(screen.getByTestId('transfer-entries-summary')).toBeInTheDocument();
    });

    expect(screen.getByText('Fondo origen')).toBeInTheDocument();
    expect(screen.getByText('Fondo destino')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /anular movimiento/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /registrar reembolso/i })).not.toBeInTheDocument();
    unmount();

    // Caso VOID con relatedTransactionId -> ambos botones ocultos
    vi.mocked(ledgerApi.getById).mockResolvedValueOnce({
      transaction: buildExpenseDetail({
        type: 'VOID',
        status: 'POSTED',
        relatedTransactionId: RELATED_TX_ID,
        splits: [],
      }),
    });
    render(<TransactionDetailPage />);

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /ver movimiento original/i })).toHaveAttribute(
        'href',
        `/transactions/${RELATED_TX_ID}`,
      );
    });
    expect(screen.queryByRole('button', { name: /anular movimiento/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /registrar reembolso/i })).not.toBeInTheDocument();
  });

  it('ejecuta flujo completo VOID: idempotencia, 409 sin perder datos, confirmación 201 sin desmontar modal y recarga silenciosa a VOIDED', async () => {
    const todaySpy = vi.spyOn(formatters, 'getTodayLimaDateString').mockReturnValue('2026-11-24');

    vi.mocked(ledgerApi.getById)
      .mockResolvedValueOnce({ transaction: buildExpenseDetail() })
      .mockResolvedValueOnce({
        transaction: buildExpenseDetail({ status: 'VOIDED' }),
      });

    vi.mocked(ledgerApi.voidTransaction)
      .mockRejectedValueOnce(new ApiError(0, 'NetworkError', 'Failed to fetch'))
      .mockRejectedValueOnce(
        new ApiError(409, 'Conflict', 'Cannot void transaction affecting an archived fund'),
      )
      .mockResolvedValueOnce({
        voidTransaction: {
          ...buildExpenseDetail(),
          id: 'vvvv1111-1111-4111-8111-111111111111',
          type: 'VOID',
          status: 'POSTED',
          description: 'Anulación: Supermercado',
          relatedTransactionId: TX_ID,
          splits: [],
        },
        originalTransactionId: TX_ID,
        originalStatus: 'VOIDED',
        affectedFundBalances: [{ fundId: FUND_SOURCE_ID, balanceAfter: '1120.00' }],
      });

    render(<TransactionDetailPage />);
    await screen.findByText('Supermercado');

    fireEvent.click(screen.getByRole('button', { name: /anular movimiento/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Fecha anterior al original -> error inline sin llamar API
    const dateInput = screen.getByLabelText(/fecha de anulación/i) as HTMLInputElement;
    expect(dateInput.value).toBe('2026-11-24');
    fireEvent.change(dateInput, { target: { value: '2026-11-21' } });
    fireEvent.click(screen.getByRole('button', { name: /confirmar anulación/i }));

    expect(
      await screen.findByText(/no puede ser anterior a la fecha del movimiento original/i),
    ).toBeInTheDocument();
    expect(ledgerApi.voidTransaction).not.toHaveBeenCalled();

    // Fecha válida y motivo vacío -> omite reason
    fireEvent.change(dateInput, { target: { value: '2026-11-24' } });
    fireEvent.click(screen.getByRole('button', { name: /confirmar anulación/i }));

    await waitFor(() => {
      expect(ledgerApi.voidTransaction).toHaveBeenCalledTimes(1);
    });
    const [voidId1, voidPayload1, voidOpts1] = vi.mocked(ledgerApi.voidTransaction).mock.calls[0];
    expect(voidId1).toBe(TX_ID);
    expect(voidPayload1).toEqual({ occurredOn: '2026-11-24' });
    expect(voidPayload1 ? 'reason' in voidPayload1 : false).toBe(false);
    expect(voidOpts1?.idempotencyKey).toBeDefined();

    // Reintento idéntico tras fallo de red -> misma Idempotency-Key y luego 409 conservando formulario
    fireEvent.click(screen.getByRole('button', { name: /confirmar anulación/i }));
    await waitFor(() => {
      expect(ledgerApi.voidTransaction).toHaveBeenCalledTimes(2);
    });
    expect(vi.mocked(ledgerApi.voidTransaction).mock.calls[1][2]?.idempotencyKey).toBe(
      voidOpts1?.idempotencyKey,
    );
    expect(await screen.findByTestId('void-submit-error')).toHaveTextContent(/archived fund/i);

    // Edita motivo -> nueva Idempotency-Key y éxito 201 sin desmontar el diálogo
    fireEvent.change(screen.getByLabelText(/motivo/i), { target: { value: 'Error de cobro' } });
    fireEvent.click(screen.getByRole('button', { name: /confirmar anulación/i }));

    await waitFor(() => {
      expect(ledgerApi.voidTransaction).toHaveBeenCalledTimes(3);
    });
    expect(vi.mocked(ledgerApi.voidTransaction).mock.calls[2][2]?.idempotencyKey).not.toBe(
      voidOpts1?.idempotencyKey,
    );

    // El modal sigue montado mostrando la confirmación mientras el detalle ya recargó en silencio
    expect(await screen.findByTestId('void-confirmation-panel')).toBeInTheDocument();
    expect(screen.getByText('S/ 1,120.00')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^cerrar$/i }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Anulada')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /anular movimiento/i })).not.toBeInTheDocument();

    todaySpy.mockRestore();
  });

  it('ejecuta flujo completo REFUND: valida monto <= original, 409 sin perder formulario y muestra resumen 201', async () => {
    const todaySpy = vi.spyOn(formatters, 'getTodayLimaDateString').mockReturnValue('2026-11-24');

    vi.mocked(ledgerApi.getById).mockResolvedValue({ transaction: buildExpenseDetail() });
    vi.mocked(ledgerApi.refundTransaction)
      .mockRejectedValueOnce(
        new ApiError(409, 'Conflict', 'Refund amount exceeds remaining refundable amount'),
      )
      .mockResolvedValueOnce({
        refundTransaction: {
          ...buildExpenseDetail(),
          id: 'rrrr1111-1111-4111-8111-111111111111',
          type: 'REFUND',
          status: 'POSTED',
          amount: '60.00',
          description: 'Reembolso: Supermercado',
          relatedTransactionId: TX_ID,
          splits: [],
        },
        originalTransactionId: TX_ID,
        totalRefundedAfter: '60.00',
        remainingRefundableAmount: '60.00',
        fundBalanceAfter: '1060.00',
      });

    render(<TransactionDetailPage />);
    await screen.findByText('Supermercado');

    fireEvent.click(screen.getByRole('button', { name: /registrar reembolso/i }));
    const amountInput = screen.getByLabelText(/monto a reembolsar/i) as HTMLInputElement;

    // Monto superior al gasto original -> bloqueado por Zod
    fireEvent.change(amountInput, { target: { value: '120.01' } });
    fireEvent.click(screen.getByRole('button', { name: /confirmar reembolso/i }));
    expect(
      await screen.findByText(/no puede superar el monto del gasto original/i),
    ).toBeInTheDocument();
    expect(ledgerApi.refundTransaction).not.toHaveBeenCalled();

    // 409 Conflict conserva el valor escrito
    fireEvent.change(amountInput, { target: { value: '100.00' } });
    fireEvent.click(screen.getByRole('button', { name: /confirmar reembolso/i }));
    expect(await screen.findByTestId('refund-submit-error')).toHaveTextContent(
      /exceeds remaining refundable amount/i,
    );
    expect(amountInput.value).toBe('100.00');

    // Corrige a 60.00 -> éxito 201 mostrando totalRefundedAfter, remainingRefundableAmount y fundBalanceAfter
    fireEvent.change(amountInput, { target: { value: '60.00' } });
    fireEvent.click(screen.getByRole('button', { name: /confirmar reembolso/i }));

    expect(await screen.findByTestId('refund-confirmation-panel')).toBeInTheDocument();
    expect(screen.getByTestId('refund-total-after')).toHaveTextContent('S/ 60.00');
    expect(screen.getByTestId('refund-remaining-amount')).toHaveTextContent('S/ 60.00');
    expect(screen.getByTestId('refund-fund-balance-after')).toHaveTextContent('S/ 1,060.00');

    todaySpy.mockRestore();
  });
});

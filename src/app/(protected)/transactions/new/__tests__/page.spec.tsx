import * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import NewTransactionPage from '../page';
import { ApiError } from '@/lib/api-client';
import { categoriesApi } from '@/lib/categories-api';
import * as formatters from '@/lib/formatters';
import { fundsApi } from '@/lib/funds-api';
import { ledgerApi } from '@/lib/ledger-api';
import type { CategoryView } from '@/types/categories';
import type { FundView } from '@/types/funds';
import type { TransactionDetailView } from '@/types/ledger';

let mockSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
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
    recordTransaction: vi.fn(),
    recordTransfer: vi.fn(),
    recordAdjustment: vi.fn(),
  },
}));

const FUND_PEN_1: FundView = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Billetera Principal',
  type: 'CASH',
  currency: 'PEN',
  color: '#10B981',
  icon: 'wallet',
  allowNegativeBalance: false,
  isArchived: false,
  balance: '100.00',
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
};

const FUND_PEN_2: FundView = {
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Cuenta Sueldo BCP',
  type: 'BANK',
  currency: 'PEN',
  color: '#3B82F6',
  icon: 'landmark',
  allowNegativeBalance: true,
  isArchived: false,
  balance: '500.00',
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
};

const FUND_USD_1: FundView = {
  id: '33333333-3333-4333-8333-333333333333',
  name: 'Ahorros Dólares',
  type: 'SAVINGS',
  currency: 'USD',
  color: '#8B5CF6',
  icon: 'piggy-bank',
  allowNegativeBalance: false,
  isArchived: false,
  balance: '200.00',
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
};

const CATEGORIES_MOCK: CategoryView[] = [
  {
    id: 'aaaa1111-1111-4111-8111-111111111111',
    userId: null,
    name: 'Alimentación',
    kind: 'EXPENSE',
    color: '#EF4444',
    icon: 'utensils',
    isSystem: true,
    isArchived: false,
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
  },
  {
    id: 'aaaa2222-2222-4222-8222-222222222222',
    userId: null,
    name: 'Hogar',
    kind: 'EXPENSE',
    color: '#F59E0B',
    icon: 'home',
    isSystem: true,
    isArchived: false,
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
  },
  {
    id: 'bbbb1111-1111-4111-8111-111111111111',
    userId: null,
    name: 'Salario',
    kind: 'INCOME',
    color: '#10B981',
    icon: 'briefcase',
    isSystem: true,
    isArchived: false,
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
  },
];

function buildSampleTxDetail(overrides: Partial<TransactionDetailView> = {}): TransactionDetailView {
  return {
    id: '99999999-9999-4999-8999-999999999999',
    type: 'EXPENSE',
    status: 'POSTED',
    amount: '45.00',
    currency: 'PEN',
    occurredOn: '2026-11-22',
    recordedAt: '2026-11-23T02:30:00.000Z',
    description: 'Almuerzo',
    notes: null,
    categoryId: CATEGORIES_MOCK[0].id,
    relatedTransactionId: null,
    idempotencyKey: 'idem-key-1',
    createdAt: '2026-11-23T02:30:00.000Z',
    updatedAt: '2026-11-23T02:30:00.000Z',
    entries: [
      {
        id: '88888888-8888-4888-8888-888888888888',
        fundId: FUND_PEN_1.id,
        signedAmount: '-45.00',
        currency: 'PEN',
        occurredOn: '2026-11-22',
        createdAt: '2026-11-23T02:30:00.000Z',
      },
    ],
    splits: [],
    ...overrides,
  };
}

describe('NewTransactionPage (/transactions/new)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams();

    vi.mocked(fundsApi.list).mockResolvedValue({
      funds: [FUND_PEN_1, FUND_PEN_2, FUND_USD_1],
      totalsByCurrency: [
        { currency: 'PEN', totalBalance: '600.00', fundCount: 2 },
        { currency: 'USD', totalBalance: '200.00', fundCount: 1 },
      ],
    });

    vi.mocked(categoriesApi.list).mockResolvedValue({
      categories: CATEGORIES_MOCK,
    });
  });

  it('muestra estado guiado con CTA a /funds cuando el usuario no tiene fondos activos', async () => {
    vi.mocked(fundsApi.list).mockResolvedValueOnce({
      funds: [],
      totalsByCurrency: [],
    });

    render(<NewTransactionPage />);

    const emptyCard = await screen.findByTestId('empty-funds-guided-state');
    expect(emptyCard).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ir a fondos/i })).toHaveAttribute('href', '/funds');
  });

  it('respeta query params (?type=INCOME&fundId=...) y fija occurredOn en ventana nocturna 19:00-23:59 America/Lima', async () => {
    // Simulamos 2026-11-22 22:15:00 America/Lima (2026-11-23T03:15:00.000Z en UTC)
    const limaNightDate = formatters.getTodayLimaDateString(new Date('2026-11-23T03:15:00.000Z'));
    expect(limaNightDate).toBe('2026-11-22');

    const todaySpy = vi
      .spyOn(formatters, 'getTodayLimaDateString')
      .mockReturnValue('2026-11-22');

    mockSearchParams = new URLSearchParams(
      `type=INCOME&fundId=${FUND_PEN_2.id}`,
    );

    render(<NewTransactionPage />);

    await screen.findByRole('heading', { name: /registrar ingreso/i });

    const fundSelect = screen.getByLabelText(/^fondo$/i) as HTMLSelectElement;
    expect(fundSelect.value).toBe(FUND_PEN_2.id);

    const dateInput = screen.getByLabelText(/fecha de operación/i) as HTMLInputElement;
    expect(dateInput.value).toBe('2026-11-22');

    // Solo debe listar categorías de INCOME ("Salario"), no las de EXPENSE
    const categorySelect = screen.getByLabelText(/categoría \(ingresos\)/i) as HTMLSelectElement;
    const optionTexts = Array.from(categorySelect.options).map((o) => o.text);
    expect(optionTexts).toContain('Salario');
    expect(optionTexts).not.toContain('Alimentación');

    todaySpy.mockRestore();
  });

  it('limpia categoryId y categorías de splits al cambiar entre EXPENSE e INCOME', async () => {
    render(<NewTransactionPage />);

    await screen.findByRole('heading', { name: /registrar egreso/i });

    const categorySelect = screen.getByLabelText(/categoría \(egresos\)/i) as HTMLSelectElement;
    fireEvent.change(categorySelect, { target: { value: CATEGORIES_MOCK[0].id } });
    expect(categorySelect.value).toBe(CATEGORIES_MOCK[0].id);

    // Cambiar a modo splits y elegir una categoría de egreso
    fireEvent.click(screen.getByRole('button', { name: /dividir en splits/i }));
    const splitCat0 = screen.getByLabelText(/categoría #1/i) as HTMLSelectElement;
    fireEvent.change(splitCat0, { target: { value: CATEGORIES_MOCK[0].id } });
    expect(splitCat0.value).toBe(CATEGORIES_MOCK[0].id);

    // Cambiar pestaña a Ingreso -> debe limpiar las categorías de splits y categoría única
    fireEvent.click(screen.getByRole('tab', { name: /ingreso/i }));

    await screen.findByRole('heading', { name: /registrar ingreso/i });
    const splitCat0After = screen.getByLabelText(/categoría #1/i) as HTMLSelectElement;
    expect(splitCat0After.value).toBe('');

    fireEvent.click(screen.getByRole('button', { name: /categoría única/i }));
    const singleCatAfter = screen.getByLabelText(/categoría \(ingresos\)/i) as HTMLSelectElement;
    expect(singleCatAfter.value).toBe('');
  });

  it('calcula panel en vivo de splits con BigInt, bloquea descuadre de 0.01 y envía payload XOR limpio cuando cuadra', async () => {
    vi.mocked(ledgerApi.recordTransaction).mockResolvedValueOnce({
      transaction: buildSampleTxDetail({
        amount: '100.00',
        categoryId: null,
        splits: [
          {
            id: 's1',
            categoryId: CATEGORIES_MOCK[0].id,
            amount: '33.33',
            note: 'Alimentos',
            createdAt: '2026-11-23T02:30:00.000Z',
          },
          {
            id: 's2',
            categoryId: CATEGORIES_MOCK[1].id,
            amount: '66.67',
            note: null,
            createdAt: '2026-11-23T02:30:00.000Z',
          },
        ],
      }),
      fundBalanceAfter: '0.00',
    });

    render(<NewTransactionPage />);
    await screen.findByRole('heading', { name: /registrar egreso/i });

    fireEvent.change(screen.getByLabelText(/^monto/i), { target: { value: '100.00' } });
    fireEvent.change(screen.getByLabelText(/^descripción$/i), {
      target: { value: 'Compra supermercado' },
    });

    fireEvent.click(screen.getByRole('button', { name: /dividir en splits/i }));

    fireEvent.change(screen.getByLabelText(/categoría #1/i), {
      target: { value: CATEGORIES_MOCK[0].id },
    });
    fireEvent.change(screen.getAllByLabelText(/^monto \(pen\)$/i)[1], {
      target: { value: '33.33' },
    });
    fireEvent.change(screen.getAllByLabelText(/nota opcional/i)[0], {
      target: { value: 'Alimentos' },
    });

    fireEvent.change(screen.getByLabelText(/categoría #2/i), {
      target: { value: CATEGORIES_MOCK[1].id },
    });
    fireEvent.change(screen.getAllByLabelText(/^monto \(pen\)$/i)[2], {
      target: { value: '66.66' },
    });

    // Descuadre de 0.01 ("100.00" vs "99.99")
    expect(screen.getByTestId('splits-total-operation')).toHaveTextContent('S/ 100.00');
    expect(screen.getByTestId('splits-sum-amount')).toHaveTextContent('S/ 99.99');
    expect(screen.getByTestId('splits-remaining-diff')).toHaveTextContent('S/ 0.01');

    const submitBtn = screen.getByRole('button', { name: /guardar egreso/i });
    expect(submitBtn).toBeDisabled();

    // Corregimos segunda fila a 66.67 para cuadrar a 0.00
    fireEvent.change(screen.getAllByLabelText(/^monto \(pen\)$/i)[2], {
      target: { value: '66.67' },
    });

    expect(screen.getByTestId('splits-sum-amount')).toHaveTextContent('S/ 100.00');
    expect(screen.getByTestId('splits-remaining-diff')).toHaveTextContent('S/ 0.00');
    expect(submitBtn).not.toBeDisabled();

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(ledgerApi.recordTransaction).toHaveBeenCalledTimes(1);
    });

    const [sentPayload, sentOptions] = vi.mocked(ledgerApi.recordTransaction).mock.calls[0];
    expect(sentPayload).toEqual({
      type: 'EXPENSE',
      fundId: FUND_PEN_1.id,
      amount: '100.00',
      occurredOn: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      description: 'Compra supermercado',
      splits: [
        {
          categoryId: CATEGORIES_MOCK[0].id,
          amount: '33.33',
          note: 'Alimentos',
        },
        {
          categoryId: CATEGORIES_MOCK[1].id,
          amount: '66.67',
        },
      ],
    });
    expect('categoryId' in sentPayload).toBe(false);
    expect(sentOptions?.idempotencyKey).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );

    expect(await screen.findByTestId('transaction-success-card')).toBeInTheDocument();
    expect(screen.getByTestId('confirmed-fund-balance-after')).toHaveTextContent('S/ 0.00');
    expect(screen.getByRole('link', { name: /ver fondo/i })).toHaveAttribute(
      'href',
      `/funds/${FUND_PEN_1.id}`,
    );
  });

  it('mantiene deshabilitado Guardar egreso y sin estado cuadrado cuando una fila de split está vacía aunque la otra iguale el total', async () => {
    render(<NewTransactionPage />);
    await screen.findByRole('heading', { name: /registrar egreso/i });

    fireEvent.change(screen.getByLabelText(/^monto/i), { target: { value: '100.00' } });
    fireEvent.click(screen.getByRole('button', { name: /dividir en splits/i }));

    fireEvent.change(screen.getByLabelText(/categoría #1/i), {
      target: { value: CATEGORIES_MOCK[0].id },
    });
    fireEvent.change(screen.getAllByLabelText(/^monto \(pen\)$/i)[1], {
      target: { value: '100.00' },
    });

    // Fila 2 vacía ("") -> aunque la diferencia numérica sea 0.00, no debe marcarse cuadrado ni habilitar envío
    const submitBtn = screen.getByRole('button', { name: /guardar egreso/i });
    expect(submitBtn).toBeDisabled();

    const remainingDiff = screen.getByTestId('splits-remaining-diff');
    expect(remainingDiff).toHaveClass('text-destructive');
    expect(remainingDiff).not.toHaveClass('text-income');
  });

  it('filtra destinationFundId por misma moneda en TRANSFER, muestra saldos estimados y registra transferencia', async () => {
    vi.mocked(ledgerApi.recordTransfer).mockResolvedValueOnce({
      transaction: buildSampleTxDetail({
        type: 'TRANSFER',
        amount: '120.00',
        categoryId: null,
      }),
      sourceFundBalanceAfter: '-20.00',
      destinationFundBalanceAfter: '620.00',
    });

    render(<NewTransactionPage />);
    await screen.findByRole('heading', { name: /registrar egreso/i });

    fireEvent.click(screen.getByRole('tab', { name: /transferencia/i }));
    await screen.findByRole('heading', { name: /registrar transferencia entre fondos/i });

    const destSelect = screen.getByLabelText(/fondo de destino/i) as HTMLSelectElement;
    const destOptionValues = Array.from(destSelect.options)
      .map((o) => o.value)
      .filter(Boolean);

    // Con FUND_PEN_1 como origen, solo FUND_PEN_2 (misma moneda PEN) debe aparecer en destino (excluye FUND_PEN_1 y FUND_USD_1)
    expect(destOptionValues).toEqual([FUND_PEN_2.id]);

    fireEvent.change(destSelect, { target: { value: FUND_PEN_2.id } });
    fireEvent.change(screen.getByLabelText(/^monto \(pen\)$/i), {
      target: { value: '120.00' },
    });
    fireEvent.change(screen.getByLabelText(/^descripción$/i), {
      target: { value: 'Traspaso a cuenta sueldo' },
    });

    // FUND_PEN_1 tiene 100.00 y allowNegativeBalance = false -> 100.00 - 120.00 = -20.00 -> muestra advertencia visual
    expect(screen.getByTestId('transfer-estimated-source-after')).toHaveTextContent('-S/ 20.00');
    expect(screen.getByTestId('transfer-estimated-dest-after')).toHaveTextContent('S/ 620.00');
    expect(screen.getByTestId('transfer-negative-balance-warning')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /guardar transferencia/i }));

    await waitFor(() => {
      expect(ledgerApi.recordTransfer).toHaveBeenCalledTimes(1);
    });

    expect(await screen.findByTestId('confirmed-source-balance-after')).toHaveTextContent(
      '-S/ 20.00',
    );
    expect(screen.getByTestId('confirmed-destination-balance-after')).toHaveTextContent(
      'S/ 620.00',
    );
    expect(screen.getByRole('link', { name: /ver fondo/i })).toHaveAttribute(
      'href',
      `/funds/${FUND_PEN_1.id}`,
    );
  });

  it('registra ajuste manual (ADJUSTMENT) con vista previa de saldo estimado', async () => {
    vi.mocked(ledgerApi.recordAdjustment).mockResolvedValueOnce({
      transaction: buildSampleTxDetail({
        type: 'ADJUSTMENT',
        amount: '25.50',
        categoryId: null,
      }),
      fundBalanceAfter: '74.50',
    });

    render(<NewTransactionPage />);
    await screen.findByRole('heading', { name: /registrar egreso/i });

    fireEvent.click(screen.getByRole('tab', { name: /ajuste manual/i }));
    await screen.findByRole('heading', { name: /registrar ajuste manual de saldo/i });

    fireEvent.change(screen.getByLabelText(/dirección del ajuste/i), {
      target: { value: 'DECREASE' },
    });
    fireEvent.change(screen.getByLabelText(/monto del ajuste/i), {
      target: { value: '25.50' },
    });
    fireEvent.change(screen.getByLabelText(/motivo \/ descripción/i), {
      target: { value: 'Arqueo de billetera' },
    });

    expect(screen.getByTestId('adj-estimated-balance-after')).toHaveTextContent('S/ 74.50');

    fireEvent.click(screen.getByRole('button', { name: /guardar ajuste/i }));

    await waitFor(() => {
      expect(ledgerApi.recordAdjustment).toHaveBeenCalledWith(
        expect.objectContaining({
          fundId: FUND_PEN_1.id,
          direction: 'DECREASE',
          amount: '25.50',
          description: 'Arqueo de billetera',
        }),
        expect.objectContaining({
          idempotencyKey: expect.any(String),
        }),
      );
    });

    expect(await screen.findByTestId('confirmed-fund-balance-after')).toHaveTextContent(
      'S/ 74.50',
    );
  });

  it('reutiliza la misma Idempotency-Key en reintento idéntico tras fallo de red y rota la clave si el usuario edita un campo o recibe 409 Conflict', async () => {
    vi.mocked(ledgerApi.recordTransaction)
      .mockRejectedValueOnce(new ApiError(0, 'NetworkError', 'Failed to fetch'))
      .mockRejectedValueOnce(new ApiError(409, 'Conflict', 'Insufficient balance in fund'))
      .mockResolvedValueOnce({
        transaction: buildSampleTxDetail({ amount: '40.00' }),
        fundBalanceAfter: '60.00',
      });

    render(<NewTransactionPage />);
    await screen.findByRole('heading', { name: /registrar egreso/i });

    fireEvent.change(screen.getByLabelText(/^monto/i), { target: { value: '150.00' } });
    fireEvent.change(screen.getByLabelText(/^descripción$/i), {
      target: { value: 'Pago servicio' },
    });
    fireEvent.change(screen.getByLabelText(/categoría \(egresos\)/i), {
      target: { value: CATEGORIES_MOCK[0].id },
    });

    const submitBtn = screen.getByRole('button', { name: /guardar egreso/i });

    // 1) Primer envío -> falla por red (statusCode 0)
    fireEvent.click(submitBtn);
    await screen.findByTestId('ledger-submit-error');
    expect(screen.getByTestId('ledger-submit-error')).toHaveTextContent(
      /no se pudo conectar con el servidor/i,
    );

    const firstKey = vi.mocked(ledgerApi.recordTransaction).mock.calls[0][1]?.idempotencyKey;
    expect(firstKey).toBeDefined();

    // 2) Reintento SIN cambiar ningún campo -> DEBE reutilizar exactamente la misma Idempotency-Key
    fireEvent.click(submitBtn);
    await waitFor(() => {
      expect(ledgerApi.recordTransaction).toHaveBeenCalledTimes(2);
    });
    const secondKey = vi.mocked(ledgerApi.recordTransaction).mock.calls[1][1]?.idempotencyKey;
    expect(secondKey).toBe(firstKey);
    expect(screen.getByTestId('ledger-submit-error')).toHaveTextContent(
      /insufficient balance in fund/i,
    );

    // 3) El usuario corrige el monto a 40.00 -> DEBE rotar a una nueva Idempotency-Key
    fireEvent.change(screen.getByLabelText(/^monto/i), { target: { value: '40.00' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(ledgerApi.recordTransaction).toHaveBeenCalledTimes(3);
    });
    const thirdKey = vi.mocked(ledgerApi.recordTransaction).mock.calls[2][1]?.idempotencyKey;
    expect(thirdKey).toBeDefined();
    expect(thirdKey).not.toBe(firstKey);

    expect(await screen.findByTestId('transaction-success-card')).toBeInTheDocument();
  });
});

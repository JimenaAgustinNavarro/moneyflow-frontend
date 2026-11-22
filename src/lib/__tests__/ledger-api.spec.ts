import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ledgerApi } from '../ledger-api';
import type {
  GetTransactionResponse,
  ListTransactionsResponse,
  MonthlySummaryResponse,
  RecordAdjustmentResponse,
  RecordTransactionResponse,
  RecordTransferResponse,
  RefundTransactionResponse,
  VoidTransactionResponse,
} from '@/types/ledger';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Created',
    json: async () => body,
  } as Response;
}

describe('ledgerApi', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3000';
  });

  const sampleTx = {
    id: '55555555-5555-4555-8555-555555555555',
    type: 'EXPENSE' as const,
    status: 'POSTED' as const,
    amount: '45.00',
    currency: 'PEN' as const,
    occurredOn: '2026-11-22',
    recordedAt: '2026-11-22T18:00:00.000Z',
    description: 'Almuerzo',
    notes: null,
    categoryId: '11111111-1111-4111-8111-111111111111',
    relatedTransactionId: null,
    idempotencyKey: 'idem-tx-1',
    createdAt: '2026-11-22T18:00:00.000Z',
    updatedAt: '2026-11-22T18:00:00.000Z',
    entries: [
      {
        id: '66666666-6666-4666-8666-666666666666',
        fundId: '44444444-4444-4444-8444-444444444444',
        signedAmount: '-45.00',
        currency: 'PEN' as const,
        occurredOn: '2026-11-22',
        createdAt: '2026-11-22T18:00:00.000Z',
      },
    ],
    splits: [],
  };

  it('envía Idempotency-Key preservando credentials, Content-Type y auto-refresh 401 single-flight', async () => {
    const responseBody: RecordTransactionResponse = {
      transaction: sampleTx,
      fundBalanceAfter: '1455.00',
    };

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ statusCode: 401, error: 'Unauthorized', message: 'Expired' }, 401))
      .mockResolvedValueOnce(jsonResponse({ message: 'Refreshed' }, 200))
      .mockResolvedValueOnce(jsonResponse(responseBody, 201));

    const result = await ledgerApi.recordTransaction(
      {
        type: 'EXPENSE',
        fundId: '44444444-4444-4444-8444-444444444444',
        amount: '45.00',
        description: 'Almuerzo',
        categoryId: '11111111-1111-4111-8111-111111111111',
      },
      { idempotencyKey: '  idem-tx-1  ' },
    );

    expect(result).toEqual(responseBody);
    expect(fetchSpy).toHaveBeenNthCalledWith(
      1,
      'http://localhost:3000/api/v1/transactions',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'idem-tx-1',
        },
      }),
    );
    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      'http://localhost:3000/api/v1/auth/refresh',
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
    expect(fetchSpy).toHaveBeenNthCalledWith(
      3,
      'http://localhost:3000/api/v1/transactions',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'idem-tx-1',
        },
      }),
    );
  });

  it('cubre recordTransfer, recordAdjustment, voidTransaction, refundTransaction, list, getMonthlySummary y getById', async () => {
    const transferRes: RecordTransferResponse = {
      transaction: { ...sampleTx, type: 'TRANSFER' },
      sourceFundBalanceAfter: '900.00',
      destinationFundBalanceAfter: '600.00',
    };
    const adjustRes: RecordAdjustmentResponse = {
      transaction: { ...sampleTx, type: 'ADJUSTMENT' },
      fundBalanceAfter: '1550.00',
    };
    const voidRes: VoidTransactionResponse = {
      voidTransaction: { ...sampleTx, type: 'VOID' },
      originalTransactionId: sampleTx.id,
      originalStatus: 'VOIDED',
      affectedFundBalances: [{ fundId: '44444444-4444-4444-8444-444444444444', balanceAfter: '1500.00' }],
    };
    const refundRes: RefundTransactionResponse = {
      refundTransaction: { ...sampleTx, type: 'REFUND' },
      originalTransactionId: sampleTx.id,
      totalRefundedAfter: '20.00',
      remainingRefundableAmount: '25.00',
      fundBalanceAfter: '1475.00',
    };
    const listRes: ListTransactionsResponse = {
      items: [sampleTx],
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
    };
    const summaryRes: MonthlySummaryResponse = {
      month: '2026-11',
      fromDate: '2026-11-01',
      toDate: '2026-11-30',
      fundId: null,
      currencies: [],
    };
    const detailRes: GetTransactionResponse = { transaction: sampleTx };

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(transferRes, 201))
      .mockResolvedValueOnce(jsonResponse(adjustRes, 201))
      .mockResolvedValueOnce(jsonResponse(voidRes, 201))
      .mockResolvedValueOnce(jsonResponse(refundRes, 201))
      .mockResolvedValueOnce(jsonResponse(listRes, 200))
      .mockResolvedValueOnce(jsonResponse(summaryRes, 200))
      .mockResolvedValueOnce(jsonResponse(detailRes, 200));

    await expect(
      ledgerApi.recordTransfer({
        sourceFundId: 'a',
        destinationFundId: 'b',
        amount: '100.00',
        description: 'Traspaso',
      }),
    ).resolves.toEqual(transferRes);

    await expect(
      ledgerApi.recordAdjustment({
        fundId: 'a',
        direction: 'INCREASE',
        amount: '50.00',
        description: 'Cuadre',
      }),
    ).resolves.toEqual(adjustRes);

    await expect(
      ledgerApi.voidTransaction(sampleTx.id, { reason: 'Error de monto' }),
    ).resolves.toEqual(voidRes);

    await expect(
      ledgerApi.refundTransaction(sampleTx.id, { amount: '20.00' }),
    ).resolves.toEqual(refundRes);

    await expect(
      ledgerApi.list({ page: 1, limit: 20, search: '   ', currency: 'PEN' }),
    ).resolves.toEqual(listRes);

    await expect(ledgerApi.getMonthlySummary({ month: '2026-11' })).resolves.toEqual(summaryRes);
    await expect(ledgerApi.getById(sampleTx.id)).resolves.toEqual(detailRes);

    expect(fetchSpy).toHaveBeenNthCalledWith(
      5,
      'http://localhost:3000/api/v1/transactions?page=1&limit=20&currency=PEN',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(fetchSpy).toHaveBeenNthCalledWith(
      6,
      'http://localhost:3000/api/v1/transactions/summary/monthly?month=2026-11',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(fetchSpy).toHaveBeenNthCalledWith(
      7,
      `http://localhost:3000/api/v1/transactions/${sampleTx.id}`,
      expect.objectContaining({ method: 'GET' }),
    );
  });
});

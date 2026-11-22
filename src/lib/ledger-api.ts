import { buildQueryString, fetchFromApi } from '@/lib/api-client';
import type {
  GetMonthlySummaryParams,
  GetTransactionResponse,
  LedgerMutationOptions,
  ListTransactionsParams,
  ListTransactionsResponse,
  MonthlySummaryResponse,
  RecordAdjustmentPayload,
  RecordAdjustmentResponse,
  RecordTransactionPayload,
  RecordTransactionResponse,
  RecordTransferPayload,
  RecordTransferResponse,
  RefundTransactionPayload,
  RefundTransactionResponse,
  VoidTransactionPayload,
  VoidTransactionResponse,
} from '@/types/ledger';

const LEDGER_BASE_PATH = '/api/v1/transactions';

function buildIdempotencyHeaders(options?: LedgerMutationOptions): HeadersInit | undefined {
  const key = options?.idempotencyKey?.trim();
  if (!key) {
    return undefined;
  }
  return { 'Idempotency-Key': key };
}

export async function recordTransaction(
  payload: RecordTransactionPayload,
  options?: LedgerMutationOptions,
): Promise<RecordTransactionResponse> {
  return fetchFromApi<RecordTransactionResponse>(LEDGER_BASE_PATH, {
    method: 'POST',
    headers: buildIdempotencyHeaders(options),
    body: JSON.stringify(payload),
  });
}

export async function recordTransfer(
  payload: RecordTransferPayload,
  options?: LedgerMutationOptions,
): Promise<RecordTransferResponse> {
  return fetchFromApi<RecordTransferResponse>(`${LEDGER_BASE_PATH}/transfers`, {
    method: 'POST',
    headers: buildIdempotencyHeaders(options),
    body: JSON.stringify(payload),
  });
}

export async function recordAdjustment(
  payload: RecordAdjustmentPayload,
  options?: LedgerMutationOptions,
): Promise<RecordAdjustmentResponse> {
  return fetchFromApi<RecordAdjustmentResponse>(`${LEDGER_BASE_PATH}/adjustments`, {
    method: 'POST',
    headers: buildIdempotencyHeaders(options),
    body: JSON.stringify(payload),
  });
}

export async function voidTransaction(
  id: string,
  payload: VoidTransactionPayload = {},
  options?: LedgerMutationOptions,
): Promise<VoidTransactionResponse> {
  return fetchFromApi<VoidTransactionResponse>(
    `${LEDGER_BASE_PATH}/${encodeURIComponent(id)}/void`,
    {
      method: 'POST',
      headers: buildIdempotencyHeaders(options),
      body: JSON.stringify(payload),
    },
  );
}

export async function refundTransaction(
  id: string,
  payload: RefundTransactionPayload,
  options?: LedgerMutationOptions,
): Promise<RefundTransactionResponse> {
  return fetchFromApi<RefundTransactionResponse>(
    `${LEDGER_BASE_PATH}/${encodeURIComponent(id)}/refund`,
    {
      method: 'POST',
      headers: buildIdempotencyHeaders(options),
      body: JSON.stringify(payload),
    },
  );
}

export async function listTransactions(
  params?: ListTransactionsParams,
): Promise<ListTransactionsResponse> {
  const query = buildQueryString({
    page: params?.page,
    limit: params?.limit,
    fundId: params?.fundId,
    categoryId: params?.categoryId,
    type: params?.type,
    status: params?.status,
    currency: params?.currency,
    fromDate: params?.fromDate,
    toDate: params?.toDate,
    search: params?.search,
  });
  return fetchFromApi<ListTransactionsResponse>(`${LEDGER_BASE_PATH}${query}`, {
    method: 'GET',
  });
}

export async function getMonthlySummary(
  params?: GetMonthlySummaryParams,
): Promise<MonthlySummaryResponse> {
  const query = buildQueryString({
    month: params?.month,
    fundId: params?.fundId,
  });
  return fetchFromApi<MonthlySummaryResponse>(`${LEDGER_BASE_PATH}/summary/monthly${query}`, {
    method: 'GET',
  });
}

export async function getTransactionById(id: string): Promise<GetTransactionResponse> {
  return fetchFromApi<GetTransactionResponse>(`${LEDGER_BASE_PATH}/${encodeURIComponent(id)}`, {
    method: 'GET',
  });
}

export const ledgerApi = {
  recordTransaction,
  recordTransfer,
  recordAdjustment,
  voidTransaction,
  refundTransaction,
  list: listTransactions,
  getMonthlySummary,
  getById: getTransactionById,
};

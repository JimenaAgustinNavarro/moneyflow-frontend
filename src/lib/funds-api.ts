import { buildQueryString, fetchFromApi } from '@/lib/api-client';
import type {
  ArchiveFundResponse,
  CreateFundPayload,
  CreateFundResponse,
  GetFundResponse,
  ListFundsParams,
  ListFundsResponse,
  UpdateFundPayload,
  UpdateFundResponse,
} from '@/types/funds';

const FUNDS_BASE_PATH = '/api/v1/funds';

export async function listFunds(params?: ListFundsParams): Promise<ListFundsResponse> {
  const query = buildQueryString({
    includeArchived: params?.includeArchived,
    currency: params?.currency,
    type: params?.type,
  });
  return fetchFromApi<ListFundsResponse>(`${FUNDS_BASE_PATH}${query}`, {
    method: 'GET',
  });
}

export async function getFundById(id: string): Promise<GetFundResponse> {
  return fetchFromApi<GetFundResponse>(`${FUNDS_BASE_PATH}/${encodeURIComponent(id)}`, {
    method: 'GET',
  });
}

export async function createFund(payload: CreateFundPayload): Promise<CreateFundResponse> {
  return fetchFromApi<CreateFundResponse>(FUNDS_BASE_PATH, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateFund(
  id: string,
  payload: UpdateFundPayload,
): Promise<UpdateFundResponse> {
  return fetchFromApi<UpdateFundResponse>(`${FUNDS_BASE_PATH}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function archiveFund(id: string): Promise<ArchiveFundResponse> {
  return fetchFromApi<ArchiveFundResponse>(`${FUNDS_BASE_PATH}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export const fundsApi = {
  list: listFunds,
  getById: getFundById,
  create: createFund,
  update: updateFund,
  archive: archiveFund,
};

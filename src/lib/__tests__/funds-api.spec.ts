import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fundsApi } from '../funds-api';
import type {
  ArchiveFundResponse,
  CreateFundResponse,
  GetFundResponse,
  ListFundsResponse,
  UpdateFundResponse,
} from '@/types/funds';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Created',
    json: async () => body,
  } as Response;
}

describe('fundsApi', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3000';
  });

  const sampleFund = {
    id: '44444444-4444-4444-8444-444444444444',
    name: 'Cuenta BCP Soles',
    type: 'BANK' as const,
    currency: 'PEN' as const,
    color: '#0F766E',
    icon: 'landmark',
    allowNegativeBalance: false,
    isArchived: false,
    balance: '1500.00',
    createdAt: '2026-11-22T00:00:00.000Z',
    updatedAt: '2026-11-22T00:00:00.000Z',
  };

  it('list omite undefined y serializa filtros de moneda, tipo e includeArchived', async () => {
    const responseBody: ListFundsResponse = {
      funds: [sampleFund],
      totalsByCurrency: [{ currency: 'PEN', totalBalance: '1500.00', fundCount: 1 }],
    };

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(responseBody, 200));

    const result = await fundsApi.list({ currency: 'PEN', includeArchived: true, type: undefined });

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/funds?includeArchived=true&currency=PEN',
      expect.objectContaining({ method: 'GET', credentials: 'include' }),
    );
    expect(result).toEqual(responseBody);
  });

  it('getById, create, update y archive ejecutan las rutas exactas del Gateway', async () => {
    const detailRes: GetFundResponse = { fund: { ...sampleFund, entryCount: 3 } };
    const createRes: CreateFundResponse = { fund: sampleFund };
    const updateRes: UpdateFundResponse = { fund: { ...sampleFund, name: 'BCP Principal' } };
    const archiveRes: ArchiveFundResponse = {
      fund: { ...sampleFund, isArchived: true },
      message: 'Fund archived successfully',
    };

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(detailRes, 200))
      .mockResolvedValueOnce(jsonResponse(createRes, 201))
      .mockResolvedValueOnce(jsonResponse(updateRes, 200))
      .mockResolvedValueOnce(jsonResponse(archiveRes, 200));

    await expect(fundsApi.getById(sampleFund.id)).resolves.toEqual(detailRes);
    await expect(
      fundsApi.create({
        name: 'Cuenta BCP Soles',
        type: 'BANK',
        currency: 'PEN',
        initialBalance: '1500.00',
      }),
    ).resolves.toEqual(createRes);
    await expect(fundsApi.update(sampleFund.id, { name: 'BCP Principal' })).resolves.toEqual(
      updateRes,
    );
    await expect(fundsApi.archive(sampleFund.id)).resolves.toEqual(archiveRes);

    expect(fetchSpy).toHaveBeenNthCalledWith(
      1,
      `http://localhost:3000/api/v1/funds/${sampleFund.id}`,
      expect.objectContaining({ method: 'GET' }),
    );
    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      'http://localhost:3000/api/v1/funds',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          name: 'Cuenta BCP Soles',
          type: 'BANK',
          currency: 'PEN',
          initialBalance: '1500.00',
        }),
      }),
    );
    expect(fetchSpy).toHaveBeenNthCalledWith(
      3,
      `http://localhost:3000/api/v1/funds/${sampleFund.id}`,
      expect.objectContaining({ method: 'PATCH' }),
    );
    expect(fetchSpy).toHaveBeenNthCalledWith(
      4,
      `http://localhost:3000/api/v1/funds/${sampleFund.id}`,
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});

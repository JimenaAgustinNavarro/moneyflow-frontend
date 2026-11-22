import { describe, it, expect, vi, beforeEach } from 'vitest';
import { categoriesApi } from '../categories-api';
import type {
  ArchiveCategoryResponse,
  CategoryResponse,
  ListCategoriesResponse,
  UnarchiveCategoryResponse,
} from '@/types/categories';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Created',
    json: async () => body,
  } as Response;
}

describe('categoriesApi', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3000';
  });

  it('list serializa query params válidos, omite undefined y nunca envía userId', async () => {
    const payload: ListCategoriesResponse = {
      categories: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          userId: null,
          name: 'Alimentación',
          kind: 'EXPENSE',
          color: '#10B981',
          icon: 'utensils',
          isSystem: true,
          isArchived: false,
          createdAt: '2026-11-22T00:00:00.000Z',
          updatedAt: '2026-11-22T00:00:00.000Z',
        },
      ],
    };

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(payload, 200));

    const result = await categoriesApi.list({ kind: 'EXPENSE', includeArchived: false });

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/categories?kind=EXPENSE&includeArchived=false',
      expect.objectContaining({ method: 'GET', credentials: 'include' }),
    );
    expect(result).toEqual(payload);
  });

  it('create, update, archive y unarchive usan endpoints y payloads literales', async () => {
    const categoryView = {
      id: '22222222-2222-4222-8222-222222222222',
      userId: '33333333-3333-4333-8333-333333333333',
      name: 'Freelance',
      kind: 'INCOME' as const,
      color: '#22C55E',
      icon: 'briefcase',
      isSystem: false,
      isArchived: false,
      createdAt: '2026-11-22T00:00:00.000Z',
      updatedAt: '2026-11-22T00:00:00.000Z',
    };
    const createRes: CategoryResponse = { category: categoryView };
    const updateRes: CategoryResponse = { category: { ...categoryView, color: null } };
    const archiveRes: ArchiveCategoryResponse = {
      id: categoryView.id,
      isArchived: true,
      message: 'Category archived successfully',
    };
    const unarchiveRes: UnarchiveCategoryResponse = {
      id: categoryView.id,
      isArchived: false,
      message: 'Category unarchived successfully',
    };

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(createRes, 201))
      .mockResolvedValueOnce(jsonResponse(updateRes, 200))
      .mockResolvedValueOnce(jsonResponse(archiveRes, 200))
      .mockResolvedValueOnce(jsonResponse(unarchiveRes, 200));

    await expect(
      categoriesApi.create({ name: 'Freelance', kind: 'INCOME', color: '#22C55E' }),
    ).resolves.toEqual(createRes);

    await expect(
      categoriesApi.update(categoryView.id, { name: 'Freelance', color: null }),
    ).resolves.toEqual(updateRes);

    await expect(categoriesApi.archive(categoryView.id)).resolves.toEqual(archiveRes);
    await expect(categoriesApi.unarchive(categoryView.id)).resolves.toEqual(unarchiveRes);

    expect(fetchSpy).toHaveBeenNthCalledWith(
      1,
      'http://localhost:3000/api/v1/categories',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'Freelance', kind: 'INCOME', color: '#22C55E' }),
      }),
    );
    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      `http://localhost:3000/api/v1/categories/${categoryView.id}`,
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ name: 'Freelance', color: null }),
      }),
    );
    expect(fetchSpy).toHaveBeenNthCalledWith(
      3,
      `http://localhost:3000/api/v1/categories/${categoryView.id}`,
      expect.objectContaining({ method: 'DELETE' }),
    );
    expect(fetchSpy).toHaveBeenNthCalledWith(
      4,
      `http://localhost:3000/api/v1/categories/${categoryView.id}/unarchive`,
      expect.objectContaining({ method: 'POST' }),
    );
  });
});

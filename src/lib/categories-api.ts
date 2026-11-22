import { buildQueryString, fetchFromApi } from '@/lib/api-client';
import type {
  ArchiveCategoryResponse,
  CategoryResponse,
  CreateCategoryPayload,
  ListCategoriesParams,
  ListCategoriesResponse,
  UnarchiveCategoryResponse,
  UpdateCategoryPayload,
} from '@/types/categories';

const CATEGORIES_BASE_PATH = '/api/v1/categories';

export async function listCategories(
  params?: ListCategoriesParams,
): Promise<ListCategoriesResponse> {
  const query = buildQueryString({
    kind: params?.kind,
    includeArchived: params?.includeArchived,
  });
  return fetchFromApi<ListCategoriesResponse>(`${CATEGORIES_BASE_PATH}${query}`, {
    method: 'GET',
  });
}

export async function createCategory(payload: CreateCategoryPayload): Promise<CategoryResponse> {
  return fetchFromApi<CategoryResponse>(CATEGORIES_BASE_PATH, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateCategory(
  id: string,
  payload: UpdateCategoryPayload,
): Promise<CategoryResponse> {
  return fetchFromApi<CategoryResponse>(`${CATEGORIES_BASE_PATH}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function archiveCategory(id: string): Promise<ArchiveCategoryResponse> {
  return fetchFromApi<ArchiveCategoryResponse>(
    `${CATEGORIES_BASE_PATH}/${encodeURIComponent(id)}`,
    {
      method: 'DELETE',
    },
  );
}

export async function unarchiveCategory(id: string): Promise<UnarchiveCategoryResponse> {
  return fetchFromApi<UnarchiveCategoryResponse>(
    `${CATEGORIES_BASE_PATH}/${encodeURIComponent(id)}/unarchive`,
    {
      method: 'POST',
    },
  );
}

export const categoriesApi = {
  list: listCategories,
  create: createCategory,
  update: updateCategory,
  archive: archiveCategory,
  unarchive: unarchiveCategory,
};

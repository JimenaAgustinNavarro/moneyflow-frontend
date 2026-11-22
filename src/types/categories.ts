export type CategoryKind = 'INCOME' | 'EXPENSE';

export interface CategoryView {
  id: string;
  userId: string | null;
  name: string;
  kind: CategoryKind;
  color: string | null;
  icon: string | null;
  isSystem: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ListCategoriesParams {
  kind?: CategoryKind;
  includeArchived?: boolean;
}

export interface CreateCategoryPayload {
  name: string;
  kind: CategoryKind;
  color?: string;
  icon?: string;
}

export interface UpdateCategoryPayload {
  name?: string;
  color?: string | null;
  icon?: string | null;
}

export interface ListCategoriesResponse {
  categories: CategoryView[];
}

export interface CategoryResponse {
  category: CategoryView;
}

export interface ArchiveCategoryResponse {
  id: string;
  isArchived: true;
  message: string;
}

export interface UnarchiveCategoryResponse {
  id: string;
  isArchived: false;
  message: string;
}

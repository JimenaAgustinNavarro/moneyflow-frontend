'use client';

import * as React from 'react';
import {
  AlertCircle,
  Archive,
  ArchiveRestore,
  Filter,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Tags,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getApiErrorMessage } from '@/lib/api-error-messages';
import { categoriesApi } from '@/lib/categories-api';
import { cn } from '@/lib/utils';
import type { CategoryView } from '@/types/categories';
import { ArchiveCategoryModal } from '@/components/categories/archive-category-modal';
import { CategoryFormModal } from '@/components/categories/category-form-modal';
import { CategoryIconBadge } from '@/components/categories/category-icon';

type KindFilter = 'ALL' | 'INCOME' | 'EXPENSE';

export default function CategoriesPage(): React.JSX.Element {
  const [categories, setCategories] = React.useState<CategoryView[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [fetchError, setFetchError] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);

  // Filtros
  const [kindFilter, setKindFilter] = React.useState<KindFilter>('ALL');
  const [includeArchived, setIncludeArchived] = React.useState(false);

  // Anti doble clic y seguimiento por ID en desarchivado
  const [unarchivingId, setUnarchivingId] = React.useState<string | null>(null);

  // Modales
  const [isFormModalOpen, setIsFormModalOpen] = React.useState(false);
  const [formModalMode, setFormModalMode] = React.useState<'create' | 'edit'>('create');
  const [categoryToEdit, setCategoryToEdit] = React.useState<CategoryView | null>(null);

  const [isArchiveModalOpen, setIsArchiveModalOpen] = React.useState(false);
  const [categoryToArchive, setCategoryToArchive] = React.useState<CategoryView | null>(null);

  // Contador monotónico anti-race para solicitudes asíncronas
  const requestIdRef = React.useRef(0);

  const loadCategories = React.useCallback(async (): Promise<void> => {
    const currentRequestId = ++requestIdRef.current;
    setIsLoading(true);
    setFetchError(null);

    try {
      const response = await categoriesApi.list({
        kind: kindFilter === 'ALL' ? undefined : kindFilter,
        includeArchived,
      });

      if (currentRequestId === requestIdRef.current) {
        setCategories(response.categories);
      }
    } catch (err) {
      if (currentRequestId === requestIdRef.current) {
        const message = getApiErrorMessage(err, 'No se pudieron cargar las categorías.');
        setFetchError(message);
      }
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [kindFilter, includeArchived]);

  React.useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  const handleOpenCreateModal = (): void => {
    setActionError(null);
    setFormModalMode('create');
    setCategoryToEdit(null);
    setIsFormModalOpen(true);
  };

  const handleOpenEditModal = (category: CategoryView): void => {
    if (category.isSystem || category.isArchived) {
      return;
    }
    setActionError(null);
    setFormModalMode('edit');
    setCategoryToEdit(category);
    setIsFormModalOpen(true);
  };

  const handleOpenArchiveModal = (category: CategoryView): void => {
    if (category.isSystem || category.isArchived) {
      return;
    }
    setActionError(null);
    setCategoryToArchive(category);
    setIsArchiveModalOpen(true);
  };

  const handleUnarchive = async (category: CategoryView): Promise<void> => {
    if (category.isSystem || !category.isArchived || unarchivingId !== null) {
      return;
    }

    setActionError(null);
    setUnarchivingId(category.id);

    try {
      await categoriesApi.unarchive(category.id);
      await loadCategories();
    } catch (err) {
      const message = getApiErrorMessage(
        err,
        'No se pudo desarchivar la categoría. Es posible que ya exista una activa con ese nombre.',
      );
      setActionError(message);
    } finally {
      setUnarchivingId(null);
    }
  };

  const handleFormSuccess = (): void => {
    void loadCategories();
  };

  const handleArchiveSuccess = (): void => {
    void loadCategories();
  };

  return (
    <section className="space-y-6">
      {/* Cabecera de página */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Categorías</h1>
          <p className="text-sm text-muted-foreground">
            Clasificación de ingresos y gastos del sistema y personalizadas.
          </p>
        </div>
        <Button
          type="button"
          onClick={handleOpenCreateModal}
          className="gap-2 sm:self-auto self-start"
        >
          <Plus className="h-4 w-4" />
          Nueva categoría
        </Button>
      </div>

      {/* Alerta de acción fallida (ej. conflicto al desarchivar) */}
      {actionError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Operación no completada</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>{actionError}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setActionError(null)}
              className="h-7 px-2.5 text-xs"
            >
              Cerrar aviso
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Barra de filtros y controles */}
      <Card>
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mr-1">
                <Filter className="h-3.5 w-3.5" />
                Tipo:
              </span>
              <Button
                type="button"
                variant={kindFilter === 'ALL' ? 'default' : 'outline'}
                size="sm"
                aria-pressed={kindFilter === 'ALL'}
                onClick={() => setKindFilter('ALL')}
                className="h-8 rounded-lg text-xs"
              >
                Todos
              </Button>
              <Button
                type="button"
                variant={kindFilter === 'INCOME' ? 'default' : 'outline'}
                size="sm"
                aria-pressed={kindFilter === 'INCOME'}
                onClick={() => setKindFilter('INCOME')}
                className={cn(
                  'h-8 rounded-lg text-xs',
                  kindFilter === 'INCOME' && 'bg-income text-income-foreground hover:bg-income/90',
                )}
              >
                Ingresos
              </Button>
              <Button
                type="button"
                variant={kindFilter === 'EXPENSE' ? 'default' : 'outline'}
                size="sm"
                aria-pressed={kindFilter === 'EXPENSE'}
                onClick={() => setKindFilter('EXPENSE')}
                className={cn(
                  'h-8 rounded-lg text-xs',
                  kindFilter === 'EXPENSE' && 'bg-expense text-expense-foreground hover:bg-expense/90',
                )}
              >
                Gastos
              </Button>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 md:pt-0 border-t md:border-t-0 border-border">
              <label
                htmlFor="include-archived-checkbox"
                className="flex items-center gap-2 cursor-pointer select-none text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                <input
                  id="include-archived-checkbox"
                  type="checkbox"
                  checked={includeArchived}
                  onChange={(e) => setIncludeArchived(e.target.checked)}
                  className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
                />
                Mostrar archivadas
              </label>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Refrescar lista de categorías"
                onClick={() => void loadCategories()}
                disabled={isLoading}
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
              >
                <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Estados principales: Carga, Error y Lista */}
      {isLoading ? (
        <div
          role="status"
          aria-live="polite"
          className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card p-12 text-center"
        >
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
          <p className="text-sm font-medium text-foreground">Cargando categorías...</p>
        </div>
      ) : fetchError ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No se pudieron cargar las categorías</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>{fetchError}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void loadCategories()}
              className="gap-2"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      ) : categories.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card p-12 text-center">
          <Tags className="h-10 w-10 text-muted-foreground/60" />
          <p className="text-base font-semibold text-foreground">No se encontraron categorías</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            {includeArchived
              ? 'No hay categorías que coincidan con los filtros seleccionados.'
              : 'No hay categorías activas disponibles con este filtro. Puedes crear una nueva categoría personalizada.'}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleOpenCreateModal}
            className="mt-2 gap-2"
          >
            <Plus className="h-3.5 w-3.5" />
            Crear categoría
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => {
            const isSystem = category.isSystem;
            const isArchived = category.isArchived;
            const isUnarchiving = unarchivingId === category.id;

            return (
              <Card
                key={category.id}
                className={cn(
                  'transition-all duration-150 hover:border-accent/40',
                  isArchived && 'opacity-65 bg-muted/30 border-dashed',
                )}
              >
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <CategoryIconBadge
                      iconName={category.icon}
                      colorHex={category.color}
                      size="md"
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {category.name}
                        </p>
                        {isSystem && (
                          <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Sistema
                          </span>
                        )}
                        {isArchived && (
                          <span className="inline-flex items-center rounded-full bg-warning/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-warning">
                            Archivada
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-muted-foreground">
                        {category.kind === 'INCOME' ? 'Ingreso' : 'Gasto'}
                      </p>
                    </div>
                  </div>

                  {/* Acciones diferenciadas Sistema vs Personalizadas */}
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    {!isSystem && !isArchived && (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Editar categoría ${category.name}`}
                          onClick={() => handleOpenEditModal(category)}
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Archivar categoría ${category.name}`}
                          onClick={() => handleOpenArchiveModal(category)}
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        >
                          <Archive className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}

                    {!isSystem && isArchived && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isUnarchiving}
                        aria-label={`Desarchivar categoría ${category.name}`}
                        onClick={() => void handleUnarchive(category)}
                        className="h-8 text-xs gap-1.5"
                      >
                        {isUnarchiving ? (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin" />
                            <span>Desarchivando...</span>
                          </>
                        ) : (
                          <>
                            <ArchiveRestore className="h-3.5 w-3.5" />
                            <span>Desarchivar</span>
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal Crear / Editar */}
      <CategoryFormModal
        mode={formModalMode}
        categoryToEdit={categoryToEdit}
        defaultKind={kindFilter === 'INCOME' ? 'INCOME' : 'EXPENSE'}
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSuccess={handleFormSuccess}
      />

      {/* Modal Confirmación de Archivado */}
      <ArchiveCategoryModal
        category={categoryToArchive}
        isOpen={isArchiveModalOpen}
        onClose={() => setIsArchiveModalOpen(false)}
        onSuccess={handleArchiveSuccess}
      />
    </section>
  );
}

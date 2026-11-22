'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, Check, Loader2, X } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getApiErrorMessage } from '@/lib/api-error-messages';
import { categoriesApi } from '@/lib/categories-api';
import {
  buildCreateCategoryPayload,
  buildUpdateCategoryPayload,
  categoryFormSchema,
  CURATED_COLOR_PALETTE,
  CURATED_ICON_CATALOG,
  getCategoryIconComponent,
  type CategoryFormValues,
} from '@/lib/category-schemas';
import { cn } from '@/lib/utils';
import type { CategoryKind, CategoryView } from '@/types/categories';
import { CategoryIconBadge } from './category-icon';

export interface CategoryFormModalProps {
  mode: 'create' | 'edit';
  categoryToEdit?: CategoryView | null;
  defaultKind?: CategoryKind;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (savedCategory: CategoryView) => void;
}

export function CategoryFormModal({
  mode,
  categoryToEdit,
  defaultKind = 'EXPENSE',
  isOpen,
  onClose,
  onSuccess,
}: CategoryFormModalProps): React.JSX.Element | null {
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const initialValues: CategoryFormValues = React.useMemo(() => {
    if (mode === 'edit' && categoryToEdit) {
      return {
        name: categoryToEdit.name,
        kind: categoryToEdit.kind,
        color: categoryToEdit.color,
        icon: categoryToEdit.icon,
      };
    }
    return {
      name: '',
      kind: defaultKind,
      color: null,
      icon: null,
    };
  }, [mode, categoryToEdit, defaultKind]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    mode: 'onChange',
    defaultValues: initialValues,
  });

  React.useEffect(() => {
    if (isOpen) {
      reset(initialValues);
      setSubmitError(null);
    }
  }, [isOpen, initialValues, reset]);

  React.useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) {
    return null;
  }

  const watchedValues = watch();
  const watchedKind = watchedValues.kind;
  const watchedColor = watchedValues.color;
  const watchedIcon = watchedValues.icon;

  const hasPendingChanges =
    mode === 'create'
      ? watchedValues.name.trim().length > 0
      : categoryToEdit
        ? buildUpdateCategoryPayload(categoryToEdit, watchedValues) !== null
        : false;

  const onSubmit = async (values: CategoryFormValues): Promise<void> => {
    setSubmitError(null);

    try {
      if (mode === 'create') {
        const payload = buildCreateCategoryPayload(values);
        const response = await categoriesApi.create(payload);
        onSuccess(response.category);
        onClose();
        return;
      }

      if (mode === 'edit' && categoryToEdit) {
        const payload = buildUpdateCategoryPayload(categoryToEdit, values);
        if (!payload) {
          onClose();
          return;
        }
        const response = await categoriesApi.update(categoryToEdit.id, payload);
        onSuccess(response.category);
        onClose();
      }
    } catch (err) {
      const message = getApiErrorMessage(err, 'No se pudo guardar la categoría.');
      setSubmitError(message);
    }
  };

  const handleSelectColor = (hex: string): void => {
    if (watchedColor?.toUpperCase() === hex.toUpperCase()) {
      setValue('color', null, { shouldValidate: true, shouldDirty: true });
    } else {
      setValue('color', hex, { shouldValidate: true, shouldDirty: true });
    }
  };

  const handleSelectIcon = (iconName: string): void => {
    if (watchedIcon === iconName) {
      setValue('icon', null, { shouldValidate: true, shouldDirty: true });
    } else {
      setValue('icon', iconName, { shouldValidate: true, shouldDirty: true });
    }
  };

  const isEdit = mode === 'edit';
  const modalTitle = isEdit ? 'Editar categoría' : 'Nueva categoría';
  const modalDescription = isEdit
    ? 'Modifica los datos de tu categoría personalizada.'
    : 'Crea una categoría personalizada para clasificar tus ingresos o gastos.';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity"
        aria-hidden="true"
        onClick={() => {
          if (!isSubmitting) onClose();
        }}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="category-modal-title"
        aria-describedby="category-modal-description"
        className="relative z-50 flex w-full max-w-lg flex-col max-h-[90vh] overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-2xl animate-in fade-in-0 zoom-in-95 duration-150"
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="space-y-0.5">
            <h2 id="category-modal-title" className="text-lg font-bold tracking-tight text-foreground">
              {modalTitle}
            </h2>
            <p id="category-modal-description" className="text-xs text-muted-foreground">
              {modalDescription}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Cerrar ventana"
            disabled={isSubmitting}
            onClick={onClose}
            className="h-8 w-8 rounded-lg"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="flex flex-1 flex-col overflow-y-auto px-6 py-5 space-y-5"
        >
          {submitError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>No se pudo guardar la categoría</AlertTitle>
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          )}

          {/* Vista previa en vivo */}
          <div className="flex items-center gap-3.5 rounded-lg border border-border bg-secondary/30 p-3">
            <CategoryIconBadge
              iconName={watchedIcon}
              colorHex={watchedColor}
              size="lg"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">
                {watchedValues.name.trim() || 'Nombre de la categoría'}
              </p>
              <p className="text-xs text-muted-foreground">
                {watchedKind === 'INCOME' ? 'Tipo: Ingreso' : 'Tipo: Gasto'}
                {watchedColor ? ` • ${watchedColor.toUpperCase()}` : ''}
              </p>
            </div>
          </div>

          {/* Tipo de categoría */}
          <div className="space-y-1.5">
            <Label htmlFor="category-kind-selector">Tipo de categoría</Label>
            {isEdit ? (
              <div
                id="category-kind-selector"
                className="flex h-10 w-full items-center rounded-md border border-input bg-muted px-3 text-sm font-medium text-muted-foreground select-none"
              >
                {watchedKind === 'INCOME' ? 'Ingreso' : 'Gasto'} (No modificable)
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2" id="category-kind-selector">
                <Button
                  type="button"
                  variant={watchedKind === 'EXPENSE' ? 'default' : 'outline'}
                  size="sm"
                  aria-pressed={watchedKind === 'EXPENSE'}
                  onClick={() => setValue('kind', 'EXPENSE', { shouldValidate: true })}
                  className={cn(
                    'h-10 justify-center font-medium',
                    watchedKind === 'EXPENSE' && 'bg-expense text-expense-foreground hover:bg-expense/90',
                  )}
                >
                  Gasto
                </Button>
                <Button
                  type="button"
                  variant={watchedKind === 'INCOME' ? 'default' : 'outline'}
                  size="sm"
                  aria-pressed={watchedKind === 'INCOME'}
                  onClick={() => setValue('kind', 'INCOME', { shouldValidate: true })}
                  className={cn(
                    'h-10 justify-center font-medium',
                    watchedKind === 'INCOME' && 'bg-income text-income-foreground hover:bg-income/90',
                  )}
                >
                  Ingreso
                </Button>
              </div>
            )}
          </div>

          {/* Nombre de la categoría */}
          <div className="space-y-1.5">
            <Label htmlFor="category-name-input">Nombre de la categoría</Label>
            <Input
              id="category-name-input"
              type="text"
              placeholder="Ej. Gimnasio, Cursos, Freelance"
              maxLength={100}
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? 'category-name-error' : undefined}
              disabled={isSubmitting}
              {...register('name')}
            />
            {errors.name && (
              <p id="category-name-error" role="alert" className="text-xs text-destructive">
                {errors.name.message}
              </p>
            )}
          </div>

          {/* Paleta curada de colores */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Color identificador</Label>
              {watchedColor && (
                <button
                  type="button"
                  onClick={() => setValue('color', null, { shouldValidate: true, shouldDirty: true })}
                  className="text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  Limpiar color
                </button>
              )}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {CURATED_COLOR_PALETTE.map((hex) => {
                const isSelected = watchedColor?.toUpperCase() === hex.toUpperCase();
                return (
                  <button
                    key={hex}
                    type="button"
                    aria-label={`Color ${hex}`}
                    aria-pressed={isSelected}
                    onClick={() => handleSelectColor(hex)}
                    style={{ backgroundColor: hex }}
                    className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-lg shadow-sm transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                      isSelected ? 'ring-2 ring-foreground ring-offset-2' : 'opacity-85 hover:opacity-100',
                    )}
                  >
                    {isSelected && <Check className="h-4 w-4 text-white stroke-[3]" />}
                  </button>
                );
              })}
            </div>
            {errors.color && (
              <p role="alert" className="text-xs text-destructive">
                {errors.color.message}
              </p>
            )}
          </div>

          {/* Catálogo curado de íconos */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Ícono representativo</Label>
              {watchedIcon && (
                <button
                  type="button"
                  onClick={() => setValue('icon', null, { shouldValidate: true, shouldDirty: true })}
                  className="text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  Limpiar ícono
                </button>
              )}
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
              {CURATED_ICON_CATALOG.map(({ name, label }) => {
                const IconComponent = getCategoryIconComponent(name);
                const isSelected = watchedIcon === name;
                return (
                  <button
                    key={name}
                    type="button"
                    title={label}
                    aria-label={label}
                    aria-pressed={isSelected}
                    onClick={() => handleSelectIcon(name)}
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-lg border transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      isSelected
                        ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                        : 'border-border bg-card text-foreground',
                    )}
                  >
                    <IconComponent className="h-5 w-5" />
                  </button>
                );
              })}
            </div>
            {errors.icon && (
              <p role="alert" className="text-xs text-destructive">
                {errors.icon.message}
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={onClose}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || (isEdit && !hasPendingChanges)}
              className="gap-2"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? 'Guardar cambios' : 'Crear categoría'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

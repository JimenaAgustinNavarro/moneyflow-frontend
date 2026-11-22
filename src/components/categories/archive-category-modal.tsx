'use client';

import * as React from 'react';
import { AlertCircle, AlertTriangle, Loader2, X } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { getApiErrorMessage } from '@/lib/api-error-messages';
import { categoriesApi } from '@/lib/categories-api';
import type { CategoryView } from '@/types/categories';
import { CategoryIconBadge } from './category-icon';

export interface ArchiveCategoryModalProps {
  category: CategoryView | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (archivedId: string) => void;
}

export function ArchiveCategoryModal({
  category,
  isOpen,
  onClose,
  onSuccess,
}: ArchiveCategoryModalProps): React.JSX.Element | null {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      setIsSubmitting(false);
    }
  }, [isOpen]);

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

  if (!isOpen || !category) {
    return null;
  }

  const handleConfirmArchive = async (): Promise<void> => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await categoriesApi.archive(category.id);
      onSuccess(category.id);
      onClose();
    } catch (err) {
      const message = getApiErrorMessage(err, 'No se pudo archivar la categoría.');
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

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
        aria-labelledby="archive-modal-title"
        aria-describedby="archive-modal-description"
        className="relative z-50 flex w-full max-w-md flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-2xl animate-in fade-in-0 zoom-in-95 duration-150"
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            <h2 id="archive-modal-title" className="text-base font-bold tracking-tight text-foreground">
              Archivar categoría
            </h2>
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

        <div className="space-y-4 px-6 py-5">
          {errorMessage && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error al archivar</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          <div className="flex items-center gap-3.5 rounded-lg border border-border bg-secondary/30 p-3">
            <CategoryIconBadge
              iconName={category.icon}
              colorHex={category.color}
              size="md"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{category.name}</p>
              <p className="text-xs text-muted-foreground">
                {category.kind === 'INCOME' ? 'Categoría de Ingreso' : 'Categoría de Gasto'}
              </p>
            </div>
          </div>

          <p id="archive-modal-description" className="text-sm leading-relaxed text-muted-foreground">
            ¿Estás seguro de que deseas archivar la categoría{' '}
            <strong className="text-foreground">{category.name}</strong>?
          </p>

          <Alert variant="warning">
            <AlertDescription className="text-xs">
              La categoría ya no estará disponible para registrar nuevos movimientos. El historial de
              transacciones existentes se conservará intacto. Puedes desarchivarla en cualquier momento.
            </AlertDescription>
          </Alert>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting}
            onClick={onClose}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={isSubmitting}
            onClick={() => void handleConfirmArchive()}
            className="gap-2"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Confirmar archivado
          </Button>
        </div>
      </div>
    </div>
  );
}

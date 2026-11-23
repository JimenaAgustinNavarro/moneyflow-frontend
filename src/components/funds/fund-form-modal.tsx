'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getApiErrorMessage } from '@/lib/api-error-messages';
import { fundsApi } from '@/lib/funds-api';
import {
  buildCreateFundPayload,
  buildUpdateFundPayload,
  createFundSchema,
  FUND_COLOR_PRESETS,
  FUND_CURRENCIES,
  FUND_CURRENCY_LABELS,
  FUND_ICON_OPTIONS,
  FUND_TYPE_LABELS,
  FUND_TYPES,
  updateFundSchema,
  type CreateFundFormValues,
  type UpdateFundFormValues,
} from '@/lib/funds-schemas';
import type { FundView } from '@/types/funds';

export interface FundFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fund?: FundView | null;
  onSuccess: (savedFund: FundView, mode: 'create' | 'edit') => void;
}

const SELECT_CLASS_NAME =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50';

export function FundFormModal({
  open,
  onOpenChange,
  fund,
  onSuccess,
}: FundFormModalProps): React.JSX.Element {
  const isEditing = Boolean(fund);
  const titleId = React.useId();
  const descriptionId = React.useId();

  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const createForm = useForm<CreateFundFormValues>({
    resolver: zodResolver(createFundSchema),
    defaultValues: {
      name: '',
      type: 'BANK',
      currency: 'PEN',
      color: '',
      icon: '',
      allowNegativeBalance: false,
      initialBalance: '',
    },
  });

  const editForm = useForm<UpdateFundFormValues>({
    resolver: zodResolver(updateFundSchema),
    defaultValues: {
      name: fund?.name ?? '',
      type: fund?.type ?? 'BANK',
      color: fund?.color ?? '',
      icon: fund?.icon ?? '',
      allowNegativeBalance: fund?.allowNegativeBalance ?? false,
    },
  });

  React.useEffect(() => {
    if (!open) {
      return;
    }

    setSubmitError(null);

    if (fund) {
      editForm.reset({
        name: fund.name,
        type: fund.type,
        color: fund.color ?? '',
        icon: fund.icon ?? '',
        allowNegativeBalance: fund.allowNegativeBalance,
      });
    } else {
      createForm.reset({
        name: '',
        type: 'BANK',
        currency: 'PEN',
        color: '',
        icon: '',
        allowNegativeBalance: false,
        initialBalance: '',
      });
    }
  }, [open, fund, createForm, editForm]);

  const isSubmitting = isEditing
    ? editForm.formState.isSubmitting
    : createForm.formState.isSubmitting;

  const handleCreateSubmit = async (values: CreateFundFormValues): Promise<void> => {
    setSubmitError(null);
    try {
      const payload = buildCreateFundPayload(values);
      const response = await fundsApi.create(payload);
      onOpenChange(false);
      onSuccess(response.fund, 'create');
    } catch (error) {
      setSubmitError(getApiErrorMessage(error, 'No se pudo crear el fondo.'));
    }
  };

  const handleEditSubmit = async (values: UpdateFundFormValues): Promise<void> => {
    if (!fund) {
      return;
    }

    setSubmitError(null);
    const payload = buildUpdateFundPayload(fund, values);
    if (!payload) {
      setSubmitError('No hay cambios para guardar.');
      return;
    }

    try {
      const response = await fundsApi.update(fund.id, payload);
      onOpenChange(false);
      onSuccess(response.fund, 'edit');
    } catch (error) {
      setSubmitError(getApiErrorMessage(error, 'No se pudo actualizar el fondo.'));
    }
  };

  const activeColorValue = isEditing ? editForm.watch('color') ?? '' : createForm.watch('color') ?? '';
  const activeIconValue = isEditing ? editForm.watch('icon') ?? '' : createForm.watch('icon') ?? '';

  const hasCustomIcon =
    activeIconValue.trim().length > 0 &&
    !FUND_ICON_OPTIONS.some((option) => option.value === activeIconValue.trim());

  const setColorValue = (value: string): void => {
    if (isEditing) {
      editForm.setValue('color', value, { shouldDirty: true, shouldValidate: true });
    } else {
      createForm.setValue('color', value, { shouldDirty: true, shouldValidate: true });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      titleId={titleId}
      descriptionId={descriptionId}
      closeDisabled={isSubmitting}
    >
      <DialogHeader>
        <DialogTitle id={titleId}>{isEditing ? 'Editar fondo' : 'Nuevo fondo'}</DialogTitle>
        <DialogDescription id={descriptionId}>
          {isEditing
            ? 'Actualiza los datos del fondo. La moneda es inmutable una vez creado.'
            : 'Crea una cuenta, billetera o efectivo para registrar tus movimientos.'}
        </DialogDescription>
      </DialogHeader>

      {submitError && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      )}

      {isEditing && fund ? (
        <form onSubmit={editForm.handleSubmit(handleEditSubmit)} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="fund-name">Nombre del fondo</Label>
            <Input
              id="fund-name"
              placeholder="Ej. Cuenta Sueldo BCP"
              aria-invalid={Boolean(editForm.formState.errors.name)}
              {...editForm.register('name')}
            />
            {editForm.formState.errors.name && (
              <p className="text-xs text-destructive">{editForm.formState.errors.name.message}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="fund-type">Tipo de fondo</Label>
              <select
                id="fund-type"
                className={SELECT_CLASS_NAME}
                {...editForm.register('type')}
              >
                {FUND_TYPES.map((typeOption) => (
                  <option key={typeOption} value={typeOption}>
                    {FUND_TYPE_LABELS[typeOption]}
                  </option>
                ))}
              </select>
              {editForm.formState.errors.type && (
                <p className="text-xs text-destructive">{editForm.formState.errors.type.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="fund-currency-readonly">Moneda</Label>
              <Input
                id="fund-currency-readonly"
                value={FUND_CURRENCY_LABELS[fund.currency]}
                disabled
                readOnly
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="fund-color">Color (hexadecimal opcional)</Label>
              {activeColorValue.trim().length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-auto px-2 py-0.5 text-xs"
                  onClick={() => setColorValue('')}
                >
                  Limpiar color
                </Button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {FUND_COLOR_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  aria-label={`Seleccionar color ${preset}`}
                  onClick={() => setColorValue(preset)}
                  className={`h-7 w-7 rounded-full border-2 transition-transform ${
                    activeColorValue.toUpperCase() === preset.toUpperCase()
                      ? 'scale-110 border-foreground'
                      : 'border-transparent'
                  }`}
                  style={{ backgroundColor: preset }}
                />
              ))}
            </div>
            <Input
              id="fund-color"
              placeholder="#0F766E"
              aria-invalid={Boolean(editForm.formState.errors.color)}
              {...editForm.register('color')}
            />
            {editForm.formState.errors.color && (
              <p className="text-xs text-destructive">{editForm.formState.errors.color.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fund-icon">Ícono (opcional)</Label>
            <select
              id="fund-icon"
              className={SELECT_CLASS_NAME}
              {...editForm.register('icon')}
            >
              <option value="">Sin ícono personalizado</option>
              {hasCustomIcon && (
                <option value={activeIconValue.trim()}>{activeIconValue.trim()}</option>
              )}
              {FUND_ICON_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} ({option.value})
                </option>
              ))}
            </select>
            {editForm.formState.errors.icon && (
              <p className="text-xs text-destructive">{editForm.formState.errors.icon.message}</p>
            )}
          </div>

          <div className="flex items-start gap-2.5 rounded-lg border border-border bg-secondary/30 p-3">
            <input
              id="fund-allow-negative"
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-input accent-primary"
              {...editForm.register('allowNegativeBalance')}
            />
            <div className="space-y-0.5">
              <Label htmlFor="fund-allow-negative" className="cursor-pointer">
                Permitir saldo negativo (sobregiro)
              </Label>
              <p className="text-xs text-muted-foreground">
                Si el saldo actual es negativo, el servidor impedirá desactivar esta opción.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </DialogFooter>
        </form>
      ) : (
        <form onSubmit={createForm.handleSubmit(handleCreateSubmit)} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="fund-name">Nombre del fondo</Label>
            <Input
              id="fund-name"
              placeholder="Ej. Cuenta Sueldo BCP"
              aria-invalid={Boolean(createForm.formState.errors.name)}
              {...createForm.register('name')}
            />
            {createForm.formState.errors.name && (
              <p className="text-xs text-destructive">{createForm.formState.errors.name.message}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="fund-type">Tipo de fondo</Label>
              <select
                id="fund-type"
                className={SELECT_CLASS_NAME}
                {...createForm.register('type')}
              >
                {FUND_TYPES.map((typeOption) => (
                  <option key={typeOption} value={typeOption}>
                    {FUND_TYPE_LABELS[typeOption]}
                  </option>
                ))}
              </select>
              {createForm.formState.errors.type && (
                <p className="text-xs text-destructive">
                  {createForm.formState.errors.type.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="fund-currency">Moneda</Label>
              <select
                id="fund-currency"
                className={SELECT_CLASS_NAME}
                {...createForm.register('currency')}
              >
                {FUND_CURRENCIES.map((currencyOption) => (
                  <option key={currencyOption} value={currencyOption}>
                    {FUND_CURRENCY_LABELS[currencyOption]}
                  </option>
                ))}
              </select>
              {createForm.formState.errors.currency && (
                <p className="text-xs text-destructive">
                  {createForm.formState.errors.currency.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fund-initial-balance">Saldo inicial (opcional)</Label>
            <Input
              id="fund-initial-balance"
              inputMode="decimal"
              placeholder="0.00"
              aria-invalid={Boolean(createForm.formState.errors.initialBalance)}
              {...createForm.register('initialBalance')}
            />
            <p className="text-xs text-muted-foreground">
              Deja vacío para iniciar en 0.00 sin asiento de apertura.
            </p>
            {createForm.formState.errors.initialBalance && (
              <p className="text-xs text-destructive">
                {createForm.formState.errors.initialBalance.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="fund-color">Color (hexadecimal opcional)</Label>
              {activeColorValue.trim().length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-auto px-2 py-0.5 text-xs"
                  onClick={() => setColorValue('')}
                >
                  Limpiar color
                </Button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {FUND_COLOR_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  aria-label={`Seleccionar color ${preset}`}
                  onClick={() => setColorValue(preset)}
                  className={`h-7 w-7 rounded-full border-2 transition-transform ${
                    activeColorValue.toUpperCase() === preset.toUpperCase()
                      ? 'scale-110 border-foreground'
                      : 'border-transparent'
                  }`}
                  style={{ backgroundColor: preset }}
                />
              ))}
            </div>
            <Input
              id="fund-color"
              placeholder="#0F766E"
              aria-invalid={Boolean(createForm.formState.errors.color)}
              {...createForm.register('color')}
            />
            {createForm.formState.errors.color && (
              <p className="text-xs text-destructive">{createForm.formState.errors.color.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fund-icon">Ícono (opcional)</Label>
            <select
              id="fund-icon"
              className={SELECT_CLASS_NAME}
              {...createForm.register('icon')}
            >
              <option value="">Sin ícono personalizado</option>
              {FUND_ICON_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} ({option.value})
                </option>
              ))}
            </select>
            {createForm.formState.errors.icon && (
              <p className="text-xs text-destructive">{createForm.formState.errors.icon.message}</p>
            )}
          </div>

          <div className="flex items-start gap-2.5 rounded-lg border border-border bg-secondary/30 p-3">
            <input
              id="fund-allow-negative"
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-input accent-primary"
              {...createForm.register('allowNegativeBalance')}
            />
            <div className="space-y-0.5">
              <Label htmlFor="fund-allow-negative" className="cursor-pointer">
                Permitir saldo negativo (sobregiro)
              </Label>
              <p className="text-xs text-muted-foreground">
                Útil para cuentas con línea de sobregiro autorizada.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creando...' : 'Crear fondo'}
            </Button>
          </DialogFooter>
        </form>
      )}
    </Dialog>
  );
}

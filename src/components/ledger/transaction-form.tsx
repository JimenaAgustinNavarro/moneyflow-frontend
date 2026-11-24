'use client';

import * as React from 'react';
import Link from 'next/link';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Loader2,
  SlidersHorizontal,
  Wallet,
} from 'lucide-react';
import {
  TransactionSplitsEditor,
} from '@/components/ledger/transaction-splits-editor';
import {
  TransactionSuccessCard,
  type LedgerCreationResult,
} from '@/components/ledger/transaction-success-card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getApiErrorMessage } from '@/lib/api-error-messages';
import { categoriesApi } from '@/lib/categories-api';
import { getTodayLimaDateString } from '@/lib/formatters';
import { fundsApi } from '@/lib/funds-api';
import { ledgerApi } from '@/lib/ledger-api';
import {
  buildLedgerPayloadFingerprint,
  buildRecordAdjustmentPayload,
  buildRecordTransactionPayload,
  buildRecordTransferPayload,
  DESCRIPTION_MAX_LENGTH,
  isValidPositiveLedgerAmount,
  MIN_SPLITS_COUNT,
  NOTES_MAX_LENGTH,
  recordAdjustmentFormSchema,
  recordTransactionFormSchema,
  recordTransferFormSchema,
  type AllocationMode,
  type LedgerFormMode,
  type RecordAdjustmentFormValues,
  type RecordTransactionFormValues,
  type RecordTransferFormValues,
} from '@/lib/ledger-schemas';
import {
  addMoney,
  formatCurrency,
  isNegativeMoney,
  isZeroMoney,
  normalizeMoney,
  subMoney,
  sumMoney,
} from '@/lib/money';
import { useIdempotencyKey } from '@/lib/use-idempotency-key';
import type { CategoryView } from '@/types/categories';
import type { FundView } from '@/types/funds';
import type { RecordableTransactionType } from '@/types/ledger';

export interface TransactionFormProps {
  initialMode?: LedgerFormMode;
  initialFundId?: string | null;
}

const MODE_OPTIONS: Array<{
  mode: LedgerFormMode;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    mode: 'EXPENSE',
    label: 'Egreso',
    description: 'Gasto único o dividido en splits',
    icon: ArrowUpRight,
  },
  {
    mode: 'INCOME',
    label: 'Ingreso',
    description: 'Entrada de dinero única o dividida',
    icon: ArrowDownLeft,
  },
  {
    mode: 'TRANSFER',
    label: 'Transferencia',
    description: 'Traspaso entre fondos de igual moneda',
    icon: ArrowLeftRight,
  },
  {
    mode: 'ADJUSTMENT',
    label: 'Ajuste manual',
    description: 'Corrección o cuadre de saldo',
    icon: SlidersHorizontal,
  },
];

function createDefaultSplits(): Array<{ categoryId: string; amount: string; note: string }> {
  return [
    { categoryId: '', amount: '', note: '' },
    { categoryId: '', amount: '', note: '' },
  ];
}

export function TransactionForm({
  initialMode = 'EXPENSE',
  initialFundId = null,
}: TransactionFormProps): React.JSX.Element {
  const todayLima = React.useMemo(() => getTodayLimaDateString(), []);
  const [activeMode, setActiveMode] = React.useState<LedgerFormMode>(initialMode);

  const [isLoadingCatalogs, setIsLoadingCatalogs] = React.useState(true);
  const [catalogError, setCatalogError] = React.useState<string | null>(null);
  const [activeFunds, setActiveFunds] = React.useState<FundView[]>([]);
  const [activeCategories, setActiveCategories] = React.useState<CategoryView[]>([]);
  const loadRequestIdRef = React.useRef(0);

  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [creationResult, setCreationResult] = React.useState<LedgerCreationResult | null>(null);

  const { getOrCreateKey, invalidateKey, rotateKey } = useIdempotencyKey();

  const txForm = useForm<RecordTransactionFormValues>({
    resolver: zodResolver(recordTransactionFormSchema),
    mode: 'onSubmit',
    defaultValues: {
      type: initialMode === 'INCOME' ? 'INCOME' : 'EXPENSE',
      fundId: '',
      amount: '',
      occurredOn: todayLima,
      description: '',
      notes: '',
      allocationMode: 'SINGLE',
      categoryId: '',
      splits: createDefaultSplits(),
    },
  });

  const splitsFieldArray = useFieldArray({
    control: txForm.control,
    name: 'splits',
  });

  const transferForm = useForm<RecordTransferFormValues>({
    resolver: zodResolver(recordTransferFormSchema),
    mode: 'onSubmit',
    defaultValues: {
      sourceFundId: '',
      destinationFundId: '',
      amount: '',
      occurredOn: todayLima,
      description: '',
      notes: '',
    },
  });

  const adjustmentForm = useForm<RecordAdjustmentFormValues>({
    resolver: zodResolver(recordAdjustmentFormSchema),
    mode: 'onSubmit',
    defaultValues: {
      fundId: '',
      direction: 'INCREASE',
      amount: '',
      occurredOn: todayLima,
      description: '',
      notes: '',
    },
  });

  const loadCatalogs = React.useCallback(async () => {
    const requestId = ++loadRequestIdRef.current;
    setIsLoadingCatalogs(true);
    setCatalogError(null);

    try {
      const [fundsRes, categoriesRes] = await Promise.all([
        fundsApi.list({ includeArchived: false }),
        categoriesApi.list({ includeArchived: false }),
      ]);

      if (requestId !== loadRequestIdRef.current) {
        return;
      }

      const validFunds = fundsRes.funds.filter((f) => !f.isArchived);
      const validCategories = categoriesRes.categories.filter((c) => !c.isArchived);

      setActiveFunds(validFunds);
      setActiveCategories(validCategories);

      if (validFunds.length > 0) {
        const trimmedInitialFundId = initialFundId?.trim() ?? '';
        const matchedFund = validFunds.find((f) => f.id === trimmedInitialFundId);
        const defaultFund = matchedFund ?? validFunds[0];

        txForm.setValue('fundId', defaultFund.id);
        adjustmentForm.setValue('fundId', defaultFund.id);
        transferForm.setValue('sourceFundId', defaultFund.id);

        const sameCurrencyDestination = validFunds.find(
          (f) => f.id !== defaultFund.id && f.currency === defaultFund.currency,
        );
        transferForm.setValue('destinationFundId', sameCurrencyDestination?.id ?? '');
      }
    } catch (err) {
      if (requestId !== loadRequestIdRef.current) {
        return;
      }
      setCatalogError(
        getApiErrorMessage(err, 'No se pudieron cargar los fondos y categorías.'),
      );
    } finally {
      if (requestId === loadRequestIdRef.current) {
        setIsLoadingCatalogs(false);
      }
    }
  }, [initialFundId, txForm, transferForm, adjustmentForm]);

  React.useEffect(() => {
    void loadCatalogs();
  }, [loadCatalogs]);

  const handleModeChange = (nextMode: LedgerFormMode): void => {
    if (isSubmitting || nextMode === activeMode) {
      return;
    }

    setSubmitError(null);
    invalidateKey();

    if (nextMode === 'INCOME' || nextMode === 'EXPENSE') {
      const currentTxType = txForm.getValues('type');
      const nextTxType: RecordableTransactionType = nextMode;

      txForm.setValue('type', nextTxType);
      if (currentTxType !== nextTxType) {
        // Reset obligatorio de categoryId y categorías de cada fila de splits al alternar INCOME <-> EXPENSE
        txForm.setValue('categoryId', '');
        const currentSplits = txForm.getValues('splits') ?? [];
        txForm.setValue(
          'splits',
          currentSplits.map((row) => ({
            ...row,
            categoryId: '',
          })),
        );
        txForm.clearErrors(['categoryId', 'splits']);
      }
    }

    setActiveMode(nextMode);
  };

  const handleAllocationModeChange = (nextAllocation: AllocationMode): void => {
    if (isSubmitting) {
      return;
    }
    setSubmitError(null);
    invalidateKey();
    txForm.setValue('allocationMode', nextAllocation);
    txForm.clearErrors(['categoryId', 'splits']);

    if (
      nextAllocation === 'SPLITS' &&
      (txForm.getValues('splits')?.length ?? 0) < 2
    ) {
      txForm.setValue('splits', createDefaultSplits());
    }
  };

  // Valores observados en modo INCOME / EXPENSE
  const watchedTxType = txForm.watch('type');
  const watchedTxFundId = txForm.watch('fundId');
  const watchedTxAmount = txForm.watch('amount') ?? '';
  const watchedAllocationMode = txForm.watch('allocationMode');
  const watchedSplits = txForm.watch('splits') ?? [];

  const selectedTxFund = activeFunds.find((f) => f.id === watchedTxFundId);
  const txCurrency = selectedTxFund?.currency ?? 'PEN';
  const filteredCategories = React.useMemo(
    () => activeCategories.filter((c) => !c.isArchived && c.kind === watchedTxType),
    [activeCategories, watchedTxType],
  );

  const isSplitsBalanced = (() => {
    if (watchedAllocationMode !== 'SPLITS') {
      return true;
    }
    if (!isValidPositiveLedgerAmount(watchedTxAmount)) {
      return false;
    }
    const allRowsValid =
      (watchedSplits?.length ?? 0) >= MIN_SPLITS_COUNT &&
      watchedSplits.every((row) => isValidPositiveLedgerAmount(row?.amount ?? ''));
    if (!allRowsValid) {
      return false;
    }
    const normalizedTotal = normalizeMoney(watchedTxAmount.trim());
    const validRowAmounts = watchedSplits.map((row) => normalizeMoney(row.amount.trim()));
    const splitsSum = sumMoney(validRowAmounts);
    const diff = subMoney(normalizedTotal, splitsSum);
    return isZeroMoney(diff);
  })();

  const estimatedTxBalanceAfter = React.useMemo(() => {
    if (!selectedTxFund || !isValidPositiveLedgerAmount(watchedTxAmount)) {
      return null;
    }
    const normalizedAmt = normalizeMoney(watchedTxAmount.trim());
    return watchedTxType === 'INCOME'
      ? addMoney(selectedTxFund.balance, normalizedAmt)
      : subMoney(selectedTxFund.balance, normalizedAmt);
  }, [selectedTxFund, watchedTxAmount, watchedTxType]);

  const showTxNegativeWarning =
    watchedTxType === 'EXPENSE' &&
    selectedTxFund !== undefined &&
    !selectedTxFund.allowNegativeBalance &&
    estimatedTxBalanceAfter !== null &&
    isNegativeMoney(estimatedTxBalanceAfter);

  // Valores observados en modo TRANSFER
  const watchedSourceFundId = transferForm.watch('sourceFundId');
  const watchedDestinationFundId = transferForm.watch('destinationFundId');
  const watchedTransferAmount = transferForm.watch('amount') ?? '';

  const selectedSourceFund = activeFunds.find((f) => f.id === watchedSourceFundId);
  const availableDestinationFunds = React.useMemo(() => {
    if (!selectedSourceFund) {
      return [];
    }
    return activeFunds.filter(
      (f) => f.id !== selectedSourceFund.id && f.currency === selectedSourceFund.currency,
    );
  }, [activeFunds, selectedSourceFund]);

  const selectedDestinationFund = availableDestinationFunds.find(
    (f) => f.id === watchedDestinationFundId,
  );

  // Si cambia el fondo origen y el destino actual ya no es válido (mismo fondo o distinta moneda), limpiarlo
  React.useEffect(() => {
    if (!selectedSourceFund) {
      return;
    }
    const currentDestId = transferForm.getValues('destinationFundId');
    if (!currentDestId) {
      return;
    }
    const isStillCompatible = availableDestinationFunds.some((f) => f.id === currentDestId);
    if (!isStillCompatible) {
      transferForm.setValue('destinationFundId', '');
    }
  }, [selectedSourceFund, availableDestinationFunds, transferForm]);

  const hasAnySameCurrencyPair = React.useMemo(() => {
    const penCount = activeFunds.filter((f) => f.currency === 'PEN').length;
    const usdCount = activeFunds.filter((f) => f.currency === 'USD').length;
    return penCount >= 2 || usdCount >= 2;
  }, [activeFunds]);

  const estimatedTransferBalances = React.useMemo(() => {
    if (!selectedSourceFund || !isValidPositiveLedgerAmount(watchedTransferAmount)) {
      return null;
    }
    const normalizedAmt = normalizeMoney(watchedTransferAmount.trim());
    const sourceAfter = subMoney(selectedSourceFund.balance, normalizedAmt);
    const destAfter = selectedDestinationFund
      ? addMoney(selectedDestinationFund.balance, normalizedAmt)
      : null;
    return {
      sourceAfter,
      destAfter,
    };
  }, [selectedSourceFund, selectedDestinationFund, watchedTransferAmount]);

  const showTransferNegativeWarning =
    selectedSourceFund !== undefined &&
    !selectedSourceFund.allowNegativeBalance &&
    estimatedTransferBalances !== null &&
    isNegativeMoney(estimatedTransferBalances.sourceAfter);

  // Valores observados en modo ADJUSTMENT
  const watchedAdjFundId = adjustmentForm.watch('fundId');
  const watchedAdjDirection = adjustmentForm.watch('direction');
  const watchedAdjAmount = adjustmentForm.watch('amount') ?? '';

  const selectedAdjFund = activeFunds.find((f) => f.id === watchedAdjFundId);
  const estimatedAdjBalanceAfter = React.useMemo(() => {
    if (!selectedAdjFund || !isValidPositiveLedgerAmount(watchedAdjAmount)) {
      return null;
    }
    const normalizedAmt = normalizeMoney(watchedAdjAmount.trim());
    return watchedAdjDirection === 'INCREASE'
      ? addMoney(selectedAdjFund.balance, normalizedAmt)
      : subMoney(selectedAdjFund.balance, normalizedAmt);
  }, [selectedAdjFund, watchedAdjAmount, watchedAdjDirection]);

  const showAdjNegativeWarning =
    watchedAdjDirection === 'DECREASE' &&
    selectedAdjFund !== undefined &&
    !selectedAdjFund.allowNegativeBalance &&
    estimatedAdjBalanceAfter !== null &&
    isNegativeMoney(estimatedAdjBalanceAfter);

  // Envío Modo 1 y 2: INCOME / EXPENSE
  const onSubmitTransaction = async (values: RecordTransactionFormValues): Promise<void> => {
    if (isSubmitting) {
      return;
    }

    // Defensa extra en cliente: verificar que todas las categorías seleccionadas correspondan al kind actual
    const allowedCategoryIds = new Set(filteredCategories.map((c) => c.id));
    if (values.allocationMode === 'SINGLE') {
      const catId = values.categoryId?.trim() ?? '';
      if (!allowedCategoryIds.has(catId)) {
        txForm.setError('categoryId', {
          type: 'manual',
          message: 'Selecciona una categoría válida para este tipo de movimiento.',
        });
        return;
      }
    } else {
      let hasInvalidCat = false;
      values.splits.forEach((row, idx) => {
        if (!allowedCategoryIds.has(row.categoryId.trim())) {
          txForm.setError(`splits.${idx}.categoryId`, {
            type: 'manual',
            message: 'Selecciona una categoría válida para este tipo de movimiento.',
          });
          hasInvalidCat = true;
        }
      });
      if (hasInvalidCat) {
        return;
      }
    }

    setSubmitError(null);
    setIsSubmitting(true);

    try {
      const payload = buildRecordTransactionPayload(values);
      const fingerprint = buildLedgerPayloadFingerprint(values.type, payload);
      const idempotencyKey = getOrCreateKey(fingerprint);

      const response = await ledgerApi.recordTransaction(payload, { idempotencyKey });
      const targetFund = activeFunds.find((f) => f.id === payload.fundId);

      setActiveFunds((prev) =>
        prev.map((f) =>
          f.id === payload.fundId ? { ...f, balance: response.fundBalanceAfter } : f,
        ),
      );
      setCreationResult({
        kind: 'TRANSACTION',
        response,
        fund: targetFund,
      });
      rotateKey();
    } catch (err) {
      setSubmitError(getApiErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Envío Modo 3: TRANSFER
  const onSubmitTransfer = async (values: RecordTransferFormValues): Promise<void> => {
    if (isSubmitting) {
      return;
    }

    const source = activeFunds.find((f) => f.id === values.sourceFundId);
    const dest = activeFunds.find((f) => f.id === values.destinationFundId);

    if (!source || !dest || source.currency !== dest.currency) {
      transferForm.setError('destinationFundId', {
        type: 'manual',
        message: 'Ambos fondos deben estar activos y tener la misma moneda.',
      });
      return;
    }

    setSubmitError(null);
    setIsSubmitting(true);

    try {
      const payload = buildRecordTransferPayload(values);
      const fingerprint = buildLedgerPayloadFingerprint('TRANSFER', payload);
      const idempotencyKey = getOrCreateKey(fingerprint);

      const response = await ledgerApi.recordTransfer(payload, { idempotencyKey });

      setActiveFunds((prev) =>
        prev.map((f) => {
          if (f.id === payload.sourceFundId) {
            return { ...f, balance: response.sourceFundBalanceAfter };
          }
          if (f.id === payload.destinationFundId) {
            return { ...f, balance: response.destinationFundBalanceAfter };
          }
          return f;
        }),
      );
      setCreationResult({
        kind: 'TRANSFER',
        response,
        sourceFund: source,
        destinationFund: dest,
      });
      rotateKey();
    } catch (err) {
      setSubmitError(getApiErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Envío Modo 4: ADJUSTMENT
  const onSubmitAdjustment = async (values: RecordAdjustmentFormValues): Promise<void> => {
    if (isSubmitting) {
      return;
    }

    setSubmitError(null);
    setIsSubmitting(true);

    try {
      const payload = buildRecordAdjustmentPayload(values);
      const fingerprint = buildLedgerPayloadFingerprint('ADJUSTMENT', payload);
      const idempotencyKey = getOrCreateKey(fingerprint);

      const response = await ledgerApi.recordAdjustment(payload, { idempotencyKey });
      const targetFund = activeFunds.find((f) => f.id === payload.fundId);

      setActiveFunds((prev) =>
        prev.map((f) =>
          f.id === payload.fundId ? { ...f, balance: response.fundBalanceAfter } : f,
        ),
      );
      setCreationResult({
        kind: 'ADJUSTMENT',
        response,
        fund: targetFund,
        direction: payload.direction,
      });
      rotateKey();
    } catch (err) {
      setSubmitError(getApiErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRecordAnother = (): void => {
    setCreationResult(null);
    setSubmitError(null);
    rotateKey();

    const currentTxFundId = txForm.getValues('fundId');
    const currentTxType = txForm.getValues('type');
    txForm.reset({
      type: currentTxType,
      fundId: currentTxFundId,
      amount: '',
      occurredOn: todayLima,
      description: '',
      notes: '',
      allocationMode: 'SINGLE',
      categoryId: '',
      splits: createDefaultSplits(),
    });

    const currentSourceId = transferForm.getValues('sourceFundId');
    const currentDestId = transferForm.getValues('destinationFundId');
    transferForm.reset({
      sourceFundId: currentSourceId,
      destinationFundId: currentDestId,
      amount: '',
      occurredOn: todayLima,
      description: '',
      notes: '',
    });

    const currentAdjFundId = adjustmentForm.getValues('fundId');
    adjustmentForm.reset({
      fundId: currentAdjFundId,
      direction: 'INCREASE',
      amount: '',
      occurredOn: todayLima,
      description: '',
      notes: '',
    });
  };

  if (isLoadingCatalogs) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 p-8 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin text-accent" />
          <span>Cargando fondos y categorías...</span>
        </CardContent>
      </Card>
    );
  }

  if (catalogError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No se pudo cargar el formulario</CardTitle>
          <CardDescription>
            Verifica tu conexión e intenta cargar nuevamente los catálogos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error al cargar datos</AlertTitle>
            <AlertDescription>{catalogError}</AlertDescription>
          </Alert>
          <Button type="button" onClick={() => void loadCatalogs()}>
            Reintentar carga
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (activeFunds.length === 0) {
    return (
      <Card data-testid="empty-funds-guided-state">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-accent" />
            <span>Necesitas al menos un fondo activo</span>
          </CardTitle>
          <CardDescription>
            Para registrar ingresos, gastos, transferencias o ajustes primero debes crear un fondo
            activo en Soles (PEN) o Dólares (USD).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/funds"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Wallet className="h-4 w-4" />
            Ir a Fondos
          </Link>
        </CardContent>
      </Card>
    );
  }

  if (creationResult !== null) {
    return (
      <TransactionSuccessCard
        result={creationResult}
        onRecordAnother={handleRecordAnother}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Selector de los 4 modos primarios del ledger */}
      <div
        role="tablist"
        aria-label="Modo de registro contable"
        className="grid gap-2 sm:grid-cols-4"
      >
        {MODE_OPTIONS.map((option) => {
          const Icon = option.icon;
          const isSelected = activeMode === option.mode;
          return (
            <button
              key={option.mode}
              type="button"
              role="tab"
              aria-selected={isSelected}
              disabled={isSubmitting}
              onClick={() => handleModeChange(option.mode)}
              className={`flex flex-col items-start gap-1 rounded-xl border p-3.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 ${
                isSelected
                  ? 'border-primary bg-primary/10 text-foreground shadow-sm'
                  : 'border-border bg-card text-muted-foreground hover:bg-accent/50 hover:text-foreground'
              }`}
            >
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Icon className="h-4 w-4" />
                <span>{option.label}</span>
              </div>
              <span className="text-xs text-muted-foreground">{option.description}</span>
            </button>
          );
        })}
      </div>

      {submitError && (
        <Alert variant="destructive" data-testid="ledger-submit-error">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No se pudo registrar el movimiento</AlertTitle>
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      )}

      {/* Modo 1 y 2: INCOME / EXPENSE */}
      {(activeMode === 'INCOME' || activeMode === 'EXPENSE') && (
        <Card>
          <CardHeader>
            <CardTitle>
              {activeMode === 'INCOME' ? 'Registrar ingreso' : 'Registrar egreso'}
            </CardTitle>
            <CardDescription>
              {activeMode === 'INCOME'
                ? 'Acredita un ingreso en un fondo activo con categoría única o desglose en splits.'
                : 'Debita un gasto de un fondo activo con categoría única o desglose en splits.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={txForm.handleSubmit(onSubmitTransaction)}
              noValidate
              className="space-y-5"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="tx-fundId">Fondo</Label>
                  <select
                    id="tx-fundId"
                    disabled={isSubmitting}
                    aria-invalid={Boolean(txForm.formState.errors.fundId)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    {...txForm.register('fundId')}
                  >
                    {activeFunds.map((fund) => (
                      <option key={fund.id} value={fund.id}>
                        {fund.name} ({fund.currency} · {formatCurrency(fund.balance, fund.currency)})
                      </option>
                    ))}
                  </select>
                  {txForm.formState.errors.fundId && (
                    <p role="alert" className="text-xs text-destructive">
                      {txForm.formState.errors.fundId.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="tx-amount">Monto ({txCurrency})</Label>
                  <Input
                    id="tx-amount"
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    disabled={isSubmitting}
                    aria-invalid={Boolean(txForm.formState.errors.amount)}
                    {...txForm.register('amount')}
                  />
                  {txForm.formState.errors.amount && (
                    <p role="alert" className="text-xs text-destructive">
                      {txForm.formState.errors.amount.message}
                    </p>
                  )}
                </div>
              </div>

              {selectedTxFund && estimatedTxBalanceAfter !== null && (
                <div
                  data-testid="tx-balance-preview"
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 px-4 py-2.5 text-xs"
                >
                  <span className="text-muted-foreground">
                    Saldo actual en <strong>{selectedTxFund.name}</strong>:{' '}
                    {formatCurrency(selectedTxFund.balance, selectedTxFund.currency)}
                  </span>
                  <span className="font-semibold text-foreground">
                    Saldo estimado post-operación:{' '}
                    {formatCurrency(estimatedTxBalanceAfter, selectedTxFund.currency)}
                  </span>
                </div>
              )}

              {showTxNegativeWarning && selectedTxFund && estimatedTxBalanceAfter && (
                <Alert variant="warning" data-testid="tx-negative-balance-warning">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Saldo insuficiente en fondo</AlertTitle>
                  <AlertDescription>
                    El fondo <strong>{selectedTxFund.name}</strong> no permite saldo negativo y
                    quedaría en{' '}
                    <strong>
                      {formatCurrency(estimatedTxBalanceAfter, selectedTxFund.currency)}
                    </strong>
                    .
                  </AlertDescription>
                </Alert>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="tx-occurredOn">Fecha de operación (America/Lima)</Label>
                  <Input
                    id="tx-occurredOn"
                    type="date"
                    disabled={isSubmitting}
                    aria-invalid={Boolean(txForm.formState.errors.occurredOn)}
                    {...txForm.register('occurredOn')}
                  />
                  {txForm.formState.errors.occurredOn && (
                    <p role="alert" className="text-xs text-destructive">
                      {txForm.formState.errors.occurredOn.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="tx-description">Descripción</Label>
                  <Input
                    id="tx-description"
                    type="text"
                    maxLength={DESCRIPTION_MAX_LENGTH}
                    placeholder="Ej. Compra supermercado"
                    disabled={isSubmitting}
                    aria-invalid={Boolean(txForm.formState.errors.description)}
                    {...txForm.register('description')}
                  />
                  {txForm.formState.errors.description && (
                    <p role="alert" className="text-xs text-destructive">
                      {txForm.formState.errors.description.message}
                    </p>
                  )}
                </div>
              </div>

              {/* Selector XOR: Categoría única vs Splits */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label>Asignación de categoría</Label>
                  <div className="inline-flex rounded-lg border border-border bg-muted/40 p-1">
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleAllocationModeChange('SINGLE')}
                      className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                        watchedAllocationMode === 'SINGLE'
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Categoría única
                    </button>
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleAllocationModeChange('SPLITS')}
                      className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                        watchedAllocationMode === 'SPLITS'
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Dividir en splits
                    </button>
                  </div>
                </div>

                {watchedAllocationMode === 'SINGLE' ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="tx-categoryId">
                      Categoría ({watchedTxType === 'INCOME' ? 'Ingresos' : 'Egresos'})
                    </Label>
                    <select
                      id="tx-categoryId"
                      disabled={isSubmitting}
                      aria-invalid={Boolean(txForm.formState.errors.categoryId)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                      {...txForm.register('categoryId')}
                    >
                      <option value="">Selecciona una categoría...</option>
                      {filteredCategories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                    {txForm.formState.errors.categoryId && (
                      <p role="alert" className="text-xs text-destructive">
                        {txForm.formState.errors.categoryId.message}
                      </p>
                    )}
                  </div>
                ) : (
                  <TransactionSplitsEditor
                    fields={splitsFieldArray.fields}
                    watchedSplits={watchedSplits}
                    totalAmount={watchedTxAmount}
                    currency={txCurrency}
                    availableCategories={filteredCategories}
                    register={txForm.register}
                    errors={txForm.formState.errors}
                    disabled={isSubmitting}
                    onAddSplit={() => {
                      invalidateKey();
                      splitsFieldArray.append({ categoryId: '', amount: '', note: '' });
                    }}
                    onRemoveSplit={(idx) => {
                      invalidateKey();
                      splitsFieldArray.remove(idx);
                    }}
                  />
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="tx-notes">Notas adicionales (opcional)</Label>
                <Input
                  id="tx-notes"
                  type="text"
                  maxLength={NOTES_MAX_LENGTH}
                  placeholder="Observaciones o referencia del comprobante"
                  disabled={isSubmitting}
                  aria-invalid={Boolean(txForm.formState.errors.notes)}
                  {...txForm.register('notes')}
                />
                {txForm.formState.errors.notes && (
                  <p role="alert" className="text-xs text-destructive">
                    {txForm.formState.errors.notes.message}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                disabled={
                  isSubmitting ||
                  (watchedAllocationMode === 'SPLITS' && !isSplitsBalanced)
                }
                className="w-full gap-2 sm:w-auto"
              >
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {activeMode === 'INCOME' ? 'Guardar ingreso' : 'Guardar egreso'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Modo 3: TRANSFER */}
      {activeMode === 'TRANSFER' && (
        <Card>
          <CardHeader>
            <CardTitle>Registrar transferencia entre fondos</CardTitle>
            <CardDescription>
              Traspasa saldo entre dos fondos activos que compartan la misma moneda. El efecto neto
              en tu patrimonio es cero.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {activeFunds.length < 2 || !hasAnySameCurrencyPair ? (
              <Alert variant="warning" data-testid="transfer-insufficient-funds-warning">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Se requieren al menos 2 fondos activos de la misma moneda</AlertTitle>
                <AlertDescription className="space-y-2">
                  <p>
                    Las transferencias solo pueden realizarse entre dos fondos activos con la misma
                    moneda (PEN → PEN o USD → USD).
                  </p>
                  <Link
                    href="/funds"
                    className="inline-block font-semibold underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Administrar fondos
                  </Link>
                </AlertDescription>
              </Alert>
            ) : null}

            <form
              onSubmit={transferForm.handleSubmit(onSubmitTransfer)}
              noValidate
              className="space-y-5"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="transfer-sourceFundId">Fondo de origen</Label>
                  <select
                    id="transfer-sourceFundId"
                    disabled={isSubmitting}
                    aria-invalid={Boolean(transferForm.formState.errors.sourceFundId)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    {...transferForm.register('sourceFundId')}
                  >
                    {activeFunds.map((fund) => (
                      <option key={fund.id} value={fund.id}>
                        {fund.name} ({fund.currency} · {formatCurrency(fund.balance, fund.currency)})
                      </option>
                    ))}
                  </select>
                  {transferForm.formState.errors.sourceFundId && (
                    <p role="alert" className="text-xs text-destructive">
                      {transferForm.formState.errors.sourceFundId.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="transfer-destinationFundId">
                    Fondo de destino ({selectedSourceFund?.currency ?? 'PEN'})
                  </Label>
                  <select
                    id="transfer-destinationFundId"
                    disabled={isSubmitting || availableDestinationFunds.length === 0}
                    aria-invalid={Boolean(transferForm.formState.errors.destinationFundId)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    {...transferForm.register('destinationFundId')}
                  >
                    <option value="">Selecciona fondo destino...</option>
                    {availableDestinationFunds.map((fund) => (
                      <option key={fund.id} value={fund.id}>
                        {fund.name} ({fund.currency} · {formatCurrency(fund.balance, fund.currency)})
                      </option>
                    ))}
                  </select>
                  {availableDestinationFunds.length === 0 && selectedSourceFund && (
                    <p role="alert" className="text-xs text-muted-foreground">
                      No hay otro fondo activo en {selectedSourceFund.currency} disponible como
                      destino.
                    </p>
                  )}
                  {transferForm.formState.errors.destinationFundId && (
                    <p role="alert" className="text-xs text-destructive">
                      {transferForm.formState.errors.destinationFundId.message}
                    </p>
                  )}
                </div>
              </div>

              {selectedSourceFund && estimatedTransferBalances !== null && (
                <div
                  data-testid="transfer-balance-preview"
                  className="grid gap-3 rounded-lg border border-border bg-muted/30 p-3 text-xs sm:grid-cols-2"
                >
                  <div>
                    <p className="text-muted-foreground">
                      Saldo estimado origen ({selectedSourceFund.name})
                    </p>
                    <p
                      data-testid="transfer-estimated-source-after"
                      className="mt-0.5 text-sm font-semibold text-foreground"
                    >
                      {formatCurrency(
                        estimatedTransferBalances.sourceAfter,
                        selectedSourceFund.currency,
                      )}
                    </p>
                  </div>
                  {selectedDestinationFund && estimatedTransferBalances.destAfter !== null && (
                    <div>
                      <p className="text-muted-foreground">
                        Saldo estimado destino ({selectedDestinationFund.name})
                      </p>
                      <p
                        data-testid="transfer-estimated-dest-after"
                        className="mt-0.5 text-sm font-semibold text-foreground"
                      >
                        {formatCurrency(
                          estimatedTransferBalances.destAfter,
                          selectedDestinationFund.currency,
                        )}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {showTransferNegativeWarning &&
                selectedSourceFund &&
                estimatedTransferBalances && (
                  <Alert variant="warning" data-testid="transfer-negative-balance-warning">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Saldo insuficiente en fondo origen</AlertTitle>
                    <AlertDescription>
                      El fondo origen <strong>{selectedSourceFund.name}</strong> no permite saldo
                      negativo y quedaría en{' '}
                      <strong>
                        {formatCurrency(
                          estimatedTransferBalances.sourceAfter,
                          selectedSourceFund.currency,
                        )}
                      </strong>
                      .
                    </AlertDescription>
                  </Alert>
                )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="transfer-amount">
                    Monto ({selectedSourceFund?.currency ?? 'PEN'})
                  </Label>
                  <Input
                    id="transfer-amount"
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    disabled={isSubmitting}
                    aria-invalid={Boolean(transferForm.formState.errors.amount)}
                    {...transferForm.register('amount')}
                  />
                  {transferForm.formState.errors.amount && (
                    <p role="alert" className="text-xs text-destructive">
                      {transferForm.formState.errors.amount.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="transfer-occurredOn">Fecha de operación (America/Lima)</Label>
                  <Input
                    id="transfer-occurredOn"
                    type="date"
                    disabled={isSubmitting}
                    aria-invalid={Boolean(transferForm.formState.errors.occurredOn)}
                    {...transferForm.register('occurredOn')}
                  />
                  {transferForm.formState.errors.occurredOn && (
                    <p role="alert" className="text-xs text-destructive">
                      {transferForm.formState.errors.occurredOn.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="transfer-description">Descripción</Label>
                <Input
                  id="transfer-description"
                  type="text"
                  maxLength={DESCRIPTION_MAX_LENGTH}
                  placeholder="Ej. Traspaso a billetera diaria"
                  disabled={isSubmitting}
                  aria-invalid={Boolean(transferForm.formState.errors.description)}
                  {...transferForm.register('description')}
                />
                {transferForm.formState.errors.description && (
                  <p role="alert" className="text-xs text-destructive">
                    {transferForm.formState.errors.description.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="transfer-notes">Notas adicionales (opcional)</Label>
                <Input
                  id="transfer-notes"
                  type="text"
                  maxLength={NOTES_MAX_LENGTH}
                  placeholder="Número de operación o detalle"
                  disabled={isSubmitting}
                  aria-invalid={Boolean(transferForm.formState.errors.notes)}
                  {...transferForm.register('notes')}
                />
                {transferForm.formState.errors.notes && (
                  <p role="alert" className="text-xs text-destructive">
                    {transferForm.formState.errors.notes.message}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                disabled={isSubmitting || availableDestinationFunds.length === 0}
                className="w-full gap-2 sm:w-auto"
              >
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Guardar transferencia
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Modo 4: ADJUSTMENT */}
      {activeMode === 'ADJUSTMENT' && (
        <Card>
          <CardHeader>
            <CardTitle>Registrar ajuste manual de saldo</CardTitle>
            <CardDescription>
              Aumenta o disminuye el saldo de un fondo para cuadrar diferencias o arqueos sin
              afectar tus reportes de ingresos y gastos por categoría.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={adjustmentForm.handleSubmit(onSubmitAdjustment)}
              noValidate
              className="space-y-5"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="adj-fundId">Fondo</Label>
                  <select
                    id="adj-fundId"
                    disabled={isSubmitting}
                    aria-invalid={Boolean(adjustmentForm.formState.errors.fundId)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    {...adjustmentForm.register('fundId')}
                  >
                    {activeFunds.map((fund) => (
                      <option key={fund.id} value={fund.id}>
                        {fund.name} ({fund.currency} · {formatCurrency(fund.balance, fund.currency)})
                      </option>
                    ))}
                  </select>
                  {adjustmentForm.formState.errors.fundId && (
                    <p role="alert" className="text-xs text-destructive">
                      {adjustmentForm.formState.errors.fundId.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="adj-direction">Dirección del ajuste</Label>
                  <select
                    id="adj-direction"
                    disabled={isSubmitting}
                    aria-invalid={Boolean(adjustmentForm.formState.errors.direction)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    {...adjustmentForm.register('direction')}
                  >
                    <option value="INCREASE">Aumentar saldo (+)</option>
                    <option value="DECREASE">Disminuir saldo (-)</option>
                  </select>
                  {adjustmentForm.formState.errors.direction && (
                    <p role="alert" className="text-xs text-destructive">
                      {adjustmentForm.formState.errors.direction.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="adj-amount">
                    Monto del ajuste ({selectedAdjFund?.currency ?? 'PEN'})
                  </Label>
                  <Input
                    id="adj-amount"
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    disabled={isSubmitting}
                    aria-invalid={Boolean(adjustmentForm.formState.errors.amount)}
                    {...adjustmentForm.register('amount')}
                  />
                  {adjustmentForm.formState.errors.amount && (
                    <p role="alert" className="text-xs text-destructive">
                      {adjustmentForm.formState.errors.amount.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="adj-occurredOn">Fecha de operación (America/Lima)</Label>
                  <Input
                    id="adj-occurredOn"
                    type="date"
                    disabled={isSubmitting}
                    aria-invalid={Boolean(adjustmentForm.formState.errors.occurredOn)}
                    {...adjustmentForm.register('occurredOn')}
                  />
                  {adjustmentForm.formState.errors.occurredOn && (
                    <p role="alert" className="text-xs text-destructive">
                      {adjustmentForm.formState.errors.occurredOn.message}
                    </p>
                  )}
                </div>
              </div>

              {selectedAdjFund && estimatedAdjBalanceAfter !== null && (
                <div
                  data-testid="adj-balance-preview"
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 px-4 py-2.5 text-xs"
                >
                  <span className="text-muted-foreground">
                    Saldo actual en <strong>{selectedAdjFund.name}</strong>:{' '}
                    {formatCurrency(selectedAdjFund.balance, selectedAdjFund.currency)}
                  </span>
                  <span
                    data-testid="adj-estimated-balance-after"
                    className="font-semibold text-foreground"
                  >
                    Saldo estimado post-ajuste:{' '}
                    {formatCurrency(estimatedAdjBalanceAfter, selectedAdjFund.currency)}
                  </span>
                </div>
              )}

              {showAdjNegativeWarning && selectedAdjFund && estimatedAdjBalanceAfter && (
                <Alert variant="warning" data-testid="adj-negative-balance-warning">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Saldo insuficiente para disminuir</AlertTitle>
                  <AlertDescription>
                    El fondo <strong>{selectedAdjFund.name}</strong> no permite saldo negativo y
                    quedaría en{' '}
                    <strong>
                      {formatCurrency(estimatedAdjBalanceAfter, selectedAdjFund.currency)}
                    </strong>
                    .
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="adj-description">Motivo / Descripción</Label>
                <Input
                  id="adj-description"
                  type="text"
                  maxLength={DESCRIPTION_MAX_LENGTH}
                  placeholder="Ej. Cuadre de arqueo de efectivo"
                  disabled={isSubmitting}
                  aria-invalid={Boolean(adjustmentForm.formState.errors.description)}
                  {...adjustmentForm.register('description')}
                />
                {adjustmentForm.formState.errors.description && (
                  <p role="alert" className="text-xs text-destructive">
                    {adjustmentForm.formState.errors.description.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="adj-notes">Notas adicionales (opcional)</Label>
                <Input
                  id="adj-notes"
                  type="text"
                  maxLength={NOTES_MAX_LENGTH}
                  placeholder="Detalle adicional del arqueo"
                  disabled={isSubmitting}
                  aria-invalid={Boolean(adjustmentForm.formState.errors.notes)}
                  {...adjustmentForm.register('notes')}
                />
                {adjustmentForm.formState.errors.notes && (
                  <p role="alert" className="text-xs text-destructive">
                    {adjustmentForm.formState.errors.notes.message}
                  </p>
                )}
              </div>

              <Button type="submit" disabled={isSubmitting} className="w-full gap-2 sm:w-auto">
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Guardar ajuste
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

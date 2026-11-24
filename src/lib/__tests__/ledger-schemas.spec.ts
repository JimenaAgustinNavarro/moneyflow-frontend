import { describe, expect, it } from 'vitest';
import {
  buildLedgerPayloadFingerprint,
  buildRecordAdjustmentPayload,
  buildRecordTransactionPayload,
  buildRecordTransferPayload,
  buildRefundPayloadFingerprint,
  buildRefundTransactionPayload,
  buildTransactionsUrlSearchParams,
  buildVoidPayloadFingerprint,
  buildVoidTransactionPayload,
  canRefundTransaction,
  canVoidTransaction,
  createRefundTransactionFormSchema,
  createVoidTransactionFormSchema,
  isValidPositiveLedgerAmount,
  parseInitialLedgerMode,
  parseTransactionsSearchParams,
  recordAdjustmentFormSchema,
  recordTransactionFormSchema,
  recordTransferFormSchema,
  validateTransactionDateRange,
} from '@/lib/ledger-schemas';

describe('ledger-schemas', () => {
  describe('parseInitialLedgerMode', () => {
    it('resuelve modos válidos e ignora valores inválidos con default EXPENSE', () => {
      expect(parseInitialLedgerMode('INCOME')).toBe('INCOME');
      expect(parseInitialLedgerMode('  expense ')).toBe('EXPENSE');
      expect(parseInitialLedgerMode('transfer')).toBe('TRANSFER');
      expect(parseInitialLedgerMode('ADJUSTMENT')).toBe('ADJUSTMENT');
      expect(parseInitialLedgerMode('INVALID')).toBe('EXPENSE');
      expect(parseInitialLedgerMode(null)).toBe('EXPENSE');
      expect(parseInitialLedgerMode(undefined)).toBe('EXPENSE');
    });
  });

  describe('isValidPositiveLedgerAmount', () => {
    it('acepta decimales positivos dentro de DECIMAL(14,2) y rechaza 0.00, negativos, >2 decimales o >999999999999.99', () => {
      expect(isValidPositiveLedgerAmount('0.01')).toBe(true);
      expect(isValidPositiveLedgerAmount('45')).toBe(true);
      expect(isValidPositiveLedgerAmount('1250.5')).toBe(true);
      expect(isValidPositiveLedgerAmount('999999999999.99')).toBe(true);

      expect(isValidPositiveLedgerAmount('0')).toBe(false);
      expect(isValidPositiveLedgerAmount('0.00')).toBe(false);
      expect(isValidPositiveLedgerAmount('-10.00')).toBe(false);
      expect(isValidPositiveLedgerAmount('10.123')).toBe(false);
      expect(isValidPositiveLedgerAmount('1000000000000.00')).toBe(false);
      expect(isValidPositiveLedgerAmount('1e5')).toBe(false);
      expect(isValidPositiveLedgerAmount('')).toBe(false);
    });
  });

  describe('recordTransactionFormSchema y buildRecordTransactionPayload', () => {
    it('valida categoría única y omite splits en el payload HTTP (forbidNonWhitelisted)', () => {
      const formValues = {
        type: 'EXPENSE' as const,
        fundId: '44444444-4444-4444-8444-444444444444',
        amount: ' 45.5 ',
        occurredOn: '2026-11-22',
        description: '  Almuerzo ejecutivo  ',
        notes: '   ',
        allocationMode: 'SINGLE' as const,
        categoryId: '11111111-1111-4111-8111-111111111111',
        splits: [
          { categoryId: '', amount: '', note: '' },
          { categoryId: '', amount: '', note: '' },
        ],
      };

      const parsed = recordTransactionFormSchema.safeParse(formValues);
      expect(parsed.success).toBe(true);

      const payload = buildRecordTransactionPayload(formValues);
      expect(payload).toEqual({
        type: 'EXPENSE',
        fundId: '44444444-4444-4444-8444-444444444444',
        amount: '45.50',
        occurredOn: '2026-11-22',
        description: 'Almuerzo ejecutivo',
        categoryId: '11111111-1111-4111-8111-111111111111',
      });
      expect('splits' in payload).toBe(false);
      expect('notes' in payload).toBe(false);
    });

    it('valida splits cuadrados y omite categoryId en el payload HTTP', () => {
      const formValues = {
        type: 'EXPENSE' as const,
        fundId: '44444444-4444-4444-8444-444444444444',
        amount: '100',
        occurredOn: '2026-11-22',
        description: 'Supermercado mensual',
        notes: ' Con factura ',
        allocationMode: 'SPLITS' as const,
        categoryId: '11111111-1111-4111-8111-111111111111',
        splits: [
          {
            categoryId: '11111111-1111-4111-8111-111111111111',
            amount: '33.33',
            note: ' Alimentos ',
          },
          {
            categoryId: '22222222-2222-4222-8222-222222222222',
            amount: '33.33',
            note: '   ',
          },
          {
            categoryId: '33333333-3333-4333-8333-333333333333',
            amount: '33.34',
            note: 'Limpieza',
          },
        ],
      };

      const parsed = recordTransactionFormSchema.safeParse(formValues);
      expect(parsed.success).toBe(true);

      const payload = buildRecordTransactionPayload(formValues);
      expect(payload).toEqual({
        type: 'EXPENSE',
        fundId: '44444444-4444-4444-8444-444444444444',
        amount: '100.00',
        occurredOn: '2026-11-22',
        description: 'Supermercado mensual',
        notes: 'Con factura',
        splits: [
          {
            categoryId: '11111111-1111-4111-8111-111111111111',
            amount: '33.33',
            note: 'Alimentos',
          },
          {
            categoryId: '22222222-2222-4222-8222-222222222222',
            amount: '33.33',
          },
          {
            categoryId: '33333333-3333-4333-8333-333333333333',
            amount: '33.34',
            note: 'Limpieza',
          },
        ],
      });
      expect('categoryId' in payload).toBe(false);
    });

    it('rechaza descuadre de 0.01 en splits ("100.00" vs ["33.33", "33.33", "33.33"])', () => {
      const parsed = recordTransactionFormSchema.safeParse({
        type: 'EXPENSE',
        fundId: '44444444-4444-4444-8444-444444444444',
        amount: '100.00',
        occurredOn: '2026-11-22',
        description: 'Compra dividida con descuadre',
        allocationMode: 'SPLITS',
        categoryId: '',
        splits: [
          { categoryId: 'cat-1', amount: '33.33', note: '' },
          { categoryId: 'cat-2', amount: '33.33', note: '' },
          { categoryId: 'cat-3', amount: '33.33', note: '' },
        ],
      });

      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        const messages = parsed.error.issues.map((i) => i.message).join(' ');
        expect(messages).toContain('0.01');
      }
    });

    it('rechaza fechas gregorianas inválidas como 2026-02-31 o 2026-02-29', () => {
      const parsed = recordTransactionFormSchema.safeParse({
        type: 'INCOME',
        fundId: '44444444-4444-4444-8444-444444444444',
        amount: '150.00',
        occurredOn: '2026-02-31',
        description: 'Sueldo',
        allocationMode: 'SINGLE',
        categoryId: 'cat-1',
        splits: [],
      });

      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues[0].message).toMatch(/fecha calendario válida/i);
      }
    });
  });

  describe('recordTransferFormSchema y recordAdjustmentFormSchema', () => {
    it('rechaza transferencia donde sourceFundId y destinationFundId son iguales', () => {
      const sameFundResult = recordTransferFormSchema.safeParse({
        sourceFundId: '44444444-4444-4444-8444-444444444444',
        destinationFundId: '44444444-4444-4444-8444-444444444444',
        amount: '50.00',
        occurredOn: '2026-11-22',
        description: 'Traspaso inválido',
      });
      expect(sameFundResult.success).toBe(false);

      const validTransfer = buildRecordTransferPayload({
        sourceFundId: 'fund-a',
        destinationFundId: 'fund-b',
        amount: '250',
        occurredOn: '2026-11-22',
        description: ' Traspaso ahorro ',
        notes: '',
      });
      expect(validTransfer).toEqual({
        sourceFundId: 'fund-a',
        destinationFundId: 'fund-b',
        amount: '250.00',
        occurredOn: '2026-11-22',
        description: 'Traspaso ahorro',
      });
    });

    it('valida y construye payload de ajuste manual y fingerprint determinista', () => {
      const adjValues = {
        fundId: 'fund-a',
        direction: 'DECREASE' as const,
        amount: '15.5',
        occurredOn: '2026-11-22',
        description: ' Arqueo de caja ',
        notes: ' Falta moneda ',
      };
      expect(recordAdjustmentFormSchema.safeParse(adjValues).success).toBe(true);

      const payload = buildRecordAdjustmentPayload(adjValues);
      expect(payload).toEqual({
        fundId: 'fund-a',
        direction: 'DECREASE',
        amount: '15.50',
        occurredOn: '2026-11-22',
        description: 'Arqueo de caja',
        notes: 'Falta moneda',
      });

      const fp1 = buildLedgerPayloadFingerprint('ADJUSTMENT', payload);
      const fp2 = buildLedgerPayloadFingerprint('ADJUSTMENT', { ...payload });
      const fp3 = buildLedgerPayloadFingerprint('ADJUSTMENT', { ...payload, amount: '16.00' });
      expect(fp1).toBe(fp2);
      expect(fp1).not.toBe(fp3);
    });
  });

  describe('MF-021: parseTransactionsSearchParams, validateTransactionDateRange y elegibilidad', () => {
    it('sanitiza searchParams malformados en URL de forma segura', () => {
      const params = new URLSearchParams(
        'page=abc&limit=999&fundId=not-a-uuid&categoryId=123&type=INVALID&status=UNKNOWN&currency=EUR&search=' +
          'x'.repeat(120),
      );
      const parsed = parseTransactionsSearchParams(params);

      expect(parsed.filters.page).toBe(1);
      expect(parsed.filters.limit).toBe(100);
      expect(parsed.filters.fundId).toBeUndefined();
      expect(parsed.filters.categoryId).toBeUndefined();
      expect(parsed.filters.type).toBeUndefined();
      expect(parsed.filters.status).toBeUndefined();
      expect(parsed.filters.currency).toBeUndefined();
      expect(parsed.filters.search).toHaveLength(100);
      expect(parsed.dateError).toBeNull();
    });

    it('detecta fechas gregorianas inválidas y rangos fromDate > toDate', () => {
      expect(validateTransactionDateRange('2026-02-31', '')).toMatch(/fecha calendario válida/i);
      expect(validateTransactionDateRange('', '2026-02-29')).toMatch(/fecha calendario válida/i);
      expect(validateTransactionDateRange('2026-11-25', '2026-11-20')).toMatch(
        /no puede ser posterior/i,
      );
      expect(validateTransactionDateRange('2026-11-20', '2026-11-20')).toBeNull();

      const parsedInverted = parseTransactionsSearchParams(
        new URLSearchParams('fromDate=2026-11-25&toDate=2026-11-20'),
      );
      expect(parsedInverted.dateError).toMatch(/no puede ser posterior/i);
      expect(parsedInverted.hasActiveFilters).toBe(true);

      const serialized = buildTransactionsUrlSearchParams({
        page: 1,
        limit: 20,
        type: 'EXPENSE',
        currency: 'PEN',
      });
      expect(serialized.toString()).toBe('type=EXPENSE&currency=PEN');
    });

    it('aplica visibilidad estricta de canVoidTransaction y canRefundTransaction', () => {
      expect(canVoidTransaction({ type: 'INCOME', status: 'POSTED' })).toBe(true);
      expect(canVoidTransaction({ type: 'EXPENSE', status: 'POSTED' })).toBe(true);
      expect(canVoidTransaction({ type: 'TRANSFER', status: 'POSTED' })).toBe(true);
      expect(canVoidTransaction({ type: 'ADJUSTMENT', status: 'POSTED' })).toBe(true);
      expect(canVoidTransaction({ type: 'VOID', status: 'POSTED' })).toBe(false);
      expect(canVoidTransaction({ type: 'REFUND', status: 'POSTED' })).toBe(false);
      expect(canVoidTransaction({ type: 'EXPENSE', status: 'VOIDED' })).toBe(false);

      expect(canRefundTransaction({ type: 'EXPENSE', status: 'POSTED' })).toBe(true);
      expect(canRefundTransaction({ type: 'EXPENSE', status: 'VOIDED' })).toBe(false);
      expect(canRefundTransaction({ type: 'INCOME', status: 'POSTED' })).toBe(false);
      expect(canRefundTransaction({ type: 'TRANSFER', status: 'POSTED' })).toBe(false);
      expect(canRefundTransaction({ type: 'ADJUSTMENT', status: 'POSTED' })).toBe(false);
      expect(canRefundTransaction({ type: 'VOID', status: 'POSTED' })).toBe(false);
      expect(canRefundTransaction({ type: 'REFUND', status: 'POSTED' })).toBe(false);
    });
  });

  describe('MF-021: voidTransactionFormSchema y refundTransactionFormSchema', () => {
    it('valida fecha >= original.occurredOn en VOID y omite reason/notes vacíos en el payload', () => {
      const schema = createVoidTransactionFormSchema('2026-11-20');

      const invalidDate = schema.safeParse({
        reason: '',
        occurredOn: '2026-11-19',
        notes: '',
      });
      expect(invalidDate.success).toBe(false);
      if (!invalidDate.success) {
        expect(invalidDate.error.issues[0].message).toMatch(/no puede ser anterior/i);
      }

      const valid = schema.safeParse({
        reason: '   ',
        occurredOn: '2026-11-20',
        notes: '   ',
      });
      expect(valid.success).toBe(true);

      const payload = buildVoidTransactionPayload({
        reason: '   ',
        occurredOn: '2026-11-20',
        notes: '   ',
      });
      expect(payload).toEqual({ occurredOn: '2026-11-20' });
      expect('reason' in payload).toBe(false);
      expect('notes' in payload).toBe(false);

      const fp1 = buildVoidPayloadFingerprint('tx-1', payload);
      const fp2 = buildVoidPayloadFingerprint('tx-1', { ...payload });
      expect(fp1).toBe(fp2);
    });

    it('valida monto <= original.amount y fecha >= original.occurredOn en REFUND', () => {
      const schema = createRefundTransactionFormSchema('120.00', '2026-11-20');

      const overAmount = schema.safeParse({
        amount: '120.01',
        occurredOn: '2026-11-21',
        description: '',
        notes: '',
      });
      expect(overAmount.success).toBe(false);
      if (!overAmount.success) {
        expect(overAmount.error.issues[0].message).toMatch(/no puede superar el monto/i);
      }

      const earlyDate = schema.safeParse({
        amount: '50',
        occurredOn: '2026-11-19',
        description: '',
        notes: '',
      });
      expect(earlyDate.success).toBe(false);
      if (!earlyDate.success) {
        expect(earlyDate.error.issues[0].message).toMatch(/no puede ser anterior/i);
      }

      const valid = schema.safeParse({
        amount: '60.5',
        occurredOn: '2026-11-20',
        description: '  ',
        notes: ' Devolución parcial ',
      });
      expect(valid.success).toBe(true);

      const payload = buildRefundTransactionPayload({
        amount: '60.5',
        occurredOn: '2026-11-20',
        description: '  ',
        notes: ' Devolución parcial ',
      });
      expect(payload).toEqual({
        amount: '60.50',
        occurredOn: '2026-11-20',
        notes: 'Devolución parcial',
      });
      expect('description' in payload).toBe(false);

      const fp1 = buildRefundPayloadFingerprint('tx-1', payload);
      const fp2 = buildRefundPayloadFingerprint('tx-1', { ...payload, amount: '61.00' });
      expect(fp1).not.toBe(fp2);
    });
  });
});

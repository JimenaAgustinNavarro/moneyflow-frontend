import type { CategoryKind } from '@/types/categories';
import type { FundCurrencyCode } from '@/types/funds';

export type RecordableTransactionType = 'INCOME' | 'EXPENSE';

export type AdjustmentDirection = 'INCREASE' | 'DECREASE';

export type TransactionTypeValue =
  | 'INCOME'
  | 'EXPENSE'
  | 'TRANSFER'
  | 'ADJUSTMENT'
  | 'VOID'
  | 'REFUND';

export type TransactionStatusValue = 'POSTED' | 'VOIDED';

export interface TransactionSplitInput {
  categoryId: string;
  amount: string;
  note?: string | null;
}

export interface RecordTransactionPayload {
  type: RecordableTransactionType;
  fundId: string;
  amount: string;
  occurredOn?: string;
  description: string;
  notes?: string | null;
  categoryId?: string;
  splits?: TransactionSplitInput[];
}

export interface RecordTransferPayload {
  sourceFundId: string;
  destinationFundId: string;
  amount: string;
  occurredOn?: string;
  description: string;
  notes?: string | null;
}

export interface RecordAdjustmentPayload {
  fundId: string;
  direction: AdjustmentDirection;
  amount: string;
  occurredOn?: string;
  description: string;
  notes?: string | null;
}

export interface VoidTransactionPayload {
  reason?: string;
  occurredOn?: string;
  notes?: string | null;
}

export interface RefundTransactionPayload {
  amount: string;
  occurredOn?: string;
  description?: string;
  notes?: string | null;
}

export interface ListTransactionsParams {
  page?: number;
  limit?: number;
  fundId?: string;
  categoryId?: string;
  type?: TransactionTypeValue;
  status?: TransactionStatusValue;
  currency?: FundCurrencyCode;
  fromDate?: string;
  toDate?: string;
  search?: string;
}

export interface GetMonthlySummaryParams {
  month?: string;
  fundId?: string;
}

export interface LedgerMutationOptions {
  idempotencyKey?: string;
}

export interface FundEntryView {
  id: string;
  fundId: string;
  signedAmount: string;
  currency: FundCurrencyCode;
  occurredOn: string;
  createdAt: string;
}

export interface TransactionSplitView {
  id: string;
  categoryId: string;
  amount: string;
  note: string | null;
  createdAt: string;
}

export interface TransactionView {
  id: string;
  type: TransactionTypeValue;
  status: TransactionStatusValue;
  amount: string;
  currency: FundCurrencyCode;
  occurredOn: string;
  recordedAt: string;
  description: string;
  notes: string | null;
  categoryId: string | null;
  relatedTransactionId: string | null;
  idempotencyKey: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionDetailView extends TransactionView {
  entries: FundEntryView[];
  splits: TransactionSplitView[];
}

export interface RecordTransactionResponse {
  transaction: TransactionDetailView;
  fundBalanceAfter: string;
}

export interface RecordTransferResponse {
  transaction: TransactionDetailView;
  sourceFundBalanceAfter: string;
  destinationFundBalanceAfter: string;
}

export interface RecordAdjustmentResponse {
  transaction: TransactionDetailView;
  fundBalanceAfter: string;
}

export interface GetTransactionResponse {
  transaction: TransactionDetailView;
}

export interface AffectedFundBalanceView {
  fundId: string;
  balanceAfter: string;
}

export interface VoidTransactionResponse {
  voidTransaction: TransactionDetailView;
  originalTransactionId: string;
  originalStatus: 'VOIDED';
  affectedFundBalances: AffectedFundBalanceView[];
}

export interface RefundTransactionResponse {
  refundTransaction: TransactionDetailView;
  originalTransactionId: string;
  totalRefundedAfter: string;
  remainingRefundableAmount: string;
  fundBalanceAfter: string;
}

export interface ListTransactionsResponse {
  items: TransactionDetailView[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface CategoryMonthlySummaryItemView {
  categoryId: string;
  categoryName: string;
  kind: CategoryKind;
  color: string | null;
  icon: string | null;
  totalAmount: string;
  transactionCount: number;
}

export interface CurrencyMonthlySummaryView {
  currency: FundCurrencyCode;
  totalIncome: string;
  totalExpenseGross: string;
  totalRefunds: string;
  totalExpenseNet: string;
  netCashFlow: string;
  transactionCount: number;
  byCategory: CategoryMonthlySummaryItemView[];
}

export interface MonthlySummaryResponse {
  month: string;
  fromDate: string;
  toDate: string;
  fundId: string | null;
  currencies: CurrencyMonthlySummaryView[];
}

export type FundCurrencyCode = 'PEN' | 'USD';

export type FundTypeValue = 'CASH' | 'BANK' | 'WALLET' | 'SAVINGS' | 'OTHER';

export interface ListFundsParams {
  includeArchived?: boolean;
  currency?: FundCurrencyCode;
  type?: FundTypeValue;
}

export interface CreateFundPayload {
  name: string;
  type: FundTypeValue;
  currency?: FundCurrencyCode;
  color?: string;
  icon?: string;
  allowNegativeBalance?: boolean;
  initialBalance?: string;
}

export interface UpdateFundPayload {
  name?: string;
  type?: FundTypeValue;
  color?: string | null;
  icon?: string | null;
  allowNegativeBalance?: boolean;
}

export interface FundView {
  id: string;
  name: string;
  type: FundTypeValue;
  currency: FundCurrencyCode;
  color: string | null;
  icon: string | null;
  allowNegativeBalance: boolean;
  isArchived: boolean;
  balance: string;
  createdAt: string;
  updatedAt: string;
}

export interface FundDetailView extends FundView {
  entryCount: number;
}

export interface CurrencyBalanceSummary {
  currency: FundCurrencyCode;
  totalBalance: string;
  fundCount: number;
}

export interface ListFundsResponse {
  funds: FundView[];
  totalsByCurrency: CurrencyBalanceSummary[];
}

export interface GetFundResponse {
  fund: FundDetailView;
}

export interface CreateFundResponse {
  fund: FundView;
}

export interface UpdateFundResponse {
  fund: FundView;
}

export interface ArchiveFundResponse {
  fund: FundView;
  message: string;
}

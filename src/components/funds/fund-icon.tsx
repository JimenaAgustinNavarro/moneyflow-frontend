import * as React from 'react';
import {
  Banknote,
  Briefcase,
  Coins,
  CreditCard,
  Landmark,
  PiggyBank,
  Shield,
  Wallet,
} from 'lucide-react';
import type { FundTypeValue } from '@/types/funds';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Wallet,
  Landmark,
  Banknote,
  PiggyBank,
  CreditCard,
  Coins,
  Briefcase,
  Shield,
};

const TYPE_DEFAULT_ICON: Record<FundTypeValue, React.ComponentType<{ className?: string }>> = {
  CASH: Banknote,
  BANK: Landmark,
  WALLET: Wallet,
  SAVINGS: PiggyBank,
  OTHER: Coins,
};

export interface FundIconProps {
  icon: string | null;
  type: FundTypeValue;
  className?: string;
}

export function FundIcon({ icon, type, className }: FundIconProps): React.JSX.Element {
  const IconComponent = (icon && ICON_MAP[icon]) || TYPE_DEFAULT_ICON[type] || Wallet;
  return <IconComponent className={className} aria-hidden="true" />;
}

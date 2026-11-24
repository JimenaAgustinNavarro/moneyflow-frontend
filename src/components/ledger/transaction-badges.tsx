'use client';

import * as React from 'react';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import {
  TRANSACTION_STATUS_LABELS,
  TRANSACTION_TYPE_LABELS,
} from '@/lib/ledger-schemas';
import type { TransactionStatusValue, TransactionTypeValue } from '@/types/ledger';

const TYPE_BADGE_VARIANT: Record<TransactionTypeValue, NonNullable<BadgeProps['variant']>> = {
  INCOME: 'income',
  EXPENSE: 'destructive',
  TRANSFER: 'outline',
  ADJUSTMENT: 'warning',
  VOID: 'secondary',
  REFUND: 'income',
};

const STATUS_BADGE_VARIANT: Record<TransactionStatusValue, NonNullable<BadgeProps['variant']>> = {
  POSTED: 'outline',
  VOIDED: 'secondary',
};

export interface TransactionTypeBadgeProps {
  type: TransactionTypeValue;
  className?: string;
}

export function TransactionTypeBadge({
  type,
  className,
}: TransactionTypeBadgeProps): React.JSX.Element {
  return (
    <Badge variant={TYPE_BADGE_VARIANT[type]} className={className}>
      {TRANSACTION_TYPE_LABELS[type]}
    </Badge>
  );
}

export interface TransactionStatusBadgeProps {
  status: TransactionStatusValue;
  className?: string;
}

export function TransactionStatusBadge({
  status,
  className,
}: TransactionStatusBadgeProps): React.JSX.Element {
  return (
    <Badge variant={STATUS_BADGE_VARIANT[status]} className={className}>
      {TRANSACTION_STATUS_LABELS[status]}
    </Badge>
  );
}

import * as React from 'react';
import { getCategoryIconComponent, HEX_COLOR_REGEX } from '@/lib/category-schemas';
import { cn } from '@/lib/utils';

export interface CategoryIconBadgeProps {
  iconName: string | null | undefined;
  colorHex: string | null | undefined;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function CategoryIconBadge({
  iconName,
  colorHex,
  size = 'md',
  className,
}: CategoryIconBadgeProps): React.JSX.Element {
  const IconComponent = getCategoryIconComponent(iconName);
  const isValidHex = typeof colorHex === 'string' && HEX_COLOR_REGEX.test(colorHex.trim());
  const effectiveColor = isValidHex ? colorHex.trim() : undefined;

  const sizeClasses = {
    sm: 'h-7 w-7 rounded-md p-1.5',
    md: 'h-9 w-9 rounded-lg p-2',
    lg: 'h-11 w-11 rounded-xl p-2.5',
  };

  const iconSizes = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  };

  return (
    <div
      aria-hidden="true"
      style={{
        backgroundColor: effectiveColor ? `${effectiveColor}1A` : undefined,
        color: effectiveColor || undefined,
        borderColor: effectiveColor ? `${effectiveColor}4D` : undefined,
      }}
      className={cn(
        'flex shrink-0 items-center justify-center border transition-colors',
        !effectiveColor && 'border-border bg-secondary/80 text-foreground',
        sizeClasses[size],
        className,
      )}
    >
      <IconComponent className={cn('shrink-0 stroke-[2.25]', iconSizes[size])} />
    </div>
  );
}

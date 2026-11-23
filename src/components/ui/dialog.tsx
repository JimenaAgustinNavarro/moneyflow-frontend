'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titleId: string;
  descriptionId?: string;
  closeDisabled?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function Dialog({
  open,
  onOpenChange,
  titleId,
  descriptionId,
  closeDisabled = false,
  className,
  children,
}: DialogProps): React.JSX.Element | null {
  React.useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && !closeDisabled) {
        onOpenChange(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, closeDisabled, onOpenChange]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-sm"
        aria-hidden="true"
        onClick={() => {
          if (!closeDisabled) {
            onOpenChange(false);
          }
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className={cn(
          'relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-card p-6 text-card-foreground shadow-xl',
          className,
        )}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Cerrar diálogo"
          disabled={closeDisabled}
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 h-8 w-8"
        >
          <X className="h-4 w-4" />
        </Button>
        {children}
      </div>
    </div>
  );
}

export function DialogHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return <div className={cn('mb-4 space-y-1.5 pr-8', className)} {...props} />;
}

export function DialogTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>): React.JSX.Element {
  return (
    <h2
      className={cn('text-lg font-semibold leading-none tracking-tight text-foreground', className)}
      {...props}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>): React.JSX.Element {
  return <p className={cn('text-sm text-muted-foreground', className)} {...props} />;
}

export function DialogFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return (
    <div
      className={cn('mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
      {...props}
    />
  );
}

import * as React from 'react';
import { CheckCircle2, Circle } from 'lucide-react';
import { evaluatePasswordRules } from '@/lib/auth-schemas';

interface PasswordRequirementsProps {
  password: string;
}

export function PasswordRequirements({ password }: PasswordRequirementsProps): React.JSX.Element {
  const rules = evaluatePasswordRules(password);

  return (
    <ul
      aria-label="Requisitos de contraseña"
      aria-live="polite"
      className="space-y-1.5 rounded-lg border border-border bg-secondary/40 p-3 text-xs"
    >
      {rules.map((rule) => (
        <li
          key={rule.id}
          className={`flex items-center gap-2 ${
            rule.met ? 'font-medium text-income' : 'text-muted-foreground'
          }`}
        >
          {rule.met ? (
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-income" aria-hidden="true" />
          ) : (
            <Circle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          )}
          <span>{rule.label}</span>
        </li>
      ))}
    </ul>
  );
}

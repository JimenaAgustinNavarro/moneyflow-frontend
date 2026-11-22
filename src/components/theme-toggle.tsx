'use client';

import * as React from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun, Laptop } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ThemeToggle(): React.JSX.Element {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex items-center gap-1 p-1 rounded-md border border-border bg-card/50">
        <div className="h-8 w-8 rounded animate-pulse bg-muted" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 p-1 rounded-md border border-border bg-card">
      <Button
        variant={theme === 'light' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => setTheme('light')}
        aria-label="Modo Claro"
      >
        <Sun className="h-4 w-4" />
      </Button>
      <Button
        variant={theme === 'dark' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => setTheme('dark')}
        aria-label="Modo Oscuro"
      >
        <Moon className="h-4 w-4" />
      </Button>
      <Button
        variant={theme === 'system' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => setTheme('system')}
        aria-label="Modo Sistema"
      >
        <Laptop className="h-4 w-4" />
      </Button>
    </div>
  );
}

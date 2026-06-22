import { useEffect, useState } from 'react';
import { Sun, Moon, Laptop } from 'lucide-react';

export type Theme = 'light' | 'dark' | 'system';

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('theme') as Theme) || 'system';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    
    const applyTheme = (resolvedTheme: 'light' | 'dark') => {
      root.classList.remove('light', 'dark');
      root.classList.add(resolvedTheme);
    };

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      applyTheme(systemTheme);
      
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = (e: MediaQueryListEvent) => {
        applyTheme(e.matches ? 'dark' : 'light');
      };
      
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    } else {
      applyTheme(theme);
    }
    
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => {
      if (prev === 'light') return 'dark';
      if (prev === 'dark') return 'system';
      return 'light';
    });
  };

  return (
    <button
      onClick={toggleTheme}
      className="flex items-center gap-2 p-2 rounded-lg border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark text-text-secondary-light dark:text-text-secondary-dark hover:text-text-primary-light hover:dark:text-text-primary-dark hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-200 shadow-sm"
      aria-label="Toggle theme"
      title={`Theme: ${theme}`}
    >
      {theme === 'light' && <Sun size={18} className="text-amber-500 animate-spin-slow" />}
      {theme === 'dark' && <Moon size={18} className="text-indigo-400" />}
      {theme === 'system' && <Laptop size={18} className="text-slate-400" />}
      <span className="text-xs font-semibold capitalize hidden md:inline">{theme}</span>
    </button>
  );
}

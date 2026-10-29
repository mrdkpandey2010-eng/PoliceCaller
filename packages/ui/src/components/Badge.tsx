import React from 'react';
import clsx from 'clsx';

export interface BadgeProps {
  variant?: 'primary' | 'teal' | 'khaki' | 'success' | 'warning' | 'danger' | 'neutral';
  size?: 'sm' | 'md';
  children: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  size = 'md',
  children,
  className,
}) => {
  const styles = {
    primary: 'bg-[#17324F]/10 text-[#17324F] dark:bg-blue-900/30 dark:text-blue-200 border-blue-200/50',
    teal: 'bg-[#147D84]/15 text-[#147D84] dark:bg-teal-900/40 dark:text-teal-300 border-teal-200/50',
    khaki: 'bg-[#C3A35E]/20 text-[#8B6E2C] dark:bg-amber-900/40 dark:text-amber-300 border-amber-200/50',
    success: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200/50',
    warning: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200/50',
    danger: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border-red-200/50',
    neutral: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200/50',
  };

  const sizes = {
    sm: 'text-[11px] px-2 py-0.5 rounded-md font-medium',
    md: 'text-xs px-2.5 py-1 rounded-lg font-semibold',
  };

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 border transition-colors select-none',
        styles[variant],
        sizes[size],
        className
      )}
    >
      {children}
    </span>
  );
};

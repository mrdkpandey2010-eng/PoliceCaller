import React from 'react';
import clsx from 'clsx';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'teal' | 'khaki' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  loading?: boolean;
  icon?: React.ReactNode;
  'aria-label': string; // Required for strict accessibility
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  children,
  className,
  disabled,
  'aria-label': ariaLabel,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed select-none min-h-[44px]';

  const sizeStyles = {
    sm: 'text-xs px-3 py-1.5 rounded-lg gap-1.5',
    md: 'text-sm px-4 py-2 rounded-xl gap-2',
    lg: 'text-base px-6 py-3 rounded-2xl gap-2.5',
    icon: 'p-2.5 rounded-xl min-w-[44px] min-h-[44px]',
  };

  const variantStyles = {
    primary:
      'bg-[#17324F] hover:bg-[#10243B] text-white shadow-sm focus:ring-[#17324F] dark:bg-[#1E3E62] dark:hover:bg-[#17324F]',
    secondary:
      'bg-slate-100 hover:bg-slate-200 text-slate-800 focus:ring-slate-400 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100',
    teal:
      'bg-[#147D84] hover:bg-[#0E565B] text-white shadow-sm focus:ring-[#147D84]',
    khaki:
      'bg-[#C3A35E] hover:bg-[#A68538] text-white shadow-sm focus:ring-[#C3A35E]',
    danger:
      'bg-red-600 hover:bg-red-700 text-white shadow-sm focus:ring-red-500',
    ghost:
      'bg-transparent hover:bg-slate-100 text-slate-700 focus:ring-slate-300 dark:hover:bg-slate-800 dark:text-slate-200',
    outline:
      'border border-slate-300 bg-transparent hover:bg-slate-50 text-slate-700 focus:ring-[#17324F] dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800',
  };

  return (
    <button
      className={clsx(
        baseStyles,
        sizeStyles[size],
        variantStyles[variant],
        className
      )}
      disabled={disabled || loading}
      aria-label={ariaLabel}
      {...props}
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
      ) : icon ? (
        <span className="shrink-0">{icon}</span>
      ) : null}
      {children}
    </button>
  );
};

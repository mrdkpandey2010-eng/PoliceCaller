import React, { useId } from 'react';
import clsx from 'clsx';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string | null;
  helperText?: string;
  englishOnlyNotice?: boolean;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  englishOnlyNotice = false,
  className,
  id: customId,
  disabled,
  ...props
}) => {
  const generatedId = useId();
  const inputId = customId || generatedId;
  const errorId = `${inputId}-error`;
  const helperId = `${inputId}-helper`;

  return (
    <div className="w-full text-left">
      <div className="flex items-center justify-between mb-1">
        <label
          htmlFor={inputId}
          className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
        >
          {label}
        </label>
        {englishOnlyNotice && (
          <span className="text-[10px] font-medium text-[#147D84] bg-teal-50 dark:bg-teal-950/60 dark:text-teal-300 px-1.5 py-0.5 rounded">
            English Only
          </span>
        )}
      </div>

      <div className="relative">
        <input
          id={inputId}
          className={clsx(
            'w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border text-sm transition-colors duration-150',
            'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100',
            'placeholder:text-slate-400 dark:placeholder:text-slate-500',
            'focus:outline-none focus:ring-2 focus:ring-[#17324F] dark:focus:ring-teal-500',
            error
              ? 'border-red-500 ring-1 ring-red-500 focus:border-red-500 focus:ring-red-500'
              : 'border-slate-300 dark:border-slate-700 hover:border-slate-400',
            disabled && 'bg-slate-100 dark:bg-slate-800 cursor-not-allowed opacity-60',
            className
          )}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={
            error ? errorId : helperText ? helperId : undefined
          }
          {...props}
        />
      </div>

      {error ? (
        <p id={errorId} className="mt-1 text-xs text-red-600 dark:text-red-400 font-medium">
          {error}
        </p>
      ) : helperText ? (
        <p id={helperId} className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {helperText}
        </p>
      ) : null}
    </div>
  );
};

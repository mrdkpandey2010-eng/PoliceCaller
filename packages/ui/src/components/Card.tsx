import React from 'react';
import clsx from 'clsx';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  interactive?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  className,
  interactive = false,
  ...props
}) => {
  return (
    <div
      className={clsx(
        'bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm transition-all duration-150',
        interactive && 'hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

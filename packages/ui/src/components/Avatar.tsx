import React from 'react';
import clsx from 'clsx';

export interface AvatarProps {
  src?: string | null;
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isOnline?: boolean;
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
  src,
  name,
  size = 'md',
  isOnline,
  className,
}) => {
  const sizeMap = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-xl',
  };

  const getInitials = (str: string) => {
    if (!str) return 'UP';
    const parts = str.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return str.slice(0, 2).toUpperCase();
  };

  return (
    <div className={clsx('relative inline-block select-none shrink-0', className)}>
      {src ? (
        <img
          src={src}
          alt={name}
          className={clsx(
            'rounded-full object-cover border border-slate-200 dark:border-slate-700',
            sizeMap[size]
          )}
        />
      ) : (
        <div
          className={clsx(
            'rounded-full bg-[#17324F] text-white flex items-center justify-center font-bold tracking-wider shadow-sm dark:bg-[#1E3E62]',
            sizeMap[size]
          )}
        >
          {getInitials(name)}
        </div>
      )}
      {typeof isOnline === 'boolean' && (
        <span
          className={clsx(
            'absolute bottom-0 right-0 block rounded-full ring-2 ring-white dark:ring-slate-900',
            isOnline ? 'bg-emerald-500' : 'bg-slate-400',
            size === 'sm' ? 'w-2 h-2' : size === 'md' ? 'w-2.5 h-2.5' : 'w-3 h-3'
          )}
          aria-label={isOnline ? 'Online' : 'Offline'}
        />
      )}
    </div>
  );
};

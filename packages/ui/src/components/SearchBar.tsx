import React from 'react';
import { Search, ArrowRight, X } from 'lucide-react';
import clsx from 'clsx';
import { Button } from './Button';

export interface SearchBarProps {
  value: string;
  onChange: (val: string) => void;
  onSubmit?: () => void;
  onClear?: () => void;
  placeholder?: string;
  className?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  onSubmit,
  onClear,
  placeholder = 'Search by Name, PNO, Phone, District, Station...',
  className,
}) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && onSubmit) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className={clsx('relative flex items-center w-full', className)}>
      <div className="absolute left-3.5 text-slate-400 dark:text-slate-500 pointer-events-none flex items-center justify-center">
        <Search className="w-5 h-5" />
      </div>

      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        aria-label="Universal directory search"
        className="w-full h-12 pl-11 pr-20 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full text-sm font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#17324F] dark:focus:ring-teal-500 shadow-sm transition-all"
      />

      <div className="absolute right-1.5 flex items-center gap-1">
        {value && onClear && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onClear}
            aria-label="Clear search input"
            className="w-8 h-8 min-w-[32px] min-h-[32px] rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
        <Button
          variant="primary"
          size="icon"
          onClick={onSubmit}
          aria-label="Submit search"
          className="w-9 h-9 min-w-[36px] min-h-[36px] rounded-full p-0 shadow-sm bg-[#17324F] hover:bg-[#10243B] dark:bg-[#1E3E62]"
        >
          <ArrowRight className="w-4 h-4 text-white" />
        </Button>
      </div>
    </div>
  );
};

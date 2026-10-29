import React from 'react';
import clsx from 'clsx';
import { Check, CheckCheck, Trash2 } from 'lucide-react';

export interface ChatBubbleProps {
  id: string;
  content: string;
  senderName?: string;
  senderRank?: string;
  isSelf: boolean;
  timestamp: string;
  status?: 'sending' | 'sent' | 'delivered' | 'read';
  onDeleteForMe?: (messageId: string) => void;
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({
  id,
  content,
  senderName,
  senderRank,
  isSelf,
  timestamp,
  status = 'read',
  onDeleteForMe,
}) => {
  return (
    <div
      className={clsx(
        'group flex flex-col mb-3 max-w-[82%] sm:max-w-[70%]',
        isSelf ? 'ml-auto items-end' : 'mr-auto items-start'
      )}
    >
      {!isSelf && senderName && (
        <span className="text-[11px] font-semibold text-[#147D84] dark:text-teal-400 mb-1 ml-2">
          {senderName} {senderRank ? `(${senderRank})` : ''}
        </span>
      )}

      <div className="relative flex items-end gap-1">
        {isSelf && onDeleteForMe && (
          <button
            onClick={() => onDeleteForMe(id)}
            aria-label="Delete message for me"
            title="Delete for Me"
            className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 rounded transition-opacity"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}

        <div
          className={clsx(
            'px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm break-words',
            isSelf
              ? 'bg-[#17324F] text-white rounded-tr-none dark:bg-[#1E3E62]'
              : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200/80 dark:border-slate-700/80 rounded-tl-none'
          )}
        >
          <div className="whitespace-pre-wrap">{content}</div>

          <div
            className={clsx(
              'flex items-center justify-end gap-1 mt-1 text-[10px]',
              isSelf ? 'text-blue-100/80' : 'text-slate-400 dark:text-slate-500'
            )}
          >
            <span>{timestamp}</span>
            {isSelf && (
              <span className="shrink-0">
                {status === 'sending' && (
                  <span className="w-2.5 h-2.5 border border-white/60 border-t-transparent rounded-full animate-spin inline-block" />
                )}
                {status === 'sent' && <Check className="w-3.5 h-3.5 text-slate-300" />}
                {status === 'delivered' && <CheckCheck className="w-3.5 h-3.5 text-slate-300" />}
                {status === 'read' && <CheckCheck className="w-3.5 h-3.5 text-[#C3A35E]" />}
              </span>
            )}
          </div>
        </div>

        {!isSelf && onDeleteForMe && (
          <button
            onClick={() => onDeleteForMe(id)}
            aria-label="Delete message for me"
            title="Delete for Me"
            className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 rounded transition-opacity"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { MessageSquare, Copy, Check, Star, Phone } from 'lucide-react';
import { Avatar } from './Avatar';
import { Button } from './Button';

export interface ContactData {
  id: string;
  pno: string;
  fullName: string;
  designationName: string;
  designationShort?: string;
  districtName: string;
  stationOfficeName: string;
  mobile: string; // Full unmasked 10-digit mobile number
  whatsapp?: string | null;
  email?: string | null;
  photoUrl?: string | null;
  isFavorite?: boolean;
}

export interface ContactRowProps {
  contact: ContactData;
  onMessageClick?: (contactId: string) => void;
  onToggleFavorite?: (contactId: string) => void;
  onClick?: () => void;
  showFullDetails?: boolean;
}

export const ContactRow: React.FC<ContactRowProps> = ({
  contact,
  onMessageClick,
  onToggleFavorite,
  onClick,
  showFullDetails = false,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopyNumber = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(contact.mobile);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Requirement 2.1: Main Directory Card displays Name, Rank/Designation, District Name, Police Station/Office Name and Mobile.
  // STRICT CONSTRAINT: Do not change existing card height, width, padding or dimensions.
  if (!showFullDetails) {
    return (
      <div
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick?.();
          }
        }}
        aria-label={`View details for ${contact.fullName}`}
        className="flex items-center justify-between p-3.5 sm:p-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md hover:bg-white/95 dark:hover:bg-slate-800/90 rounded-2xl border border-slate-200/80 dark:border-white/10 transition-all duration-150 cursor-pointer shadow-xs hover:shadow-md active:scale-[0.99]"
      >
        <div className="min-w-0 flex-1 mr-2">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
              {contact.fullName}
            </h4>
            {contact.mobile ? (
              <a
                href={`tel:${contact.mobile}`}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 text-xs font-mono font-semibold tracking-wide text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 hover:underline shrink-0 px-2 py-0.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors"
                aria-label={`Call ${contact.fullName} at ${contact.mobile}`}
                title={`Call ${contact.mobile}`}
              >
                <Phone className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>{contact.mobile}</span>
              </a>
            ) : (
              <span className="text-xs font-mono text-slate-400 italic shrink-0">N/A</span>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
            {(contact.designationShort || contact.designationName) && (
              <span className="font-semibold text-[#147D84] dark:text-teal-400 shrink-0">
                {contact.designationShort || contact.designationName} •
              </span>
            )}
            <span className="truncate">
              {contact.stationOfficeName}{contact.stationOfficeName && contact.districtName ? ', ' : ''}{contact.districtName}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className="group flex items-center justify-between p-3.5 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md hover:bg-white/95 dark:hover:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-white/10 transition-all duration-150 cursor-pointer shadow-sm hover:shadow-md"
    >
      <div className="flex items-center gap-3 min-w-0 flex-1 mr-2">
        <Avatar
          src={contact.photoUrl}
          name={contact.fullName}
          size="md"
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
              {contact.fullName}
            </h4>
            {contact.isFavorite && (
              <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
            )}
          </div>

          <p className="text-xs font-semibold text-[#147D84] dark:text-teal-400 truncate mt-0.5">
            {contact.designationName} • <span className="text-slate-500 dark:text-slate-400 font-normal">{contact.stationOfficeName}, {contact.districtName}</span>
          </p>

          <div className="flex items-center gap-2 mt-1">
            {contact.mobile ? (
              <a
                href={`tel:${contact.mobile}`}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 text-xs font-mono font-semibold tracking-wide text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 hover:underline px-2 py-0.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors"
                aria-label={`Call ${contact.fullName} at ${contact.mobile}`}
                title={`Call ${contact.mobile}`}
              >
                <Phone className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>{contact.mobile}</span>
              </a>
            ) : (
              <span className="text-xs font-mono text-slate-400 italic">N/A</span>
            )}
            <button
              onClick={handleCopyNumber}
              aria-label={`Copy phone number for ${contact.fullName}`}
              className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded transition-colors"
              title="Copy phone number"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
            <span className="text-[11px] text-slate-400 dark:text-slate-500">
              PNO: {contact.pno}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {onToggleFavorite && (
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(contact.id);
            }}
            aria-label={contact.isFavorite ? `Remove ${contact.fullName} from favorites` : `Add ${contact.fullName} to favorites`}
            className="w-9 h-9 min-w-[36px] min-h-[36px] rounded-full text-slate-400 hover:text-amber-500 p-0"
          >
            <Star className={`w-4 h-4 ${contact.isFavorite ? 'text-amber-500 fill-amber-500' : ''}`} />
          </Button>
        )}

        {onMessageClick && (
          <Button
            variant="primary"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              onMessageClick(contact.id);
            }}
            aria-label={`Open chat with ${contact.fullName}`}
            className="w-10 h-10 min-w-[40px] min-h-[40px] rounded-full bg-[#17324F] hover:bg-[#10243B] dark:bg-[#1E3E62] text-white p-0 shadow-sm"
          >
            <MessageSquare className="w-4 h-4" />
          </Button>
        )}

        <a
          href={`tel:${contact.mobile}`}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Call ${contact.fullName} via phone dialer`}
          title={`Call ${contact.mobile} via phone dialer`}
          className="w-10 h-10 min-w-[40px] min-h-[40px] rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-sm transition-colors"
        >
          <Phone className="w-4 h-4" />
        </a>
      </div>
    </div>
  );
};

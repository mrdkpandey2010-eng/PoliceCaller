import React, { useState } from 'react';
import { Modal, Avatar, Button, Badge } from '@police-directory/ui';
import { Phone, MessageSquare, Star, Copy, Check, ArrowLeft, Shield, MapPin, Building, Mail } from 'lucide-react';

export interface ContactDetailModalProps {
  contact: any | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenChat: (userId: string) => void;
  onToggleFavorite: (userId: string) => void;
}

export const ContactDetailModal: React.FC<ContactDetailModalProps> = ({
  contact,
  isOpen,
  onClose,
  onOpenChat,
  onToggleFavorite,
}) => {
  const [copied, setCopied] = useState(false);

  if (!contact) return null;

  const handleCopyNumber = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(contact.mobile);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Personnel Information"
      maxWidth="md"
    >
      <div className="space-y-5">
        {/* Header with Avatar and Basic Info */}
        <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/80">
          <Avatar src={contact.photoUrl} name={contact.fullName} size="xl" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black text-slate-900 dark:text-white truncate">
                {contact.fullName}
              </h3>
              {contact.isFavorite && (
                <Star className="w-4 h-4 text-amber-500 fill-amber-500 shrink-0" />
              )}
            </div>
            <p className="text-xs font-bold text-[#147D84] dark:text-teal-400 mt-0.5">
              {contact.designationName || 'Officer'}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-1">
              PNO: <strong className="text-slate-800 dark:text-slate-200">{contact.pno}</strong>
            </p>
          </div>
        </div>

        {/* Structured Posting Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <MapPin className="w-3 h-3 text-[#147D84]" /> Command District
            </span>
            <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">
              {contact.districtName || 'Uttar Pradesh'}
            </p>
          </div>

          <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <Building className="w-3 h-3 text-[#147D84]" /> Station / Office
            </span>
            <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">
              {contact.stationOfficeName || 'Station'}
            </p>
          </div>
        </div>

        {/* Contact Numbers with Copy Feedback */}
        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                Complete Mobile Number
              </span>
              <span className="font-mono text-base font-black text-slate-900 dark:text-white tracking-wide">
                {contact.mobile}
              </span>
            </div>
            <button
              onClick={handleCopyNumber}
              aria-label={`Copy phone number for ${contact.fullName}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>

          {contact.email && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-500 flex items-center gap-1">
                <Mail className="w-3.5 h-3.5" /> Official Email
              </span>
              <span className="font-mono text-slate-800 dark:text-slate-200">{contact.email}</span>
            </div>
          )}
        </div>

        {/* Three Primary Actions: Call (Dialer only), Message (Chat), Favorite (V4.7) */}
        <div className="grid grid-cols-3 gap-2.5 pt-2">
          {/* Action 1: Call (Native External Phone Dialer) */}
          <a
            href={`tel:${contact.mobile}`}
            aria-label={`Call ${contact.fullName} via external phone dialer`}
            title={`Launch system phone dialer with ${contact.mobile}`}
            className="flex flex-col items-center justify-center p-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-colors text-center"
          >
            <Phone className="w-5 h-5 mb-1" />
            <span>Call</span>
          </a>

          {/* Action 2: Message (P2P Departmental Chat) */}
          <button
            onClick={() => {
              onClose();
              onOpenChat(contact.id);
            }}
            aria-label={`Open departmental chat with ${contact.fullName}`}
            className="flex flex-col items-center justify-center p-3 rounded-2xl bg-[#17324F] hover:bg-[#10243B] dark:bg-[#1E3E62] text-white font-bold text-xs shadow-sm transition-colors text-center"
          >
            <MessageSquare className="w-5 h-5 mb-1" />
            <span>Message</span>
          </button>

          {/* Action 3: Favorite (Personal Saved Contact) */}
          <button
            onClick={() => onToggleFavorite(contact.id)}
            aria-label={contact.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            className={`flex flex-col items-center justify-center p-3 rounded-2xl border font-bold text-xs transition-colors text-center ${
              contact.isFavorite
                ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Star className={`w-5 h-5 mb-1 ${contact.isFavorite ? 'fill-current' : ''}`} />
            <span>{contact.isFavorite ? 'Favorited' : 'Favorite'}</span>
          </button>
        </div>

        {/* Back Button returning to list, search, and filters */}
        <div className="pt-2">
          <Button
            variant="outline"
            onClick={onClose}
            aria-label="Back to directory"
            icon={<ArrowLeft className="w-4 h-4" />}
            className="w-full text-xs font-bold py-2.5 rounded-xl"
          >
            Back to Directory
          </Button>
        </div>
      </div>
    </Modal>
  );
};

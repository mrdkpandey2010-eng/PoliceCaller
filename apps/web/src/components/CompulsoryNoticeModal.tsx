import React, { useState } from 'react';
import { Card, Badge, Button } from '@police-directory/ui';
import { AlertTriangle, CheckCircle, ShieldAlert, FileText, BellRing } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

interface CompulsoryNoticeModalProps {
  isOpen: boolean;
  notices: any[];
  onAcknowledge: (noticeId: string) => Promise<void>;
}

export const CompulsoryNoticeModal: React.FC<CompulsoryNoticeModalProps> = ({
  isOpen,
  notices,
  onAcknowledge,
}) => {
  const { language } = useLanguage();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [acknowledging, setAcknowledging] = useState(false);

  if (!isOpen || !notices || notices.length === 0) return null;

  const currentNotice = notices[currentIndex] || notices[0];

  const handleAcknowledgeClick = async () => {
    if (!currentNotice) return;
    setAcknowledging(true);
    try {
      await onAcknowledge(currentNotice.id);
      if (currentIndex < notices.length - 1) {
        setCurrentIndex((prev) => prev + 1);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to acknowledge notice');
    } finally {
      setAcknowledging(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="compulsory-notice-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs"
    >
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 border-2 border-red-500/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Red / Amber Urgent Header */}
        <div className="bg-red-600 text-white px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BellRing className="w-5 h-5 animate-bounce" />
            <div>
              <h2 id="compulsory-notice-title" className="text-xs font-black uppercase tracking-wider">
                {language === 'hi' ? 'अनिवार्य विभागीय आदेश' : 'Compulsory Departmental Order'}
              </h2>
              <p className="text-[10px] text-red-100 font-medium">
                {language === 'hi'
                  ? 'अनुपालन हेतु पढ़ना एवं पावती (Acknowledge) अनिवार्य है'
                  : 'Mandatory Reading & Formal Compliance Acknowledgment Required'}
              </p>
            </div>
          </div>
          <span className="text-[11px] font-mono font-bold bg-white/20 px-2.5 py-1 rounded-full">
            {currentIndex + 1} / {notices.length}
          </span>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <span className="text-[10px] font-mono text-slate-400 block uppercase">ISSUING AUTHORITY</span>
              <p className="font-bold text-slate-900 dark:text-white">
                {currentNotice.publisherName} ({currentNotice.publisherRank || 'Officer'})
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <Badge variant={currentNotice.urgency === 'CRITICAL' ? 'danger' : 'warning'} size="sm">
                {currentNotice.urgency || 'HIGH'}
              </Badge>
              <Badge variant="neutral" size="sm">
                {currentNotice.target_scope === 'STATEWIDE'
                  ? 'Statewide (समस्त उप्र)'
                  : `${currentNotice.targetDistrictName || 'District'} Only`}
              </Badge>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white leading-snug">
              {currentNotice.title}
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
              Issued on: {new Date(currentNotice.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
            </p>
          </div>

          <div className="p-4 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 leading-relaxed font-sans whitespace-pre-wrap">
            {currentNotice.body}
          </div>

          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
            <span>
              {language === 'hi'
                ? 'नोट: इस आदेश को पढ़े बिना ऐप में आगे बढ़ना अनुमत नहीं है। पावती बटन दबाकर आप पुष्टि करते हैं कि आपने आदेश का अवलोकन कर लिया है।'
                : 'Note: Access to other features is restricted until this departmental order is formally read and acknowledged.'}
            </span>
          </div>
        </div>

        {/* Footer Action */}
        <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <span className="text-[10px] text-slate-400 font-mono">
            {currentIndex + 1 === notices.length ? 'Final Order' : `${notices.length - currentIndex - 1} more pending`}
          </span>
          <Button
            onClick={handleAcknowledgeClick}
            disabled={acknowledging}
            variant="primary"
            size="sm"
            aria-label="Acknowledge and proceed"
            className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md"
          >
            <CheckCircle className="w-4 h-4" />
            {acknowledging
              ? language === 'hi'
                ? 'पावती दर्ज हो रही है...'
                : 'Recording...'
              : language === 'hi'
              ? 'आदेश पढ़ लिया है — पावती दें (Acknowledge)'
              : 'I Have Read & Acknowledge Order'}
          </Button>
        </div>
      </div>
    </div>
  );
};

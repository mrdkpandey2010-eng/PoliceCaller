import React, { useState, useEffect } from 'react';
import { Modal, Button } from '@police-directory/ui';
import { ShieldCheck, FileText } from 'lucide-react';
import { api } from '../services/api';
import { useLanguage } from '../context/LanguageContext';

export interface TermsModalProps {
  isOpen: boolean;
  onAccept: () => void;
}

export const TermsModal: React.FC<TermsModalProps> = ({ isOpen, onAccept }) => {
  const { language } = useLanguage();
  const [policy, setPolicy] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      api.getPolicies('TERMS').then((res) => {
        setPolicy(res.policy);
        setLoading(false);
      }).catch(() => {
        setLoading(false);
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAccept = async () => {
    setSubmitting(true);
    try {
      await onAccept();
    } finally {
      setSubmitting(false);
    }
  };

  const title = policy
    ? language === 'hi'
      ? policy.titleHi
      : policy.titleEn
    : 'Departmental Terms of Service & Confidentiality';

  const content = policy
    ? language === 'hi'
      ? policy.contentHi
      : policy.contentEn
    : '1. Official Use Only: Authorized access is granted solely to approved active personnel of the Uttar Pradesh Police.\n2. Confidentiality: Contact information and circulars are confidential.\n3. English-Only Data Entry: Personnel must provide records in canonical English.';

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {}} // Non-dismissible: Acceptance is mandatory
      title={title}
      maxWidth="lg"
      footer={
        <Button
          variant="primary"
          onClick={handleAccept}
          loading={submitting}
          aria-label="Accept Departmental Terms of Service"
          icon={<ShieldCheck className="w-4 h-4 text-emerald-400" />}
          className="w-full sm:w-auto px-6 py-2.5 font-bold bg-[#17324F] hover:bg-[#10243B] text-white shadow"
        >
          {language === 'hi' ? 'मैं सभी शर्तें स्वीकार करता हूँ' : 'I Accept Departmental Terms'}
        </Button>
      }
    >
      <div className="space-y-4 text-sm text-slate-700 dark:text-slate-300">
        <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl flex items-start gap-3">
          <FileText className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed font-medium">
            {language === 'hi'
              ? 'निर्देशिका और संदेश सेवा का उपयोग करने से पूर्व विभागीय शर्तों और गोपनीयता नीति की स्वीकृति अनिवार्य है।'
              : 'Mandatory Policy Acceptance: You must review and formally accept the current departmental confidentiality terms before accessing the police directory.'}
          </p>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 max-h-64 overflow-y-auto whitespace-pre-wrap leading-relaxed font-sans text-xs sm:text-sm">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <span className="w-6 h-6 border-2 border-[#17324F] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            content
          )}
        </div>

        <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center">
          {language === 'hi'
            ? 'स्वीकृति का समय और डिवाइस विवरण सुरक्षा ऑडिट हेतु पंजीकृत किया जाएगा।'
            : 'Acceptance timestamp and device metadata will be recorded for departmental security auditing.'}
        </p>
      </div>
    </Modal>
  );
};

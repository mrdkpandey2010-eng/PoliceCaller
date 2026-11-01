import React, { useState } from 'react';
import { Modal, Button, Input, Badge } from '@police-directory/ui';
import { Star, MessageSquarePlus, Send, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const { language } = useLanguage();

  const [category, setCategory] = useState<string>('SUGGESTION');
  const [rating, setRating] = useState<number>(5);
  const [subject, setSubject] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return;

    setSubmitting(true);
    try {
      await api.submitFeedback({
        category,
        rating,
        subject: subject.trim(),
        message: message.trim(),
      });
      setSuccessMsg(
        language === 'hi'
          ? 'आपकी प्रतिपुष्टि सफलतापूर्वक दर्ज कर ली गई है। धन्यवाद!'
          : 'Your feedback has been submitted successfully. Thank you!'
      );
      setSubject('');
      setMessage('');
      setRating(5);
      setTimeout(() => {
        setSuccessMsg(null);
        onClose();
      }, 1800);
    } catch (err: any) {
      alert(err.message || 'Failed to submit feedback');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={language === 'hi' ? 'रीयल-टाइम प्रतिपुष्टि व सुझाव' : 'Real-Time Feedback & Grievance'}
    >
      {successMsg ? (
        <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 animate-bounce" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">{successMsg}</h3>
          <p className="text-xs text-slate-500">
            {language === 'hi'
              ? 'प्रशासनिक टीम द्वारा इसका तत्काल संज्ञान लिया जाएगा।'
              : 'Our administrative command will review your input immediately.'}
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="p-2.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-400 font-mono text-[11px]">OFFICER</span>
              <p className="font-bold text-slate-800 dark:text-slate-200">
                {user?.fullName} ({user?.pno})
              </p>
            </div>
            <Badge variant="teal" size="sm">
              {user?.districtName || 'HQ'}
            </Badge>
          </div>

          {/* Feedback Category */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              {language === 'hi' ? 'प्रतिपुष्टि श्रेणी' : 'Feedback Category'}
            </label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                { id: 'SUGGESTION', label: language === 'hi' ? '💡 नया सुझाव' : '💡 Suggestion' },
                { id: 'DATA_CORRECTION', label: language === 'hi' ? '✏️ नंबर/डाटा सुधार' : '✏️ Data Correction' },
                { id: 'BUG_REPORT', label: language === 'hi' ? '⚠️ तकनीकी समस्या' : '⚠️ Bug / Issue' },
                { id: 'GENERAL', label: language === 'hi' ? '💬 सामान्य' : '💬 General' },
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  className={`p-2 rounded-xl font-bold border transition-all text-left ${
                    category === cat.id
                      ? 'border-[#17324F] bg-[#17324F]/10 text-[#17324F] dark:border-teal-400 dark:bg-teal-950/30 dark:text-teal-300'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Star Rating */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {language === 'hi' ? 'अनुभव रेटिंग' : 'Experience Rating'}
            </label>
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className="p-1 focus:outline-none"
                  aria-label={`Rate ${star} stars`}
                >
                  <Star
                    className={`w-6 h-6 transition-colors ${
                      star <= rating
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-slate-300 dark:text-slate-700'
                    }`}
                  />
                </button>
              ))}
              <span className="text-xs font-bold text-amber-500 ml-2">{rating} / 5</span>
            </div>
          </div>

          {/* Subject */}
          <Input
            label={language === 'hi' ? 'विषय / शीर्षक' : 'Subject'}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={
              language === 'hi'
                ? 'उदा. थाना हजरतगंज का नया संपर्क नंबर, सर्च फ़िल्टर सुझाव...'
                : 'e.g. Updated Hazratganj PS contact, search speed suggestion...'
            }
            required
          />

          {/* Message Textarea */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {language === 'hi' ? 'विस्तृत विवरण / संदेश' : 'Detailed Message'}
            </label>
            <textarea
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={
                language === 'hi'
                  ? 'कृपया अपना सुझाव अथवा सही किया जाने वाला विवरण यहाँ लिखें...'
                  : 'Please describe your suggestions or details to be corrected...'
              }
              className="w-full text-xs p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-[#17324F] dark:focus:ring-teal-500 outline-none resize-none"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={submitting}
              aria-label="Cancel feedback"
            >
              {language === 'hi' ? 'रद्द करें' : 'Cancel'}
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={submitting || !subject.trim() || !message.trim()}
              aria-label="Submit real-time feedback"
              className="bg-[#17324F] flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              {submitting
                ? language === 'hi'
                  ? 'भेज रहे हैं...'
                  : 'Submitting...'
                : language === 'hi'
                ? 'प्रतिपुष्टि भेजें'
                : 'Submit Feedback'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};

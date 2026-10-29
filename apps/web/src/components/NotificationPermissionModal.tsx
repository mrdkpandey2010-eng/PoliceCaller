import React from 'react';
import { Modal, Button } from '@police-directory/ui';
import { Bell, BellOff } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export interface NotificationPermissionModalProps {
  isOpen: boolean;
  onResolve: (status: 'GRANTED' | 'DENIED' | 'UNSUPPORTED') => void;
  onDismiss: () => void;
}

export const NotificationPermissionModal: React.FC<NotificationPermissionModalProps> = ({
  isOpen,
  onResolve,
  onDismiss,
}) => {
  const { language } = useLanguage();

  if (!isOpen) return null;

  const handleRequest = async () => {
    if (!('Notification' in window)) {
      onResolve('UNSUPPORTED');
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        onResolve('GRANTED');
      } else {
        onResolve('DENIED');
      }
    } catch {
      onResolve('DENIED');
    }
  };

  const handleSkip = () => {
    onResolve('DENIED');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onDismiss}
      title={language === 'hi' ? 'विभागीय सूचनाएं सक्रिय करें' : 'Enable Official Notifications'}
      maxWidth="sm"
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <Button
            variant="ghost"
            onClick={handleSkip}
            aria-label="Skip notification permission for now"
            className="text-xs text-slate-500"
          >
            {language === 'hi' ? 'बाद में' : 'Maybe Later'}
          </Button>
          <Button
            variant="teal"
            onClick={handleRequest}
            aria-label="Allow departmental notifications"
            icon={<Bell className="w-4 h-4" />}
            className="text-xs font-bold px-4 py-2"
          >
            {language === 'hi' ? 'सूचनाएं चालू करें' : 'Allow Notifications'}
          </Button>
        </div>
      }
    >
      <div className="text-center py-2 space-y-3">
        <div className="w-14 h-14 mx-auto rounded-full bg-teal-50 dark:bg-teal-950/60 flex items-center justify-center text-[#147D84] dark:text-teal-400">
          <Bell className="w-7 h-7" />
        </div>

        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          {language === 'hi'
            ? 'महत्वपूर्ण विभागीय आदेशों, स्थानांतरण निर्देशों एवं संदेशों की तत्काल सूचना प्राप्त करने हेतु पुश नोटिफिकेशन सक्षम करें। (अस्वीकृति की स्थिति में भी इन-ऐप इनबॉक्स सक्रिय रहेगा)'
            : 'Enable push notifications to receive real-time alerts for urgent departmental orders, transfer requests, and communications. (In-app notifications remain active regardless of OS permission).'}
        </p>
      </div>
    </Modal>
  );
};

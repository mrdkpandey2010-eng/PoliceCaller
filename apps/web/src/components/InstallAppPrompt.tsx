import React, { useState, useEffect } from 'react';
import { Modal, Button } from '@police-directory/ui';
import { Smartphone, Download, Check, Share, MoreVertical, X, Shield, Sparkles } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

// Global reference for beforeinstallprompt event
let globalDeferredPrompt: any = null;

export const usePWAInstall = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(globalDeferredPrompt);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if running in standalone mode (already installed)
    const checkStandalone = () => {
      const isStandaloneMode =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.includes('android-app://');
      setIsStandalone(Boolean(isStandaloneMode));
    };

    checkStandalone();

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      globalDeferredPrompt = e;
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      globalDeferredPrompt = null;
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const promptInstall = async (): Promise<boolean> => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setIsInstalled(true);
        globalDeferredPrompt = null;
        setDeferredPrompt(null);
        return true;
      }
      return false;
    }
    return false;
  };

  return {
    isInstallable: Boolean(deferredPrompt),
    isStandalone,
    isInstalled,
    promptInstall,
  };
};

export interface InstallAppBannerProps {
  onOpenModal?: () => void;
}

export const InstallAppBanner: React.FC<InstallAppBannerProps> = ({ onOpenModal }) => {
  const { language } = useLanguage();
  const { isStandalone, isInstalled, promptInstall, isInstallable } = usePWAInstall();
  const [dismissed, setDismissed] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    const isDismissed = sessionStorage.getItem('up_police_install_banner_dismissed');
    if (isDismissed === 'true') {
      setDismissed(true);
    }
  }, []);

  if (isStandalone || isInstalled || dismissed) {
    return (
      <InstallInstructionsModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    );
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      const accepted = await promptInstall();
      if (!accepted) {
        setModalOpen(true);
      }
    } else {
      setModalOpen(true);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem('up_police_install_banner_dismissed', 'true');
  };

  return (
    <>
      <div className="fixed bottom-20 md:bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md z-40 bg-[#17324F] text-white p-3.5 rounded-2xl shadow-2xl border border-[#C3A35E]/50 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1E436B] to-[#10243B] border border-[#C3A35E] flex items-center justify-center text-[#C3A35E] shrink-0 shadow-inner">
            <Smartphone className="w-5 h-5 text-[#E6CD91]" />
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <h4 className="text-xs font-black text-white">
                {language === 'hi' ? 'ऑफिशियल ऐप इंस्टॉल करें' : 'Install Official App'}
              </h4>
              <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-[#C3A35E] text-[#17324F] font-extrabold uppercase">
                PWA / Live
              </span>
            </div>
            <p className="text-[11px] text-slate-300 leading-tight">
              {language === 'hi'
                ? 'मोबाइल होम स्क्रीन पर जोड़ें • फास्ट 1-क्लिक एक्सेस • स्वतः अपडेट'
                : '1-click home screen access • Auto-syncs live updates'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            variant="primary"
            size="sm"
            onClick={handleInstallClick}
            aria-label="Install app"
            className="bg-[#C3A35E] hover:bg-[#B3934E] text-[#17324F] font-black text-xs px-3 py-1.5 rounded-xl shadow-md flex items-center gap-1"
          >
            <Download className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>{language === 'hi' ? 'इंस्टॉल' : 'Install'}</span>
          </Button>

          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss banner"
            className="text-slate-400 hover:text-white p-1 rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <InstallInstructionsModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
};

export interface InstallInstructionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InstallInstructionsModal: React.FC<InstallInstructionsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { language } = useLanguage();
  const { isInstallable, promptInstall } = usePWAInstall();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        language === 'hi'
          ? 'यूपी पुलिस ऑफिशियल ऐप इंस्टॉल गाइड'
          : 'How to Install Official UP Police App'
      }
      maxWidth="md"
      footer={
        <div className="flex items-center justify-between w-full">
          {isInstallable ? (
            <Button
              variant="primary"
              size="sm"
              aria-label="Direct install app prompt"
              onClick={async () => {
                await promptInstall();
                onClose();
              }}
              className="bg-[#17324F] font-bold text-xs flex items-center gap-1"
            >
              <Download className="w-3.5 h-3.5" />
              {language === 'hi' ? 'सीधे इंस्टॉल करें (Prompt Now)' : 'Direct Install'}
            </Button>
          ) : (
            <div />
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            aria-label="Close modal"
          >
            {language === 'hi' ? 'समझ गया (Close)' : 'Done'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 text-xs">
        {/* Banner highlighting automatic updates */}
        <div className="p-3 bg-gradient-to-r from-teal-50 to-blue-50 dark:from-teal-950/40 dark:to-blue-950/40 border border-teal-200 dark:border-teal-800 rounded-2xl flex items-start gap-2.5">
          <Sparkles className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
          <div>
            <h5 className="font-bold text-slate-900 dark:text-white text-xs">
              {language === 'hi'
                ? 'हमेशा ऑटोमैटिक अपडेट (Zero Manual Updates Required)'
                : 'Automatic Live Updates'}
            </h5>
            <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
              {language === 'hi'
                ? 'इस ऐप को इंस्टॉल करने के बाद जब भी सिस्टम पर कोई नया डेटा या फीचर अपडेट होगा, आपके मोबाइल में वह बिना किसी नए एपीके के तुरंत लाइव अपडेट हो जाएगा।'
                : 'Once installed, all database updates, contacts, and features automatically sync directly to your mobile app.'}
            </p>
          </div>
        </div>

        {/* Step-by-step for Android */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 space-y-2 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
            <Smartphone className="w-4 h-4 text-[#147D84]" />
            <span>
              {language === 'hi'
                ? 'Android फोन (Google Chrome / Samsung Internet) पर इंस्टॉल करें:'
                : 'Android Installation (Chrome / Samsung Internet):'}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2 pt-1">
            <div className="flex items-start gap-2.5 p-2 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
              <span className="w-5 h-5 rounded-full bg-[#17324F] text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                1
              </span>
              <p className="text-slate-700 dark:text-slate-300">
                {language === 'hi' ? (
                  <>
                    ब्राउज़र के ऊपर दाईं ओर <strong>तीन डॉट्स (⋮) मेन्यू बटन</strong> पर टैप करें।
                  </>
                ) : (
                  <>
                    Tap the <strong>three dots (⋮) menu button</strong> at the top right of your browser.
                  </>
                )}
              </p>
            </div>

            <div className="flex items-start gap-2.5 p-2 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
              <span className="w-5 h-5 rounded-full bg-[#17324F] text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                2
              </span>
              <p className="text-slate-700 dark:text-slate-300">
                {language === 'hi' ? (
                  <>
                    मेन्यू में <strong>"Install app"</strong> अथवा <strong>"Add to Home screen (होम स्क्रीन पर जोड़ें)"</strong> विकल्प चुनें।
                  </>
                ) : (
                  <>
                    Select <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong> from the menu options.
                  </>
                )}
              </p>
            </div>

            <div className="flex items-start gap-2.5 p-2 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
              <span className="w-5 h-5 rounded-full bg-[#17324F] text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                3
              </span>
              <p className="text-slate-700 dark:text-slate-300">
                {language === 'hi' ? (
                  <>
                    <strong>"Install"</strong> पर कन्फर्म करें। ऐप का आइकन तुरंत आपके मोबाइल होम स्क्रीन पर आ जाएगा।
                  </>
                ) : (
                  <>
                    Confirm <strong>"Install"</strong>. The official UP Police icon will appear on your app drawer and home screen.
                  </>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Step-by-step for iPhone/Safari */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 space-y-2 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
            <Share className="w-4 h-4 text-blue-600" />
            <span>
              {language === 'hi'
                ? 'Apple iPhone / iPad (Safari) पर इंस्टॉल करें:'
                : 'Apple iOS Installation (Safari):'}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2 pt-1">
            <div className="flex items-start gap-2.5 p-2 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
              <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                1
              </span>
              <p className="text-slate-700 dark:text-slate-300">
                {language === 'hi' ? (
                  <>
                    सफारी में नीचे दिए गए <strong>शेयर बटन (Share ⎙)</strong> पर टैप करें।
                  </>
                ) : (
                  <>
                    Tap the <strong>Share button (⎙)</strong> in Safari at the bottom bar.
                  </>
                )}
              </p>
            </div>

            <div className="flex items-start gap-2.5 p-2 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
              <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                2
              </span>
              <p className="text-slate-700 dark:text-slate-300">
                {language === 'hi' ? (
                  <>
                    सूची में नीचे स्क्रॉल करें और <strong>"Add to Home Screen (होम स्क्रीन में जोड़ें)"</strong> पर टैप करें।
                  </>
                ) : (
                  <>
                    Scroll down and tap <strong>"Add to Home Screen"</strong>.
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

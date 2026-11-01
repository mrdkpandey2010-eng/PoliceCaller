import React, { useState, useEffect } from 'react';
import { Button } from '@police-directory/ui';
import { Smartphone, Download, X } from 'lucide-react';
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

export const InstallAppBanner: React.FC = () => {
  const { language } = useLanguage();
  const { isStandalone, isInstalled, promptInstall } = usePWAInstall();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const isDismissed = sessionStorage.getItem('up_police_install_banner_dismissed');
    if (isDismissed === 'true') {
      setDismissed(true);
    }
  }, []);

  if (isStandalone || isInstalled || dismissed) {
    return null;
  }

  const handleInstallClick = async () => {
    await promptInstall();
  };

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem('up_police_install_banner_dismissed', 'true');
  };

  return (
    <div className="fixed bottom-20 md:bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md z-40 bg-[#17324F] text-white p-3.5 rounded-2xl shadow-2xl border border-[#C3A35E]/50 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center gap-3">
        <img
          src="/logo.png"
          alt="CCTNS Caller Logo"
          className="w-11 h-11 rounded-full object-contain shrink-0 shadow-md border border-[#C3A35E]/60"
        />
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
  );
};

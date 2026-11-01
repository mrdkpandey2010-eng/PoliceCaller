import React, { useState } from 'react';
import { TopBar, BottomNav, NavTab } from '@police-directory/ui';
import { useAuth } from './context/AuthContext';
import { useLanguage } from './context/LanguageContext';
import { useTheme } from './context/ThemeContext';
import { Login } from './pages/Auth/Login';
import { Register } from './pages/Auth/Register';
import { Directory } from './pages/Directory';
import { Messenger } from './pages/Messenger';
import { Notices } from './pages/Notices';
import { Profile } from './pages/Profile';
import { AdminDashboard } from './pages/Admin';
import { TermsModal } from './components/TermsModal';
import { NotificationPermissionModal } from './components/NotificationPermissionModal';
import { FeedbackModal } from './components/FeedbackModal';
import { CompulsoryNoticeModal } from './components/CompulsoryNoticeModal';
import { InstallAppBanner, usePWAInstall } from './components/InstallAppPrompt';
import { api } from './services/api';
import { ROLES } from '@police-directory/shared';

export const AppContent: React.FC = () => {
  const {
    user,
    loading,
    logout,
    needsTermsAcceptance,
    showNotificationPrompt,
    acceptCurrentTerms,
    handleNotificationPermission,
    dismissNotificationPrompt,
  } = useAuth();
  const { language, toggleLanguage, t } = useLanguage();
  const { isDarkMode, toggleTheme } = useTheme();

  const [authView, setAuthView] = useState<'login' | 'register'>('login');
  const [prefilledIdentifier, setPrefilledIdentifier] = useState('');
  const [activeTab, setActiveTab] = useState<NavTab>('directory');
  const [targetChatUserId, setTargetChatUserId] = useState<string | null>(null);

  // Real-time Feedback & Compulsory Notices state
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [unreadNotices, setUnreadNotices] = useState<any[]>([]);
  const { promptInstall } = usePWAInstall();

  const checkUnreadNotices = async () => {
    if (!user) return;
    try {
      const res = await api.getNotices();
      const unread = (res.notices || []).filter((n: any) => !n.isRead || !n.isAcknowledged);
      setUnreadNotices(unread);
    } catch {
      // Ignore network errors
    }
  };

  React.useEffect(() => {
    if (user) {
      checkUnreadNotices();
    }
  }, [user]);

  const handleAcknowledgeNotice = async (noticeId: string) => {
    await api.acknowledgeNotice(noticeId);
    setUnreadNotices((prev) => prev.filter((n) => n.id !== noticeId));
  };

  // V4.8: Navigation history and Android Hardware Back vs Home
  const navigateToTab = (tab: NavTab) => {
    if (tab === activeTab) return;
    setActiveTab(tab);
    window.history.pushState({ tab }, '', '#' + tab);
  };

  React.useEffect(() => {
    if (!window.history.state) {
      window.history.replaceState({ tab: 'directory' }, '', '#directory');
    }

    const handlePopState = (event: PopStateEvent) => {
      // 1. Dismiss active modal, sheet or dialog first
      const activeModalCloseBtn = document.querySelector(
        '[aria-label="Back to Directory"], [aria-label="Close modal"], [aria-label="Close"]'
      ) as HTMLElement | null;

      if (activeModalCloseBtn) {
        activeModalCloseBtn.click();
        return;
      }

      // 2. Return to previous tab or directory home
      const targetTab = (event.state?.tab as NavTab) || 'directory';
      setActiveTab(targetTab);
    };

    window.addEventListener('popstate', handlePopState);

    // Capacitor Android hardware back listener
    let capacitorListener: any = null;
    const setupCapacitor = async () => {
      try {
        const anyWindow = window as any;
        if (anyWindow.Capacitor?.isNativePlatform?.() && anyWindow.Capacitor?.Plugins?.App) {
          capacitorListener = await anyWindow.Capacitor.Plugins.App.addListener('backButton', () => {
            const activeModalCloseBtn = document.querySelector(
              '[aria-label="Back to Directory"], [aria-label="Close modal"], [aria-label="Close"]'
            ) as HTMLElement | null;

            if (activeModalCloseBtn) {
              activeModalCloseBtn.click();
              return;
            }

            if (activeTab !== 'directory') {
              navigateToTab('directory');
            } else {
              anyWindow.Capacitor.Plugins.App.exitApp();
            }
          });
        }
      } catch (err) {
        // Running in browser web mode
      }
    };
    setupCapacitor();

    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (capacitorListener?.remove) {
        capacitorListener.remove();
      }
    };
  }, [activeTab]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-[#17324F] dark:border-teal-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-bold text-[#17324F] dark:text-teal-400 tracking-wider">
            UP POLICE PORTAL
          </p>
        </div>
      </div>
    );
  }

  // Unauthenticated Flow
  if (!user) {
    if (authView === 'register') {
      return (
        <Register
          initialIdentifier={prefilledIdentifier}
          onNavigateToLogin={() => setAuthView('login')}
        />
      );
    }
    return (
      <Login
        onNavigateToRegister={(id) => {
          setPrefilledIdentifier(id || '');
          setAuthView('register');
        }}
      />
    );
  }

  const isAdmin = user.role === ROLES.SUPER_ADMIN || user.role === ROLES.DISTRICT_CO_ADMIN;

  const handleOpenChatWithUser = (userId: string) => {
    setTargetChatUserId(userId);
    navigateToTab('chats');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Polished Top Bar - In-App Home Action (V4.8) */}
      <TopBar
        title={t('auth.loginTitle')}
        language={language}
        onToggleLanguage={toggleLanguage}
        isDarkMode={isDarkMode}
        onToggleTheme={toggleTheme}
        unreadNoticesCount={unreadNotices.length}
        onFeedbackClick={() => setIsFeedbackOpen(true)}
        onInstallClick={promptInstall}
        onHomeClick={() => navigateToTab('directory')}
        onNotificationsClick={() => navigateToTab('notices')}
        onLogout={logout}
      />

      {/* Desktop Responsive Navigation Bar */}
      <div className="hidden md:flex items-center justify-center bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-2 py-2 max-w-7xl mx-auto px-4">
          <button
            onClick={() => navigateToTab('directory')}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'directory'
                ? 'bg-[#17324F] text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {language === 'hi' ? 'निर्देशिका' : 'Directory'}
          </button>
          <button
            onClick={() => navigateToTab('chats')}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'chats'
                ? 'bg-[#17324F] text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {language === 'hi' ? 'संदेश' : 'Chats'}
          </button>
          <button
            onClick={() => navigateToTab('notices')}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'notices'
                ? 'bg-[#17324F] text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {language === 'hi' ? 'आदेश व सूचनाएं' : 'Notices & Orders'}
          </button>
          {isAdmin && (
            <button
              onClick={() => navigateToTab('admin')}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'admin'
                  ? 'bg-[#17324F] text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {language === 'hi' ? 'प्रशासन' : 'Administration'}
            </button>
          )}
          <button
            onClick={() => navigateToTab('profile')}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'profile'
                ? 'bg-[#17324F] text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {language === 'hi' ? 'प्रोफ़ाइल' : 'Profile'}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 w-full">
        {activeTab === 'directory' && (
          <Directory onOpenChat={handleOpenChatWithUser} />
        )}

        {activeTab === 'chats' && (
          <Messenger
            initialRecipientId={targetChatUserId}
            onClearInitialRecipient={() => setTargetChatUserId(null)}
          />
        )}

        {activeTab === 'notices' && <Notices />}

        {activeTab === 'profile' && <Profile />}

        {activeTab === 'admin' && isAdmin && <AdminDashboard />}
      </main>

      {/* Mobile Bottom Navigation (Strictly NO Calls Tab) */}
      <BottomNav
        activeTab={activeTab}
        onTabChange={(tab) => navigateToTab(tab)}
        showAdminTab={isAdmin}
      />

      {/* Mandatory Post-Login Gates */}
      <TermsModal
        isOpen={needsTermsAcceptance}
        onAccept={acceptCurrentTerms}
      />

      <NotificationPermissionModal
        isOpen={showNotificationPrompt && !needsTermsAcceptance}
        onResolve={handleNotificationPermission}
        onDismiss={dismissNotificationPrompt}
      />

      {/* Mandatory Compulsory Notice Acknowledgment Gate (Requirement 2) */}
      <CompulsoryNoticeModal
        isOpen={unreadNotices.length > 0 && !needsTermsAcceptance}
        notices={unreadNotices}
        onAcknowledge={handleAcknowledgeNotice}
      />

      {/* Real-Time User Feedback Modal (Requirement 1) */}
      <FeedbackModal
        isOpen={isFeedbackOpen}
        onClose={() => setIsFeedbackOpen(false)}
      />

      {/* PWA Floating Install Banner */}
      <InstallAppBanner />
    </div>
  );
};

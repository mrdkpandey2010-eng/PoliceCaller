import React, { useState, Suspense, lazy } from 'react';
import { TopBar, BottomNav, NavTab } from '@police-directory/ui';
import { useAuth } from './context/AuthContext';
import { useLanguage } from './context/LanguageContext';
import { useTheme } from './context/ThemeContext';
import { Login } from './pages/Auth/Login';
import { Directory, DirectorySection } from './pages/Directory';

// Lazy load secondary routes so initial mobile bundle is lightweight & loads in <1s
const Register = lazy(() => import('./pages/Auth/Register').then(m => ({ default: m.Register })));
const Messenger = lazy(() => import('./pages/Messenger').then(m => ({ default: m.Messenger })));
const Notices = lazy(() => import('./pages/Notices').then(m => ({ default: m.Notices })));
const Profile = lazy(() => import('./pages/Profile').then(m => ({ default: m.Profile })));
const AdminDashboard = lazy(() => import('./pages/Admin').then(m => ({ default: m.AdminDashboard })));

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

  const isAdmin = user?.role === ROLES.SUPER_ADMIN || user?.role === ROLES.DISTRICT_CO_ADMIN;

  const [authView, setAuthView] = useState<'login' | 'register'>('login');
  const [prefilledIdentifier, setPrefilledIdentifier] = useState('');

  // Requirement 3: Routing & Refresh Preservation
  const getInitialTab = (): NavTab => {
    const hash = window.location.hash.toLowerCase().replace(/^#/, '');
    if (['chats', 'notices', 'profile'].includes(hash)) {
      return hash as NavTab;
    }
    if (hash === 'admin') {
      return isAdmin ? 'admin' : 'directory';
    }
    if (['stations', 'stations-offices', 'co-admins', 'diaries', 'directory'].includes(hash)) {
      return 'directory';
    }
    const saved = sessionStorage.getItem('police_app_active_tab') as NavTab | null;
    if (saved && ['directory', 'chats', 'notices', 'profile', 'admin'].includes(saved)) {
      if (saved === 'admin' && !isAdmin) return 'directory';
      return saved;
    }
    return 'directory';
  };

  const getInitialDirectorySection = (): DirectorySection => {
    const hash = window.location.hash.toLowerCase().replace(/^#/, '');
    if (hash === 'stations' || hash === 'stations-offices') return 'STATIONS_OFFICES';
    if (hash === 'co-admins') return 'CO_ADMINS';
    if (hash === 'diaries') return 'DIARIES';
    const saved = sessionStorage.getItem('police_app_dir_section') as DirectorySection | null;
    if (saved && ['PERSONNEL', 'STATIONS_OFFICES', 'CO_ADMINS', 'DIARIES'].includes(saved)) {
      return saved;
    }
    return 'PERSONNEL';
  };

  const [activeTab, setActiveTab] = useState<NavTab>(getInitialTab);
  const [activeDirectorySection, setActiveDirectorySection] = useState<DirectorySection>(getInitialDirectorySection);
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

  // Requirement 3: Navigate and sync history / URL hash / session
  const navigateToTab = (tab: NavTab) => {
    if (tab === 'admin' && !isAdmin) return;
    setActiveTab(tab);
    sessionStorage.setItem('police_app_active_tab', tab);

    let targetHash = '#' + tab;
    if (tab === 'directory') {
      targetHash = activeDirectorySection === 'STATIONS_OFFICES' ? '#stations' :
                   activeDirectorySection === 'CO_ADMINS' ? '#co-admins' :
                   activeDirectorySection === 'DIARIES' ? '#diaries' : '#directory';
    }
    window.history.pushState({ tab, section: activeDirectorySection }, '', targetHash);
  };

  const handleDirectorySectionChange = (section: DirectorySection) => {
    setActiveDirectorySection(section);
    sessionStorage.setItem('police_app_dir_section', section);
    if (activeTab === 'directory') {
      const secHash = section === 'STATIONS_OFFICES' ? '#stations' :
                      section === 'CO_ADMINS' ? '#co-admins' :
                      section === 'DIARIES' ? '#diaries' : '#directory';
      window.history.replaceState({ tab: 'directory', section }, '', secHash);
    }
  };

  React.useEffect(() => {
    // Initial sync
    const initialTab = getInitialTab();
    const initialSec = getInitialDirectorySection();
    setActiveTab(initialTab);
    setActiveDirectorySection(initialSec);

    let targetHash = '#' + initialTab;
    if (initialTab === 'directory') {
      targetHash = initialSec === 'STATIONS_OFFICES' ? '#stations' :
                   initialSec === 'CO_ADMINS' ? '#co-admins' :
                   initialSec === 'DIARIES' ? '#diaries' : '#directory';
    }
    if (window.location.hash !== targetHash) {
      window.history.replaceState({ tab: initialTab, section: initialSec }, '', targetHash);
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

      // 2. Determine target tab & section from hash or state
      const hash = window.location.hash.toLowerCase().replace(/^#/, '');
      if (['stations', 'stations-offices'].includes(hash)) {
        setActiveTab('directory');
        setActiveDirectorySection('STATIONS_OFFICES');
        return;
      }
      if (hash === 'co-admins') {
        setActiveTab('directory');
        setActiveDirectorySection('CO_ADMINS');
        return;
      }
      if (hash === 'diaries') {
        setActiveTab('directory');
        setActiveDirectorySection('DIARIES');
        return;
      }
      if (['chats', 'notices', 'profile', 'admin', 'directory'].includes(hash)) {
        if (hash === 'admin' && !isAdmin) {
          setActiveTab('directory');
        } else {
          setActiveTab(hash as NavTab);
        }
        if (hash === 'directory') setActiveDirectorySection('PERSONNEL');
        return;
      }

      const targetTab = (event.state?.tab as NavTab) || 'directory';
      setActiveTab(targetTab === 'admin' && !isAdmin ? 'directory' : targetTab);
      if (event.state?.section) {
        setActiveDirectorySection(event.state.section);
      }
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
  }, [isAdmin]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <img src="/logo.png" alt="CCTNS Caller" className="w-16 h-16 object-contain animate-pulse drop-shadow-md" />
          <p className="text-xs font-bold text-[#17324F] dark:text-teal-400 tracking-wider uppercase">
            CCTNS Caller • Uttar Pradesh
          </p>
        </div>
      </div>
    );
  }

  // Unauthenticated Flow
  if (!user) {
    if (authView === 'register') {
      return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-3 border-[#17324F] border-t-transparent rounded-full animate-spin" /></div>}>
          <Register
            initialIdentifier={prefilledIdentifier}
            onNavigateToLogin={() => setAuthView('login')}
          />
        </Suspense>
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

  const handleOpenChatWithUser = (userId: string) => {
    setTargetChatUserId(userId);
    navigateToTab('chats');
  };

  return (
    <div className="min-h-screen flex flex-col text-slate-900 dark:text-slate-100 bg-gradient-to-br from-[#F0F4F8] via-[#E8EFF6] to-[#DEE8F3] dark:from-[#091420] dark:via-[#0D1F33] dark:to-[#060D15] transition-colors">
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
        onHomeClick={() => {
          setActiveDirectorySection('PERSONNEL');
          navigateToTab('directory');
        }}
        onNotificationsClick={() => navigateToTab('notices')}
        onLogout={logout}
      />

      {/* Desktop Responsive Navigation Bar with Frosted Glassmorphism */}
      <div className="hidden md:flex items-center justify-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/80 dark:border-white/10 shadow-xs">
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
        <Suspense fallback={
          <div className="flex items-center justify-center p-12">
            <div className="w-8 h-8 border-3 border-[#17324F] border-t-transparent rounded-full animate-spin" />
          </div>
        }>
          {activeTab === 'directory' && (
            <Directory
              onOpenChat={handleOpenChatWithUser}
              initialSection={activeDirectorySection}
              onSectionChange={handleDirectorySectionChange}
            />
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
        </Suspense>
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

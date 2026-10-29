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
import { ROLES } from '@police-directory/shared';

export const AppContent: React.FC = () => {
  const {
    user,
    loading,
    needsTermsAcceptance,
    showNotificationPrompt,
    acceptCurrentTerms,
    handleNotificationPermission,
    dismissNotificationPrompt,
  } = useAuth();
  const { language, toggleLanguage, t } = useLanguage();
  const { isDarkMode, toggleTheme } = useTheme();

  const [authView, setAuthView] = useState<'login' | 'register'>('login');
  const [activeTab, setActiveTab] = useState<NavTab>('directory');
  const [targetChatUserId, setTargetChatUserId] = useState<string | null>(null);

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
      return <Register onNavigateToLogin={() => setAuthView('login')} />;
    }
    return <Login onNavigateToRegister={() => setAuthView('register')} />;
  }

  const isAdmin = user.role === ROLES.SUPER_ADMIN || user.role === ROLES.DISTRICT_CO_ADMIN;

  const handleOpenChatWithUser = (userId: string) => {
    setTargetChatUserId(userId);
    setActiveTab('chats');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Polished Top Bar */}
      <TopBar
        title={t('auth.loginTitle')}
        language={language}
        onToggleLanguage={toggleLanguage}
        isDarkMode={isDarkMode}
        onToggleTheme={toggleTheme}
        unreadNoticesCount={0}
        onNotificationsClick={() => setActiveTab('notices')}
      />

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
        onTabChange={(tab) => setActiveTab(tab)}
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
    </div>
  );
};

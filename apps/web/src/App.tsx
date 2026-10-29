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
        onLogout={logout}
      />

      {/* Desktop Responsive Navigation Bar */}
      <div className="hidden md:flex items-center justify-center bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-2 py-2 max-w-7xl mx-auto px-4">
          <button
            onClick={() => setActiveTab('directory')}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'directory'
                ? 'bg-[#17324F] text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {language === 'hi' ? 'निर्देशिका' : 'Directory'}
          </button>
          <button
            onClick={() => setActiveTab('chats')}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'chats'
                ? 'bg-[#17324F] text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {language === 'hi' ? 'संदेश' : 'Chats'}
          </button>
          <button
            onClick={() => setActiveTab('notices')}
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
              onClick={() => setActiveTab('admin')}
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
            onClick={() => setActiveTab('profile')}
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

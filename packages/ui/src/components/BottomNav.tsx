import React from 'react';
import { Users, MessageSquare, Bell, User as UserIcon, Shield } from 'lucide-react';
import clsx from 'clsx';

export type NavTab = 'directory' | 'chats' | 'notices' | 'profile' | 'admin';

export interface BottomNavProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  unreadChatsCount?: number;
  unreadNoticesCount?: number;
  showAdminTab?: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onTabChange,
  unreadChatsCount = 0,
  unreadNoticesCount = 0,
  showAdminTab = false,
}) => {
  const tabs = [
    { id: 'directory' as const, label: 'Directory', icon: Users },
    { id: 'chats' as const, label: 'Chats', icon: MessageSquare, badge: unreadChatsCount },
    { id: 'notices' as const, label: 'Notices', icon: Bell, badge: unreadNoticesCount },
    ...(showAdminTab ? [{ id: 'admin' as const, label: 'Admin', icon: Shield }] : []),
    { id: 'profile' as const, label: 'Profile', icon: UserIcon },
  ];

  return (
    <nav
      aria-label="Mobile Bottom Navigation"
      className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800 md:hidden pb-safe"
    >
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              aria-label={tab.label}
              className={clsx(
                'relative flex flex-col items-center justify-center flex-1 h-full min-h-[44px] transition-colors focus:outline-none',
                isActive
                  ? 'text-[#17324F] dark:text-teal-400 font-bold'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              )}
            >
              <div className="relative">
                <Icon className={clsx('w-5 h-5 transition-transform', isActive && 'scale-110')} />
                {typeof tab.badge === 'number' && tab.badge > 0 && (
                  <span className="absolute -top-1 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shadow-sm">
                    {tab.badge > 99 ? '99+' : tab.badge}
                  </span>
                )}
              </div>
              <span className="text-[11px] mt-1 tracking-tight">{tab.label}</span>
              {isActive && (
                <span className="absolute bottom-1 w-6 h-0.5 rounded-full bg-[#17324F] dark:bg-teal-400" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

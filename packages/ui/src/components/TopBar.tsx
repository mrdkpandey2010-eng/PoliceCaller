import React from 'react';
import { Bell, Moon, Sun, Globe, LogOut, MessageSquarePlus, Smartphone } from 'lucide-react';
import { Button } from './Button';

export interface TopBarProps {
  title?: string;
  unreadNoticesCount?: number;
  onNotificationsClick?: () => void;
  onFeedbackClick?: () => void;
  onHomeClick?: () => void;
  onInstallClick?: () => void;
  isDarkMode?: boolean;
  onToggleTheme?: () => void;
  language?: 'en' | 'hi';
  onToggleLanguage?: () => void;
  userAvatar?: React.ReactNode;
  onLogout?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  title = 'UP Police Directory',
  unreadNoticesCount = 0,
  onNotificationsClick,
  onFeedbackClick,
  onHomeClick,
  onInstallClick,
  isDarkMode = false,
  onToggleTheme,
  language = 'en',
  onToggleLanguage,
  userAvatar,
  onLogout,
}) => {
  return (
    <header className="sticky top-0 z-30 w-full bg-[#17324F] text-white shadow-md border-b border-[#10243B]">
      <div className="flex items-center justify-between h-14 px-4 max-w-7xl mx-auto">
        {/* Left: Official CCTNS Caller Logo & Title (In-App Home Action - V4.8) */}
        <div
          onClick={onHomeClick}
          role={onHomeClick ? 'button' : undefined}
          tabIndex={onHomeClick ? 0 : undefined}
          onKeyDown={(e) => {
            if (onHomeClick && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              onHomeClick();
            }
          }}
          aria-label="CCTNS Caller Home"
          className={`flex items-center gap-2.5 ${onHomeClick ? 'cursor-pointer select-none active:opacity-80 transition' : ''}`}
        >
          <img
            src="/logo.png"
            alt="CCTNS Caller Logo"
            className="w-9 h-9 rounded-full object-contain shrink-0 shadow-sm border border-white/20"
          />
          <div>
            <h1 className="text-sm font-bold tracking-tight text-white line-clamp-1">
              {title}
            </h1>
            <p className="text-[10px] text-teal-200/80 font-medium -mt-0.5">
              Uttar Pradesh Police
            </p>
          </div>
        </div>

        {/* Right: Actions (Install App, Language toggle, Dark mode, Notification Bell, User Avatar) */}
        <div className="flex items-center gap-1 sm:gap-2">
          {onInstallClick && (
            <button
              onClick={onInstallClick}
              type="button"
              aria-label="Install Official App"
              title="Install Official App (ऐप इंस्टॉल करें)"
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#C3A35E]/20 hover:bg-[#C3A35E]/30 text-[#E6CD91] border border-[#C3A35E]/40 rounded-xl text-xs font-bold transition shadow-xs"
            >
              <Smartphone className="w-3.5 h-3.5 text-[#E6CD91] animate-pulse" />
              <span className="text-[11px] font-bold">
                {language === 'hi' ? 'ऐप इंस्टॉल करें' : 'Install App'}
              </span>
            </button>
          )}

          {onToggleLanguage && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleLanguage}
              aria-label={`Switch to ${language === 'en' ? 'Hindi' : 'English'}`}
              className="w-9 h-9 min-w-[36px] min-h-[36px] text-white hover:bg-white/10 rounded-full text-xs font-bold"
              title={`Switch language (${language === 'en' ? 'हिंदी' : 'English'})`}
            >
              <Globe className="w-4 h-4 mr-0.5 inline" />
              <span className="text-[11px]">{language === 'en' ? 'HI' : 'EN'}</span>
            </Button>
          )}

          {onToggleTheme && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleTheme}
              aria-label={isDarkMode ? 'Switch to light theme' : 'Switch to dark theme'}
              className="w-9 h-9 min-w-[36px] min-h-[36px] text-white hover:bg-white/10 rounded-full"
            >
              {isDarkMode ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4" />}
            </Button>
          )}

          {onLogout && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onLogout}
              aria-label="Secure Logout"
              title="Logout"
              className="w-9 h-9 min-w-[36px] min-h-[36px] text-red-300 hover:text-white hover:bg-red-500/30 rounded-full"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          )}

          {onFeedbackClick && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onFeedbackClick}
              aria-label="Submit Feedback"
              title="Real-Time Feedback (प्रतिपुष्टि)"
              className="w-9 h-9 min-w-[36px] min-h-[36px] text-teal-300 hover:text-white hover:bg-white/10 rounded-full"
            >
              <MessageSquarePlus className="w-4 h-4" />
            </Button>
          )}

          {onNotificationsClick && (
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                onClick={onNotificationsClick}
                aria-label={`Notifications, ${unreadNoticesCount} unread`}
                className="w-9 h-9 min-w-[36px] min-h-[36px] text-white hover:bg-white/10 rounded-full"
              >
                <Bell className="w-4 h-4" />
              </Button>
              {unreadNoticesCount > 0 && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-[#17324F]" />
              )}
            </div>
          )}

          {userAvatar && <div className="ml-1">{userAvatar}</div>}
        </div>
      </div>
    </header>
  );
};

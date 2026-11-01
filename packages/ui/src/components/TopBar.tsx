import React from 'react';
import { Shield, Bell, Moon, Sun, Globe, LogOut, MessageSquarePlus } from 'lucide-react';
import { Button } from './Button';

export interface TopBarProps {
  title?: string;
  unreadNoticesCount?: number;
  onNotificationsClick?: () => void;
  onFeedbackClick?: () => void;
  onHomeClick?: () => void;
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
        {/* Left: Shield Logo & Title (In-App Home Action - V4.8) */}
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
          aria-label="Police Directory Home"
          className={`flex items-center gap-2.5 ${onHomeClick ? 'cursor-pointer select-none active:opacity-80 transition' : ''}`}
        >
          <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-[#C3A35E]">
            <Shield className="w-5 h-5 fill-current" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-white line-clamp-1">
              {title}
            </h1>
            <p className="text-[10px] text-teal-200/80 font-medium -mt-0.5">
              Uttar Pradesh Police
            </p>
          </div>
        </div>

        {/* Right: Actions (Language toggle, Dark mode, Notification Bell, User Avatar) */}
        <div className="flex items-center gap-1 sm:gap-2">
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

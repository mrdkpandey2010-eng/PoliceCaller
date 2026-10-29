import React, { useState } from 'react';
import { Button, Input, Card } from '@police-directory/ui';
import { Shield, Lock, UserCheck, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

export interface LoginProps {
  onNavigateToRegister: () => void;
}

export const Login: React.FC<LoginProps> = ({ onNavigateToRegister }) => {
  const { login } = useAuth();
  const { language, t } = useLanguage();

  const [pno, setPno] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!pno.trim()) {
      setError(language === 'hi' ? 'कृपया PNO दर्ज करें' : 'Please enter your PNO');
      return;
    }
    if (!password) {
      setError(language === 'hi' ? 'कृपया पासवर्ड दर्ज करें' : 'Please enter your password');
      return;
    }

    setLoading(true);
    try {
      await login({ pno: pno.trim(), password });
    } catch (err: any) {
      setError(err.message || 'Login failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-slate-100 to-slate-200 dark:from-[#09131F] dark:to-[#10243B]">
      <div className="w-full max-w-md">
        {/* Department Badge Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-[#17324F] dark:bg-[#1E3E62] flex items-center justify-center text-[#C3A35E] shadow-lg mb-3">
            <Shield className="w-9 h-9 fill-current" />
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            {language === 'hi' ? 'उत्तर प्रदेश पुलिस' : 'Uttar Pradesh Police'}
          </h1>
          <p className="text-xs sm:text-sm font-semibold text-[#147D84] dark:text-teal-400 mt-0.5">
            {language === 'hi'
              ? 'आधिकारिक कार्मिक निर्देशिका एवं संचार पोर्टल'
              : 'Official Personnel Directory & Communication Portal'}
          </p>
        </div>

        <Card className="p-6 sm:p-8 shadow-xl border-slate-200/90 dark:border-slate-800 rounded-3xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1">
              {t('auth.loginTitle')}
            </h2>

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-2.5 text-xs text-red-700 dark:text-red-300">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="leading-relaxed font-medium">{error}</span>
              </div>
            )}

            <Input
              label={t('auth.pnoLabel')}
              value={pno}
              onChange={(e) => setPno(e.target.value)}
              placeholder="e.g. 00123456"
              maxLength={12}
              autoComplete="username"
              required
            />

            <Input
              label={t('auth.passwordLabel')}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />

            <Button
              type="submit"
              variant="primary"
              loading={loading}
              aria-label="Login to directory"
              className="w-full mt-2 font-bold bg-[#17324F] hover:bg-[#10243B] text-white shadow-md rounded-xl"
            >
              {t('auth.loginBtn')}
            </Button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 text-center">
            <button
              type="button"
              onClick={onNavigateToRegister}
              className="text-xs font-semibold text-[#147D84] hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300 transition-colors"
            >
              {t('auth.registerLink')}
            </button>
          </div>
        </Card>

        {/* English-Only Policy Footer Notice */}
        <p className="text-[11px] text-center text-slate-500 dark:text-slate-400 mt-4 px-4 leading-relaxed">
          {t('auth.englishOnlyNotice')}
        </p>
      </div>
    </div>
  );
};

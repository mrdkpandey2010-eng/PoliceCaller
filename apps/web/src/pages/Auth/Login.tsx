import React, { useState } from 'react';
import { Button, Input, Card } from '@police-directory/ui';
import { Shield, Lock, ArrowLeft, ArrowRight, Eye, EyeOff, AlertCircle, Clock, UserX, Smartphone, Download } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { api } from '../../services/api';
import { InstallAppBanner, usePWAInstall } from '../../components/InstallAppPrompt';

export interface LoginProps {
  onNavigateToRegister?: (initialIdentifier?: string) => void;
}

export const Login: React.FC<LoginProps> = ({ onNavigateToRegister }) => {
  const { login } = useAuth();
  const { language } = useLanguage();
  const { promptInstall } = usePWAInstall();

  // Stage: 'identifier' | 'password'
  const [stage, setStage] = useState<'identifier' | 'password'>('identifier');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [matchedUser, setMatchedUser] = useState<any | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Step 1: Identifier lookup
  const handleIdentifierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanId = identifier.trim();
    if (!cleanId) {
      setError(
        language === 'hi'
          ? 'कृपया अपना PNO या 10-अंकों का मोबाइल नंबर दर्ज करें'
          : 'Please enter your PNO or 10-digit Mobile Number'
      );
      return;
    }

    if (!/^\d+$/.test(cleanId)) {
      setError(
        language === 'hi'
          ? 'PNO / मोबाइल नंबर केवल अंकों में होना चाहिए'
          : 'Identifier must contain digits only'
      );
      return;
    }

    setLoading(true);
    try {
      const res = await api.lookupIdentifier(cleanId);
      if (res.exists) {
        setMatchedUser(res);
        setStage('password');
      } else {
        // Not registered / incorrect user -> navigate directly to English-only registration form
        if (onNavigateToRegister) {
          onNavigateToRegister(cleanId);
        } else {
          setError(
            language === 'hi'
              ? 'यह PNO / मोबाइल नंबर पंजीकृत नहीं है। कृपया पंजीकरण करें।'
              : 'PNO / Mobile number not registered. Please register.'
          );
        }
      }
    } catch (err: any) {
      setError(err.message || 'Lookup failed. Please verify connection.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Password submission
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!password) {
      setError(language === 'hi' ? 'कृपया पासवर्ड दर्ज करें' : 'Please enter your password');
      return;
    }

    setLoading(true);
    try {
      await login({
        pno: matchedUser?.pno || identifier.trim(),
        identifier: identifier.trim(),
        password,
      });
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
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

        <Card className="p-6 sm:p-8 shadow-xl border-slate-200/80 dark:border-slate-800">
          {stage === 'identifier' ? (
            // Screen 1A: Minimal Identifier Input
            <form onSubmit={handleIdentifierSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <Input
                value={identifier}
                onChange={(e) => {
                  // ASCII digits only
                  const val = e.target.value.replace(/\D/g, '');
                  setIdentifier(val);
                }}
                placeholder={
                  language === 'hi'
                    ? '9-अंकों का PNO या पंजीकृत मोबाइल नंबर दर्ज करें'
                    : 'Enter your 9-digit PNO or registered Mobile Number to proceed'
                }
                aria-label={
                  language === 'hi'
                    ? '9-अंकों का PNO या पंजीकृत मोबाइल नंबर दर्ज करें'
                    : 'Enter your 9-digit PNO or registered Mobile Number to proceed'
                }
                maxLength={10}
                required
                autoFocus
                className="text-xs sm:text-sm placeholder:text-xs sm:placeholder:text-sm py-3"
              />

              <Button
                type="submit"
                variant="primary"
                loading={loading}
                aria-label="Continue to authentication"
                className="w-full bg-[#17324F] hover:bg-[#10243B] font-bold py-2.5 rounded-xl shadow-md"
              >
                <span>{language === 'hi' ? 'आगे बढ़ें' : 'Continue'}</span>
                <ArrowRight className="w-4 h-4 ml-1 inline" />
              </Button>
            </form>
          ) : (
            // Screen 1B: Password Verification
            <form onSubmit={handlePasswordSubmit} className="space-y-5">
              <div className="flex items-center justify-between pb-1">
                <button
                  type="button"
                  onClick={() => {
                    setStage('identifier');
                    setError(null);
                  }}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>{language === 'hi' ? 'पहचान बदलें' : 'Change ID'}</span>
                </button>
                <span className="text-[11px] font-mono font-bold px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-md text-slate-700 dark:text-slate-300">
                  {identifier}
                </span>
              </div>

              {matchedUser && (
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                    {matchedUser.fullName}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {matchedUser.designationName || 'Officer'} • {matchedUser.districtName || 'UP'}
                  </p>
                </div>
              )}

              {/* Status Alerts */}
              {matchedUser?.status === 'PENDING' && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2">
                  <Clock className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                  <span>
                    {language === 'hi'
                      ? 'आपका खाता विभागीय व्यवस्थापक द्वारा अनुमोदन हेतु लंबित है।'
                      : 'Your account is pending departmental admin approval.'}
                  </span>
                </div>
              )}

              {matchedUser?.status === 'INACTIVE' && (
                <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-800 dark:text-red-200 flex items-start gap-2">
                  <UserX className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                  <span>
                    {language === 'hi'
                      ? 'खाता निष्क्रिय है। कृपया जिला व्यवस्थापक से संपर्क करें।'
                      : 'Account is inactive. Please contact your District Co-Admin.'}
                  </span>
                </div>
              )}

              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div className="relative">
                <Input
                  label={language === 'hi' ? 'पासवर्ड दर्ज करें' : 'Enter Password'}
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-8 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <Button
                type="submit"
                variant="primary"
                loading={loading}
                disabled={matchedUser?.status === 'PENDING' || matchedUser?.status === 'INACTIVE'}
                aria-label="Confirm login"
                className="w-full bg-[#17324F] hover:bg-[#10243B] font-bold py-2.5 rounded-xl shadow-md"
              >
                <Lock className="w-4 h-4 mr-1 inline" />
                <span>{language === 'hi' ? 'लॉगिन करें' : 'Log In'}</span>
              </Button>
            </form>
          )}
        </Card>

        {/* Quick Mobile App Install Card */}
        <div className="mt-4 p-3 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xs border border-[#C3A35E]/40 rounded-2xl shadow-sm flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#17324F] flex items-center justify-center text-[#C3A35E] shrink-0">
              <Smartphone className="w-4 h-4 text-[#E6CD91]" />
            </div>
            <div className="text-left">
              <p className="text-xs font-bold text-slate-900 dark:text-white">
                {language === 'hi' ? 'ऑफिशियल ऐप इंस्टॉल करें' : 'Install Official App'}
              </p>
              <p className="text-[11px] text-slate-500">
                {language === 'hi' ? '1-क्लिक एक्सेस • स्वतः लाइव अपडेट' : '1-click access • Live updates'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={promptInstall}
            aria-label="Install app"
            className="px-3 py-1.5 bg-[#17324F] hover:bg-[#10243B] text-[#C3A35E] font-bold text-xs rounded-xl flex items-center gap-1 shadow-xs border border-[#C3A35E]/30"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{language === 'hi' ? 'इंस्टॉल' : 'Install'}</span>
          </button>
        </div>

        <InstallAppBanner />
      </div>
    </div>
  );
};

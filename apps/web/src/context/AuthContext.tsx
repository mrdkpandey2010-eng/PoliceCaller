import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';
import { offlineStore } from '../services/offlineStore';
import { User, Role } from '@police-directory/shared';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  needsTermsAcceptance: boolean;
  showNotificationPrompt: boolean;
  login: (credentials: { pno?: string; mobile?: string; identifier?: string; password: string }) => Promise<void>;
  register: (userData: any) => Promise<{ message: string }>;
  logout: () => Promise<void>;
  acceptCurrentTerms: () => Promise<void>;
  handleNotificationPermission: (status: 'GRANTED' | 'DENIED' | 'UNSUPPORTED') => Promise<void>;
  dismissNotificationPrompt: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  loading: true,
  needsTermsAcceptance: false,
  showNotificationPrompt: false,
  login: async () => {},
  register: async () => ({ message: '' }),
  logout: async () => {},
  acceptCurrentTerms: async () => {},
  handleNotificationPermission: async () => {},
  dismissNotificationPrompt: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('police_auth_token'));
  const [loading, setLoading] = useState(true);
  const [needsTermsAcceptance, setNeedsTermsAcceptance] = useState(false);
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);

  useEffect(() => {
    async function loadUser() {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await api.me();
        setUser(res.user);
        if (res.user.needsTermsAcceptance) {
          setNeedsTermsAcceptance(true);
        }
      } catch {
        // Token invalid or revoked
        localStorage.removeItem('police_auth_token');
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    }
    loadUser();
  }, [token]);

  const login = async (credentials: { pno?: string; mobile?: string; identifier?: string; password: string }) => {
    setLoading(true);
    try {
      const res = await api.login(credentials);
      localStorage.setItem('police_auth_token', res.token);
      setToken(res.token);
      setUser(res.user);
      if (res.user.needsTermsAcceptance) {
        setNeedsTermsAcceptance(true);
      } else {
        // Post-terms notification permission flow
        setShowNotificationPrompt(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const register = async (userData: any) => {
    return api.register(userData);
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch {
      // Ignore network errors on logout
    } finally {
      localStorage.removeItem('police_auth_token');
      // Purge cached offline items on logout
      sessionStorage.clear();
      await offlineStore.purgeOfflineData().catch(() => {});
      setToken(null);
      setUser(null);
      setNeedsTermsAcceptance(false);
      setShowNotificationPrompt(false);
    }
  };

  const acceptCurrentTerms = async () => {
    await api.acceptTerms('1.0');
    setNeedsTermsAcceptance(false);
    if (user) {
      setUser({ ...user, termsAcceptedVersion: '1.0' });
    }
    // Post-terms gate: trigger notification permission prompt flow
    setShowNotificationPrompt(true);
  };

  const handleNotificationPermission = async (status: 'GRANTED' | 'DENIED' | 'UNSUPPORTED') => {
    await api.updateNotificationPref(status);
    setShowNotificationPrompt(false);
  };

  const dismissNotificationPrompt = () => {
    setShowNotificationPrompt(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        needsTermsAcceptance,
        showNotificationPrompt,
        login,
        register,
        logout,
        acceptCurrentTerms,
        handleNotificationPermission,
        dismissNotificationPrompt,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

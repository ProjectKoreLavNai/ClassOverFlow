import React, { createContext, useContext, useEffect, useState } from 'react';
import type { AcademicRole, FilterResult, IUserSession } from '../types/auth';
import { AuthSessionManager } from '../patterns/singleton';
import type { SecurityCheckResult, SecurityViolation } from '../patterns/proxy';
import { DEMO_ACCOUNTS, DEMO_ENABLED, DEMO_PASSWORD } from '../config/demoAccounts';

import api from '../services/api';

type AuthResult = FilterResult & { session?: IUserSession };

interface AuthContextValue {
  session: IUserSession | null;
  securityViolation: SecurityViolation | null;
  isBackendConnected: boolean;
  login: (email: string, password: string) => Promise<AuthResult>;
  register: (data: {
    fullName: string;
    username: string;
    email: string;
    password: string;
    phone?: string;
    role: AcademicRole;
  }) => Promise<AuthResult>;
  updateProfile: (data: { fullName: string; username: string; phone?: string }) => Promise<IUserSession>;
  logout: () => Promise<void>;
  /** Development only: signs in as a seeded demo account. Fails in production builds. */
  switchPersona: (role: AcademicRole) => Promise<AuthResult>;
  verifyResetEmail: (email: string) => Promise<{ success: boolean; message?: string; retryAfter?: number }>;
  resetPassword: (email: string, newPassword: string, confirmPassword: string) => Promise<{ success: boolean; message: string; retryAfter?: number }>;
  setViolation: (check: SecurityCheckResult) => void;
  clearViolation: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const authManager = AuthSessionManager.getInstance();
  const [session, setSession] = useState<IUserSession | null>(authManager.getCurrentSession());
  const [securityViolation, setSecurityViolation] = useState<SecurityViolation | null>(null);
  const [isBackendConnected, setIsBackendConnected] = useState<boolean>(false);

  useEffect(() => {
    const checkConnection = async () => {
      try {
        await api.checkHealth();
        setIsBackendConnected(true);
      } catch {
        setIsBackendConnected(false);
      }
    };
    checkConnection();
    const interval = setInterval(checkConnection, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const unsubscribe = authManager.subscribe((_event, updatedSession) => {
      setSession(updatedSession);
    });
    // A session restored after a reload is confirmed with the backend once.
    void authManager.revalidate();
    return () => unsubscribe();
  }, [authManager]);

  const login = async (email: string, password: string) => {
    const res = await authManager.login(email, password);
    if (res.session) setSession(res.session);
    return res;
  };

  const register: AuthContextValue['register'] = async (data) => {
    const res = await authManager.register(data);
    if (res.session) setSession(res.session);
    return res;
  };

  const updateProfile = async (data: { fullName: string; username: string; phone?: string }) => {
    return authManager.updateProfile(data);
  };

  const logout = async () => {
    await authManager.logout();
    setSession(null);
  };

  const switchPersona = async (role: AcademicRole): Promise<AuthResult> => {
    const account = DEMO_ACCOUNTS.find((item) => item.role === role);
    if (!DEMO_ENABLED || !account) {
      return { success: false, message: 'Demo accounts are only available in development builds.' };
    }
    return login(account.email, DEMO_PASSWORD);
  };

  const setViolation = (check: SecurityCheckResult) => {
    if (!check.allowed && check.violation) {
      setSecurityViolation(check.violation);
    }
  };

  const clearViolation = () => setSecurityViolation(null);

  const verifyResetEmail = (email: string) => authManager.verifyResetEmail(email);
  const resetPassword = (email: string, newPassword: string, confirmPassword: string) =>
    authManager.resetPassword(email, newPassword, confirmPassword);

  return (
    <AuthContext.Provider
      value={{
        session,
        securityViolation,
        isBackendConnected,
        login,
        register,
        updateProfile,
        logout,
        switchPersona,
        verifyResetEmail,
        resetPassword,
        setViolation,
        clearViolation
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
};

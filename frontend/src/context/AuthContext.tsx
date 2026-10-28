import React, { createContext, useContext, useEffect, useState } from 'react';
import type { AcademicRole, AcademicUser, FilterResult, IUserSession } from '../types/auth';
import { AuthSessionManager } from '../patterns/singleton';
import type { SecurityCheckResult, SecurityViolation } from '../patterns/proxy';

import api from '../services/api';

interface AuthContextValue {
  session: IUserSession | null;
  users: AcademicUser[];
  securityViolation: SecurityViolation | null;
  isBackendConnected: boolean;
  login: (email: string, password?: string) => Promise<FilterResult & { session?: IUserSession }>;
  register: (data: {
    fullName: string;
    username?: string;
    email: string;
    password?: string;
    phone?: string;
    role: AcademicRole;
    roll?: string;
  }) => Promise<FilterResult & { session?: IUserSession }>;
  logout: () => Promise<void>;
  switchPersona: (roleOrEmail: AcademicRole | string) => Promise<void>;
  loginAsUser: (email: string) => Promise<FilterResult & { session?: IUserSession }>;
  verifyUser: (email: string) => boolean;
  updateUserRole: (email: string, newRole: AcademicRole) => boolean;
  deleteUser: (email: string) => boolean;
  setViolation: (check: SecurityCheckResult) => void;
  clearViolation: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const authManager = AuthSessionManager.getInstance();
  const [session, setSession] = useState<IUserSession | null>(authManager.getCurrentSession());
  const [users, setUsers] = useState<AcademicUser[]>(authManager.getUsers());
  const [securityViolation, setSecurityViolation] = useState<SecurityViolation | null>(null);
  const [isBackendConnected, setIsBackendConnected] = useState<boolean>(false);

  useEffect(() => {
    // Check backend connection
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
      setUsers(authManager.getUsers());
    });
    return () => unsubscribe();
  }, [authManager]);

  const login = async (email: string, password?: string) => {
    const res = await authManager.login(email, password);
    if (res.session) setSession(res.session);
    return res;
  };

  const loginAsUser = async (email: string) => {
    return login(email, 'Password@123');
  };

  const register = async (data: {
    fullName: string;
    email: string;
    password?: string;
    phone?: string;
    role: AcademicRole;
    roll?: string;
  }) => {
    const res = await authManager.register(data);
    if (res.session) setSession(res.session);
    return res;
  };

  const logout = async () => {
    await authManager.logout();
    setSession(null);
  };

  const switchPersona = async (roleOrEmail: AcademicRole | string) => {
    if (roleOrEmail.includes('@')) {
      await login(roleOrEmail, 'Password@123');
      return;
    }
    const personaMap: Record<AcademicRole, string> = {
      teacher: 'gojo.teacher@university.edu',
      cr: 'daemon.cr@university.edu',
      student: 'ayanokoji.student@university.edu',
      admin: 'aizen.admin@university.edu'
    };
    const targetEmail = personaMap[roleOrEmail as AcademicRole];
    if (targetEmail) {
      await login(targetEmail, 'Password@123');
    }
  };

  const verifyUser = (email: string) => authManager.verifyUser(email);
  const updateUserRole = (email: string, newRole: AcademicRole) => authManager.updateUserRole(email, newRole);
  const deleteUser = (email: string) => authManager.deleteUser(email);

  const setViolation = (check: SecurityCheckResult) => {
    if (!check.allowed && check.violation) {
      setSecurityViolation(check.violation);
    }
  };

  const clearViolation = () => setSecurityViolation(null);

  return (
    <AuthContext.Provider
      value={{
        session,
        users,
        securityViolation,
        isBackendConnected,
        login,
        register,
        logout,
        switchPersona,
        loginAsUser,
        verifyUser,
        updateUserRole,
        deleteUser,
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

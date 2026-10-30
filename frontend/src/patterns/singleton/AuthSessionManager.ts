import type { AcademicRole, AcademicUser, FilterResult, IUserSession, SecurityRequest } from '../../types/auth';
import {
  InstitutionalEmailFilter,
  PasswordStrengthFilter,
  PhoneAndRollFilter,
  RateLimitFilter,
  SecurityFilter
} from '../chain-of-responsibility';
import { UserSessionFactory } from '../factory-method';
import api from '../../services/api';

export type AuthListener = (
  event: 'login' | 'logout' | 'register' | 'admin_update' | 'profile_update',
  session: IUserSession | null
) => void;

/**
 * Singleton Pattern: AuthSessionManager
 * Creational Pattern: Guarantees a single, centralized state store for credentials,
 * active user session, institutional user directory, and security pipeline execution.
 */
export class AuthSessionManager {
  private static instance: AuthSessionManager | null = null;

  private currentSession: IUserSession | null = null;
  private users: AcademicUser[] = [];
  private listeners: AuthListener[] = [];

  // Chain of Responsibility Pipeline
  private rateLimiter: RateLimitFilter;
  private emailFilter: InstitutionalEmailFilter;
  private passwordFilter: PasswordStrengthFilter;
  private phoneFilter: PhoneAndRollFilter;
  private pipeline: SecurityFilter;

  private constructor() {
    // Initialize Chain of Responsibility filters
    this.rateLimiter = new RateLimitFilter();
    this.emailFilter = new InstitutionalEmailFilter();
    this.passwordFilter = new PasswordStrengthFilter();
    this.phoneFilter = new PhoneAndRollFilter();

    // Link pipeline: RateLimit -> Email -> Password -> Phone & Roll
    this.pipeline = this.rateLimiter;
    this.rateLimiter
      .setNext(this.emailFilter)
      .setNext(this.passwordFilter)
      .setNext(this.phoneFilter);

    this.users = this.loadUsersFromStorage();
    this.currentSession = this.loadActiveSessionFromStorage();
  }

  public static getInstance(): AuthSessionManager {
    if (!AuthSessionManager.instance) {
      AuthSessionManager.instance = new AuthSessionManager();
    }
    return AuthSessionManager.instance;
  }

  private loadUsersFromStorage(): AcademicUser[] {
    const raw = localStorage.getItem('classoverflow_users_v6');
    if (raw) {
      try {
        const parsed: AcademicUser[] = JSON.parse(raw);
        if (
          Array.isArray(parsed) &&
          parsed.length === 4 &&
          parsed.some(u => u.fullName.includes('Gojo'))
        ) {
          return parsed;
        }
      } catch (e) {
        console.error('Failed to parse cached users', e);
      }
    }

    // Exactly 1 ID for each role
    const defaultRoster: AcademicUser[] = [
      {
        id: 'usr_gojo_teacher',
        email: 'gojo.teacher@university.edu',
        password: 'Password@123',
        fullName: 'Gojo Satoru',
        role: 'teacher',
        department: 'Computer Science & Engineering',
        avatar: 'GS',
        isVerified: true,
        isInstitutional: true,
        phone: '+8801711223344'
      },
      {
        id: 'usr_daemon_cr',
        email: 'daemon.cr@university.edu',
        password: 'Password@123',
        fullName: 'Daemon Targaryen',
        role: 'cr',
        roll: '55',
        department: 'Computer Science & Engineering',
        avatar: 'DT',
        isVerified: true,
        isInstitutional: true,
        phone: '+8801811556677'
      },
      {
        id: 'usr_ayanokoji_student',
        email: 'ayanokoji.student@university.edu',
        password: 'Password@123',
        fullName: 'Kiyotaka Ayanokoji',
        role: 'student',
        roll: '14',
        department: 'Computer Science & Engineering',
        avatar: 'KA',
        isVerified: true,
        isInstitutional: true,
        phone: '+8801911889900'
      },
      {
        id: 'usr_aizen_admin',
        email: 'aizen.admin@university.edu',
        password: 'Password@123',
        fullName: 'Aizen Sosuke',
        role: 'admin',
        department: 'Computer Science & Engineering',
        avatar: 'AS',
        isVerified: true,
        isInstitutional: true,
        phone: '+8801511001122'
      }
    ];

    this.saveUsersToStorage(defaultRoster);
    return defaultRoster;
  }

  private saveUsersToStorage(roster: AcademicUser[]): void {
    try {
      localStorage.setItem('classoverflow_users_v6', JSON.stringify(roster));
    } catch (e) {
      console.warn('Unable to persist users', e);
    }
  }

  private loadActiveSessionFromStorage(): IUserSession | null {
    const raw = localStorage.getItem('classoverflow_active_session_v5');
    if (raw) {
      try {
        const parsed: AcademicUser = JSON.parse(raw);
        return UserSessionFactory.createSession(parsed);
      } catch (e) {
        localStorage.removeItem('classoverflow_active_session_v5');
      }
    }
    return null;
  }

  public getCurrentSession(): IUserSession | null {
    return this.currentSession;
  }

  public getUsers(): AcademicUser[] {
    return [...this.users];
  }

  public subscribe(listener: AuthListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify(event: 'login' | 'logout' | 'register' | 'admin_update' | 'profile_update'): void {
    this.listeners.forEach(cb => {
      try {
        cb(event, this.currentSession);
      } catch (err) {
        console.error('Subscriber notification error', err);
      }
    });
  }

  /**
   * Login Pipeline:
   * Passes request to Chain of Responsibility filters, verifies credentials with
   * backend FastAPI service, receives real JWT token, and creates polymorphic session.
   */
  public async login(email: string, password?: string): Promise<FilterResult & { session?: IUserSession }> {
    const cleanEmail = (email || '').trim().toLowerCase();
    const effectivePassword = password || 'Password@123';

    // 1. Pass through Chain of Responsibility
    const filterResult = this.pipeline.handle({
      email: cleanEmail,
      isRegistration: false
    });

    if (!filterResult.success) {
      return filterResult;
    }

    // 2. Authenticate against Backend API
    try {
      const authData = await api.login({ email: cleanEmail, password: effectivePassword });
      if (authData && authData.access_token) {
        this.rateLimiter.resetAttempts(cleanEmail);

        let user = this.users.find(u => u.email.toLowerCase() === cleanEmail);
        if (!user) {
          user = {
            id: `usr_${authData.user.user_id || Date.now()}`,
            email: cleanEmail,
            password: effectivePassword,
            fullName: authData.user.full_name || authData.user.username || cleanEmail.split('@')[0],
            username: authData.user.username,
            role: (authData.user.role as AcademicRole) || 'student',
            department: 'Computer Science & Engineering',
            avatar: this.generateInitials(authData.user.full_name || authData.user.username || cleanEmail),
            isVerified: true,
            isInstitutional: cleanEmail.endsWith('@university.edu')
          };
          this.users.push(user);
          this.saveUsersToStorage(this.users);
        }

        // Factory Method generates session
        const sessionUser = {
          ...user,
          fullName: authData.user.full_name || user.fullName,
          username: authData.user.username || user.username,
          phone: authData.user.phone ?? user.phone,
          role: (authData.user.role as AcademicRole) || user.role,
        };
        this.currentSession = UserSessionFactory.createSession(sessionUser);
        (this.currentSession as any).token = authData.access_token;
        localStorage.setItem('classoverflow_active_session_v5', JSON.stringify({
          ...sessionUser,
          token: authData.access_token
        }));

        this.notify('login');
        return {
          success: true,
          session: this.currentSession,
          message: `Welcome back, ${this.currentSession.name}!`
        };
      }
    } catch (err: any) {
      console.warn('Backend login attempt info:', err.message);
      if (err.status === 401) {
        this.rateLimiter.recordFailure(cleanEmail);
        return {
          success: false,
          message: 'Invalid academic credentials. Please re-check your email and password.'
        };
      }
    }

    // Fallback: Lookup in local credentials store
    const user = this.users.find(u => u.email.toLowerCase() === cleanEmail);
    if (!user || (password && user.password !== password)) {
      this.rateLimiter.recordFailure(cleanEmail);
      return {
        success: false,
        message: 'Invalid academic credentials. Please re-check your email and password.'
      };
    }

    // Success: reset failed counter
    this.rateLimiter.resetAttempts(cleanEmail);

    // Factory Method generates session
    this.currentSession = UserSessionFactory.createSession(user);
    localStorage.setItem('classoverflow_active_session_v5', JSON.stringify(user));

    this.notify('login');
    return {
      success: true,
      session: this.currentSession,
      message: `Welcome back, ${this.currentSession.name}!`
    };
  }

  /**
   * Registration Pipeline:
   * Enforces all 4 security filters, registers with FastAPI backend, creates user and session.
   */
  public async register(data: {
    fullName: string;
    username?: string;
    email: string;
    password?: string;
    phone?: string;
    role: AcademicRole;
  }): Promise<FilterResult & { session?: IUserSession }> {
    const cleanEmail = (data.email || '').trim().toLowerCase();
    const effectivePassword = data.password || 'Password@123';

    const request: SecurityRequest = {
      ...data,
      email: cleanEmail,
      isRegistration: true
    };

    // 1. Full Chain of Responsibility verification
    const filterResult = this.pipeline.handle(request);
    if (!filterResult.success) {
      return filterResult;
    }

    // 2. Duplicate Check locally
    if (this.users.some(u => u.email.toLowerCase() === cleanEmail)) {
      return {
        success: false,
        message: 'An academic account with this email address is already registered.'
      };
    }

    // 3. Register with backend API
    try {
      await api.register({
        fullName: data.fullName,
        username: data.username,
        email: cleanEmail,
        password: effectivePassword,
        phone: data.phone,
        role: data.role,
      });

      const authData = await api.login({ email: cleanEmail, password: effectivePassword });
      const newUser: AcademicUser = {
        id: `usr_${authData.user.user_id || Date.now()}`,
        fullName: data.fullName,
        username: data.username,
        email: cleanEmail,
        password: effectivePassword,
        phone: data.phone,
        role: data.role,
        department: 'Computer Science & Engineering',
        avatar: this.generateInitials(data.fullName),
        isVerified: Boolean(request.isInstitutional),
        isInstitutional: Boolean(request.isInstitutional)
      };

      this.users.push(newUser);
      this.saveUsersToStorage(this.users);

      this.currentSession = UserSessionFactory.createSession(newUser);
      (this.currentSession as any).token = authData.access_token;
      localStorage.setItem('classoverflow_active_session_v5', JSON.stringify({
        ...newUser,
        token: authData.access_token
      }));

      this.notify('register');
      return {
        success: true,
        session: this.currentSession,
        message: newUser.isVerified
          ? `Account registered successfully! Welcome to ClassOverflow.`
          : `Account registered! Non-institutional domain accounts require administrative verification.`
      };
    } catch (err: any) {
      console.warn('Backend registration failed, fallback to local store:', err.message);
      if (err.status === 409) {
        return {
          success: false,
          message: 'An account with this email is already registered in the backend.'
        };
      }
    }

    const newUser: AcademicUser = {
      id: 'usr_' + Date.now(),
      fullName: data.fullName,
      username: data.username,
      email: cleanEmail,
      password: effectivePassword,
      phone: data.phone,
      role: data.role,
      department: 'Computer Science & Engineering',
      avatar: this.generateInitials(data.fullName),
      isVerified: Boolean(request.isInstitutional),
      isInstitutional: Boolean(request.isInstitutional)
    };

    this.users.push(newUser);
    this.saveUsersToStorage(this.users);

    this.currentSession = UserSessionFactory.createSession(newUser);
    localStorage.setItem('classoverflow_active_session_v5', JSON.stringify(newUser));

    this.notify('register');
    return {
      success: true,
      session: this.currentSession,
      message: newUser.isVerified
        ? `Account registered successfully! Welcome to ClassOverflow.`
        : `Account registered! Non-institutional domain accounts require administrative verification.`
    };
  }

  public async logout(): Promise<void> {
    try {
      await api.logout();
    } catch (e) {
      console.warn('API logout error:', e);
    }
    this.currentSession = null;
    localStorage.removeItem('classoverflow_active_session_v5');
    this.notify('logout');
  }

  public async updateProfile(values: {
    fullName: string;
    username: string;
    phone?: string;
  }): Promise<IUserSession> {
    if (!this.currentSession) {
      throw new Error('You must be signed in to update your profile');
    }

    const currentSession = this.currentSession;
    const profile = await api.updateProfile({
      full_name: values.fullName.trim(),
      username: values.username.trim(),
      ...(currentSession.role !== 'admin' ? { phone: values.phone?.trim() || null } : {}),
    });
    const existingIndex = this.users.findIndex(
      (user) => user.email.toLowerCase() === currentSession.email.toLowerCase()
    );
    const existingUser = existingIndex >= 0 ? this.users[existingIndex] : undefined;
    const updatedUser: AcademicUser = {
      ...existingUser,
      id: currentSession.id,
      email: currentSession.email,
      fullName: profile.full_name || values.fullName.trim(),
      username: profile.username || values.username.trim(),
      role: currentSession.role,
      department: currentSession.department,
      roll: currentSession.roll,
      phone: profile.phone ?? undefined,
      avatar: this.generateInitials(profile.full_name || values.fullName.trim()),
      isVerified: currentSession.isVerified,
      isInstitutional: currentSession.isInstitutional,
      token: currentSession.token,
    };

    if (existingIndex >= 0) this.users[existingIndex] = { ...updatedUser, password: existingUser?.password };
    else this.users.push(updatedUser);
    this.saveUsersToStorage(this.users);
    this.currentSession = UserSessionFactory.createSession(updatedUser);
    localStorage.setItem('classoverflow_active_session_v5', JSON.stringify(updatedUser));
    this.notify('profile_update');
    return this.currentSession;
  }

  public getUsersByRole(role: AcademicRole): AcademicUser[] {
    return this.users.filter(u => u.role === role);
  }

  // --- Admin Account Management Methods (Functional Req 4.1) ---

  public verifyUser(email: string): boolean {
    const user = this.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (user) {
      user.isVerified = true;
      this.saveUsersToStorage(this.users);
      this.notify('admin_update');
      return true;
    }
    return false;
  }

  public updateUserRole(email: string, newRole: AcademicRole): boolean {
    const user = this.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (user) {
      user.role = newRole;
      this.saveUsersToStorage(this.users);

      // If active session is modified, update it reactively
      if (this.currentSession && this.currentSession.email.toLowerCase() === email.toLowerCase()) {
        this.currentSession = UserSessionFactory.createSession(user);
        localStorage.setItem('classoverflow_active_session_v5', JSON.stringify(user));
      }

      this.notify('admin_update');
      return true;
    }
    return false;
  }

  public deleteUser(email: string): boolean {
    const index = this.users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());
    if (index !== -1) {
      if (this.currentSession && this.currentSession.email.toLowerCase() === email.toLowerCase()) {
        return false; // Prevent deleting active session
      }
      this.users.splice(index, 1);
      this.saveUsersToStorage(this.users);
      this.notify('admin_update');
      return true;
    }
    return false;
  }

  private generateInitials(name: string): string {
    const parts = (name || 'Academic User').trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return (name || 'AU').substring(0, 2).toUpperCase();
  }
}

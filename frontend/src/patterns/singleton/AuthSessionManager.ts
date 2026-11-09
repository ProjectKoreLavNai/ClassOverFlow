import type { AcademicRole, AcademicUser, FilterResult, IUserSession, SecurityRequest } from '../../types/auth';
import {
  PhoneAndRollFilter,
  RateLimitFilter,
  SecurityFilter
} from '../chain-of-responsibility';
import { UserSessionFactory } from '../factory-method';
import api, { ApiError, type BackendUser } from '../../services/api';

export type AuthListener = (
  event: 'login' | 'logout' | 'register' | 'profile_update',
  session: IUserSession | null
) => void;

export type AuthResult = FilterResult & { session?: IUserSession };

/**
 * Only the public profile is kept between reloads (never a password, never a token),
 * and only in sessionStorage, so it is gone when the tab closes. The access and
 * refresh tokens are handled by the API client.
 */
const PROFILE_KEY = 'classoverflow_session_profile';

const GENERIC_LOGIN_ERROR = 'Invalid academic credentials. Please re-check your email and password.';
const OFFLINE_ERROR = "Can't reach the ClassOverflow server. Check that the backend is running, then try again.";

/**
 * Singleton Pattern: AuthSessionManager
 * Creational Pattern: Guarantees a single, centralized store for the active session
 * and the client-side validation pipeline.
 *
 * Security notes (see docs/ClassOverFlow_Gaps_and_Remedies_Checklist.pdf):
 * - The backend is the only source of truth for credentials. There is no local
 *   user roster, no stored password and no offline login fallback.
 * - The client-side RateLimitFilter is a usability guard only; the real limit
 *   must be enforced by FastAPI (HTTP 429), which this class also understands.
 */
export class AuthSessionManager {
  private static instance: AuthSessionManager | null = null;

  private currentSession: IUserSession | null = null;
  private listeners: AuthListener[] = [];

  // Chain of Responsibility Pipeline. Email format and password rules are not
  // checked here: the backend validates them and its error is shown as-is.
  private rateLimiter: RateLimitFilter;
  private phoneFilter: PhoneAndRollFilter;
  private pipeline: SecurityFilter;

  private constructor() {
    this.rateLimiter = new RateLimitFilter();
    this.phoneFilter = new PhoneAndRollFilter();

    // Link pipeline: RateLimit -> Phone & Roll
    this.pipeline = this.rateLimiter;
    this.rateLimiter.setNext(this.phoneFilter);

    this.currentSession = this.restoreSession();
  }

  public static getInstance(): AuthSessionManager {
    if (!AuthSessionManager.instance) {
      AuthSessionManager.instance = new AuthSessionManager();
    }
    return AuthSessionManager.instance;
  }

  // --- Session persistence (profile only) ---

  private restoreSession(): IUserSession | null {
    const token = api.getToken();
    if (!token) {
      this.clearProfile();
      return null;
    }
    try {
      const raw = sessionStorage.getItem(PROFILE_KEY);
      if (!raw) return null;
      const profile: AcademicUser = JSON.parse(raw);
      return UserSessionFactory.createSession({ ...profile, token });
    } catch {
      this.clearProfile();
      return null;
    }
  }

  private saveProfile(user: AcademicUser): void {
    // Strip anything secret before it touches storage.
    const { token: _token, ...profile } = user;
    try {
      sessionStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    } catch {
      // Storage disabled: the session still works until the tab reloads.
    }
  }

  private clearProfile(): void {
    try {
      sessionStorage.removeItem(PROFILE_KEY);
    } catch {
      // ignore
    }
  }

  private startSession(user: AcademicUser, token: string): IUserSession {
    this.currentSession = UserSessionFactory.createSession({ ...user, token });
    this.saveProfile(user);
    return this.currentSession;
  }

  private toAcademicUser(backend: BackendUser, fallback: Partial<AcademicUser> = {}): AcademicUser {
    const email = (backend.email || fallback.email || '').toLowerCase();
    const fullName = backend.full_name || fallback.fullName || backend.username || email.split('@')[0];
    return {
      id: backend.user_id ? `usr_${backend.user_id}` : fallback.id || `usr_${email}`,
      email,
      fullName,
      username: backend.username || fallback.username,
      role: ((backend.role as AcademicRole) || fallback.role || 'student'),
      department: fallback.department || 'Computer Science & Engineering',
      roll: fallback.roll,
      phone: backend.phone ?? fallback.phone,
      avatar: this.generateInitials(fullName),
      isVerified: backend.is_verified ?? fallback.isVerified ?? true,
      isInstitutional: email.endsWith('@university.edu'),
    };
  }

  public getCurrentSession(): IUserSession | null {
    return this.currentSession;
  }

  public subscribe(listener: AuthListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify(event: 'login' | 'logout' | 'register' | 'profile_update'): void {
    this.listeners.forEach(cb => {
      try {
        cb(event, this.currentSession);
      } catch (err) {
        console.error('Subscriber notification error', err);
      }
    });
  }

  /** Maps a failed backend call to a message a person can act on. */
  private describeError(err: unknown, fallback: string): AuthResult {
    if (err instanceof ApiError) {
      if (err.status === 429) {
        return { success: false, filterName: 'ServerRateLimit', message: err.message, retryAfter: err.retryAfter ?? 30 };
      }
      // 0 = network failure; 502-504 = the dev proxy or a gateway could not reach FastAPI.
      if (err.status === 0 || (err.status >= 502 && err.status <= 504)) {
        return { success: false, message: OFFLINE_ERROR };
      }
      return { success: false, message: err.message || fallback };
    }
    return { success: false, message: fallback };
  }

  /**
   * Re-checks a restored session with the backend. Signs the user out locally if
   * the token is no longer accepted; keeps the session if the server is just offline.
   */
  public async revalidate(): Promise<void> {
    if (!this.currentSession) return;
    try {
      const profile = await api.getProfile();
      const current = this.currentSession;
      const user = this.toAcademicUser(profile, {
        id: current.id,
        email: current.email,
        fullName: current.name,
        role: current.role,
        department: current.department,
        roll: current.roll,
        phone: current.phone,
      });
      this.startSession(user, current.token);
      this.notify('profile_update');
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        api.setTokens(null, null);
        this.currentSession = null;
        this.clearProfile();
        this.notify('logout');
      }
    }
  }

  /**
   * Login Pipeline:
   * Runs the client-side filters, then authenticates against FastAPI. There is no
   * offline fallback: if the backend cannot confirm the credentials, sign-in fails.
   */
  public async login(email: string, password: string): Promise<AuthResult> {
    const cleanEmail = (email || '').trim().toLowerCase();

    const filterResult = this.pipeline.handle({ email: cleanEmail, isRegistration: false });
    if (!filterResult.success) return filterResult;

    if (!password) {
      return { success: false, message: 'Please enter your password.' };
    }

    try {
      const authData = await api.login({ email: cleanEmail, password });
      this.rateLimiter.resetAttempts(cleanEmail);
      const user = this.toAcademicUser(authData.user, { email: cleanEmail });
      const session = this.startSession(user, authData.access_token);
      this.notify('login');
      return { success: true, session, message: `Welcome back, ${session.name}!` };
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 404)) {
        this.rateLimiter.recordFailure(cleanEmail);
        return { success: false, message: GENERIC_LOGIN_ERROR };
      }
      return this.describeError(err, GENERIC_LOGIN_ERROR);
    }
  }

  /**
   * Registration Pipeline:
   * Enforces the security filters, registers with FastAPI, then signs in.
   */
  public async register(data: {
    fullName: string;
    username: string;
    email: string;
    password: string;
    phone?: string;
    role: AcademicRole;
  }): Promise<AuthResult> {
    const cleanEmail = (data.email || '').trim().toLowerCase();
    const request: SecurityRequest = { ...data, email: cleanEmail, isRegistration: true };

    const filterResult = this.pipeline.handle(request);
    if (!filterResult.success) return filterResult;

    try {
      await api.register({
        fullName: data.fullName,
        username: data.username,
        email: cleanEmail,
        password: data.password,
        phone: data.phone,
        role: data.role,
      });
      const authData = await api.login({ email: cleanEmail, password: data.password });
      const user = this.toAcademicUser(authData.user, {
        email: cleanEmail,
        fullName: data.fullName,
        username: data.username,
        phone: data.phone,
        role: data.role,
      });
      const session = this.startSession(user, authData.access_token);
      this.notify('register');
      return {
        success: true,
        session,
        message: session.isVerified
          ? 'Account registered successfully! Welcome to ClassOverflow.'
          : 'Account registered! Non-institutional domain accounts require administrative verification.',
      };
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        return { success: false, message: 'An account with this email is already registered.' };
      }
      return this.describeError(err, 'Registration failed. Please try again.');
    }
  }

  public async logout(): Promise<void> {
    try {
      await api.logout();
    } catch (e) {
      console.warn('API logout error:', e);
    }
    this.currentSession = null;
    this.clearProfile();
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

    const current = this.currentSession;
    const profile = await api.updateProfile({
      full_name: values.fullName.trim(),
      username: values.username.trim(),
      ...(current.role !== 'admin' ? { phone: values.phone?.trim() || null } : {}),
    });
    const user = this.toAcademicUser(profile, {
      id: current.id,
      email: current.email,
      fullName: values.fullName.trim(),
      username: values.username.trim(),
      role: current.role,
      department: current.department,
      roll: current.roll,
      isVerified: current.isVerified,
    });
    const session = this.startSession(user, current.token);
    this.notify('profile_update');
    return session;
  }

  /**
   * Password recovery, step 1: check that the email belongs to an account.
   * The account's name is deliberately not returned to the UI.
   */
  public async verifyResetEmail(email: string): Promise<{ success: boolean; message?: string; retryAfter?: number }> {
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail) {
      return { success: false, message: 'Please enter your university email.' };
    }

    try {
      const data = await api.verifyResetEmail(cleanEmail);
      if (data?.exists) return { success: true };
      return { success: false, message: 'We could not start a reset for that email. Check the address and try again.' };
    } catch (err) {
      const res = this.describeError(err, 'We could not start a reset for that email. Check the address and try again.');
      return { success: false, message: res.message, retryAfter: res.retryAfter };
    }
  }

  /**
   * Password recovery, step 2. Succeeds only when the backend confirms the change;
   * nothing is written locally.
   */
  public async resetPassword(
    email: string,
    newPassword: string,
    confirmPassword: string
  ): Promise<{ success: boolean; message: string; retryAfter?: number }> {
    const cleanEmail = (email || '').trim().toLowerCase();

    // Password length, character mix and the confirm match are checked by the backend.
    try {
      await api.resetPassword({
        email: cleanEmail,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      return { success: true, message: 'Password updated. Sign in with your new password.' };
    } catch (err) {
      const res = this.describeError(err, 'Unable to update the password. Please try again.');
      return { success: false, message: res.message, retryAfter: res.retryAfter };
    }
  }

  private generateInitials(name: string): string {
    const parts = (name || 'Academic User').trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return (name || 'AU').substring(0, 2).toUpperCase();
  }
}

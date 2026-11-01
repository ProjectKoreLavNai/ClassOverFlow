import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, ArrowRight, Mail, CheckCircle2, KeyRound, ShieldAlert, Eye, EyeOff, Loader2, Check } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { PasswordStrengthMeter } from './PasswordStrengthMeter';
import type { AcademicRole } from '../../types/auth';

interface ForgotPasswordFormProps {
  initialEmail?: string;
  onBackToSignIn: (email?: string, newPassword?: string) => void;
}

interface DemoAccount {
  name: string;
  role: AcademicRole;
  roleTag: string;
  email: string;
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  { name: 'Gojo Satoru', role: 'teacher', roleTag: 'Teacher', email: 'gojo.teacher@university.edu' },
  { name: 'Daemon Targaryen', role: 'cr', roleTag: 'CR', email: 'daemon.cr@university.edu' },
  { name: 'Kiyotaka Ayanokoji', role: 'student', roleTag: 'Student', email: 'ayanokoji.student@university.edu' },
  { name: 'Aizen Sosuke', role: 'admin', roleTag: 'Admin', email: 'aizen.admin@university.edu' }
];

export const ForgotPasswordForm: React.FC<ForgotPasswordFormProps> = ({
  initialEmail = '',
  onBackToSignIn
}) => {
  const { verifyResetEmail, resetPassword } = useAuth();

  // Current Step: 'email' | 'new_password' | 'success'
  const [step, setStep] = useState<'email' | 'new_password' | 'success'>('email');

  // Step 1 State: Email verification
  const [email, setEmail] = useState<string>(initialEmail);
  const [verifiedName, setVerifiedName] = useState<string>('');
  const [emailError, setEmailError] = useState<string | null>(null);

  // Step 2 State: Password reset
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showNewPassword, setShowNewPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Shared Form State
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success' | 'info'; message: string } | null>(null);

  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus management depending on step
  useEffect(() => {
    if (step === 'email') {
      emailInputRef.current?.focus();
    } else if (step === 'new_password') {
      passwordInputRef.current?.focus();
    }
  }, [step]);

  // Handle Escape key to return to sign in
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onBackToSignIn(email);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [email, onBackToSignIn]);

  // --- STEP 1: Verify Email ---
  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setEmailError(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setEmailError('Please enter your university email address.');
      emailInputRef.current?.focus();
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(cleanEmail)) {
      setEmailError('Please enter a valid email address (e.g., name@university.edu).');
      emailInputRef.current?.focus();
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await verifyResetEmail(cleanEmail);
      if (res.success) {
        setVerifiedName(res.fullName || cleanEmail.split('@')[0]);
        setStep('new_password');
        setFeedback({
          type: 'info',
          message: `Account identified for ${res.fullName || cleanEmail}. Enter your new password below.`
        });
      } else {
        setFeedback({
          type: 'error',
          message: res.message || 'No registered account found with this email address.'
        });
      }
    } catch {
      setFeedback({
        type: 'error',
        message: 'Could not connect to authentication service. Please check your connection.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- STEP 2: Update Password ---
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setPasswordError(null);

    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters long.');
      passwordInputRef.current?.focus();
      return;
    }

    const hasLower = /[a-z]/.test(newPassword);
    const hasUpper = /[A-Z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);

    if (!hasLower || !hasUpper || !hasNumber) {
      setPasswordError('Password must include uppercase letters, lowercase letters, and numbers.');
      passwordInputRef.current?.focus();
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('The passwords do not match. Please re-type your confirm password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await resetPassword(email.trim().toLowerCase(), newPassword);
      if (res.success) {
        setStep('success');
        setFeedback({
          type: 'success',
          message: res.message || 'Password successfully updated.'
        });
      } else {
        setFeedback({
          type: 'error',
          message: res.message || 'Failed to update password. Please try again.'
        });
      }
    } catch {
      setFeedback({
        type: 'error',
        message: 'An unexpected error occurred while resetting your password.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button
          type="button"
          onClick={() => onBackToSignIn(email, step === 'success' ? newPassword : undefined)}
          className="link-button"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.82rem',
            fontFamily: 'var(--font-display)',
            textDecoration: 'none'
          }}
          aria-label="Return to sign in"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          <span>Back to sign in</span>
        </button>

        <span
          className="muted"
          style={{
            fontSize: '0.72rem',
            fontFamily: 'var(--font-mono)',
            padding: '2px 8px',
            background: 'var(--raised)',
            borderRadius: 'var(--radius-chip)'
          }}
        >
          ESC to exit
        </span>
      </div>

      {/* Main Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: 'var(--radius-chip)',
              background: 'var(--raised)',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text)'
            }}
            aria-hidden="true"
          >
            <KeyRound size={15} />
          </div>
          <h1 className="page-title" style={{ fontSize: '1.45rem', margin: 0 }}>
            {step === 'email' && 'Forgot password'}
            {step === 'new_password' && 'Create new password'}
            {step === 'success' && 'Password updated'}
          </h1>
        </div>
        <p className="page-sub" style={{ fontSize: '0.82rem', marginTop: '4px' }}>
          {step === 'email' && 'Type in your university email address to verify your account.'}
          {step === 'new_password' && `Account verified. Enter a new password for ${verifiedName || email}.`}
          {step === 'success' && 'Your password has been changed. You can now sign in with your new credentials.'}
        </p>
      </div>

      {/* Feedback Banner */}
      <div aria-live="polite">
        {feedback && (
          <p
            className={`notice ${feedback.type === 'error' ? 'notice-negative' : 'notice-positive'}`}
            role={feedback.type === 'error' ? 'alert' : undefined}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            {feedback.type === 'error' ? (
              <ShieldAlert size={15} style={{ flexShrink: 0 }} aria-hidden="true" />
            ) : (
              <CheckCircle2 size={15} style={{ flexShrink: 0 }} aria-hidden="true" />
            )}
            <span>{feedback.message}</span>
          </p>
        )}
      </div>

      {/* STEP 1: Enter & Verify Email */}
      {step === 'email' && (
        <form onSubmit={handleVerifyEmail} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Demo account quick test chips */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span className="field-label" style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
              Quick test with registered account
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {DEMO_ACCOUNTS.map((demo) => {
                const isSelected = email.toLowerCase() === demo.email.toLowerCase();
                return (
                  <button
                    key={demo.role}
                    type="button"
                    className="demo-chip"
                    aria-pressed={isSelected}
                    onClick={() => {
                      setEmail(demo.email);
                      setEmailError(null);
                      setFeedback(null);
                      emailInputRef.current?.focus();
                    }}
                    title={`Fill ${demo.name} (${demo.roleTag})`}
                  >
                    <span>{demo.name.split(' ')[0]}</span>
                    <span style={{ opacity: 0.65, fontSize: '0.68rem' }}>({demo.roleTag})</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="forgot-email">
              University email
            </label>
            <div className="input-wrap">
              <input
                id="forgot-email"
                ref={emailInputRef}
                className="input"
                type="email"
                name="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setEmailError(null);
                  setFeedback(null);
                }}
                placeholder="e.g. name@university.edu"
                aria-invalid={Boolean(emailError)}
                aria-describedby={emailError ? 'forgot-email-error' : 'forgot-email-hint'}
                style={{
                  paddingRight: '36px',
                  borderColor: emailError ? 'var(--negative)' : undefined
                }}
                disabled={isSubmitting}
                required
              />
              <div
                className="input-adorn"
                style={{ pointerEvents: 'none', color: emailError ? 'var(--negative)' : 'var(--muted)' }}
                aria-hidden="true"
              >
                <Mail size={16} />
              </div>
            </div>

            {emailError ? (
              <span id="forgot-email-error" className="field-hint" style={{ color: 'var(--negative)', fontSize: '0.74rem' }} role="alert">
                {emailError}
              </span>
            ) : (
              <span id="forgot-email-hint" className="field-hint">
                If the email matches an active account, you can proceed directly to create a new password.
              </span>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="btn btn-primary"
            style={{ width: '100%', height: '40px', marginTop: '4px' }}
            aria-busy={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={15} className="spinner" aria-hidden="true" />
                <span>Verifying email…</span>
              </>
            ) : (
              <>
                <span>Continue</span>
                <ArrowRight size={15} aria-hidden="true" />
              </>
            )}
          </button>
        </form>
      )}

      {/* STEP 2: Enter & Confirm New Password */}
      {step === 'new_password' && (
        <form onSubmit={handleResetPassword} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Verified Account Identity Tag */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              background: 'var(--raised)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-control)',
              fontSize: '0.8rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  background: 'var(--pill-positive-bg)',
                  color: 'var(--pill-positive-ink)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Check size={11} strokeWidth={3} />
              </span>
              <span>
                <strong>{verifiedName}</strong>{' '}
                <span className="muted" style={{ fontSize: '0.75rem' }}>({email})</span>
              </span>
            </div>

            <button
              type="button"
              className="link-button"
              onClick={() => {
                setStep('email');
                setFeedback(null);
                setPasswordError(null);
              }}
              style={{ fontSize: '0.74rem' }}
            >
              Change
            </button>
          </div>

          {/* New Password Field */}
          <div className="field">
            <label className="field-label" htmlFor="reset-new-password">
              New password
            </label>
            <div className="input-wrap">
              <input
                id="reset-new-password"
                ref={passwordInputRef}
                className="input"
                type={showNewPassword ? 'text' : 'password'}
                name="new-password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  setPasswordError(null);
                }}
                placeholder="Enter at least 8 characters"
                required
              />
              <button
                type="button"
                className="input-adorn"
                onClick={() => setShowNewPassword(!showNewPassword)}
                aria-label={showNewPassword ? 'Hide password' : 'Show password'}
              >
                {showNewPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
              </button>
            </div>
          </div>

          {/* Confirm Password Field */}
          <div className="field">
            <label className="field-label" htmlFor="reset-confirm-password">
              Confirm new password
            </label>
            <div className="input-wrap">
              <input
                id="reset-confirm-password"
                className="input"
                type={showConfirmPassword ? 'text' : 'password'}
                name="confirm-password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setPasswordError(null);
                }}
                placeholder="Re-enter your new password"
                required
              />
              <button
                type="button"
                className="input-adorn"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                {showConfirmPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
              </button>
            </div>
          </div>

          {passwordError && (
            <p className="notice notice-negative" role="alert" style={{ fontSize: '0.78rem' }}>
              {passwordError}
            </p>
          )}

          {/* Password Strength Meter */}
          <div>
            <PasswordStrengthMeter password={newPassword} />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="btn btn-primary"
            style={{ width: '100%', height: '40px' }}
            aria-busy={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={15} className="spinner" aria-hidden="true" />
                <span>Updating password…</span>
              </>
            ) : (
              <>
                <span>Reset password</span>
                <ArrowRight size={15} aria-hidden="true" />
              </>
            )}
          </button>
        </form>
      )}

      {/* STEP 3: Success Screen */}
      {step === 'success' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div
            style={{
              padding: '20px',
              borderRadius: 'var(--radius-card)',
              background: 'var(--ground)',
              border: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: 'var(--pill-positive-bg)',
                  color: 'var(--pill-positive-ink)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <CheckCircle2 size={18} />
              </div>
              <div>
                <span style={{ fontSize: '0.88rem', fontWeight: 600, display: 'block' }}>
                  Password successfully changed
                </span>
                <span className="muted" style={{ fontSize: '0.75rem' }}>
                  Account: {email}
                </span>
              </div>
            </div>

            <p className="field-hint" style={{ fontSize: '0.78rem', lineHeight: 1.5, margin: 0 }}>
              Your new password is now active and stored securely. You can sign in immediately with your updated credentials.
            </p>
          </div>

          <button
            type="button"
            className="btn btn-primary"
            style={{ width: '100%', height: '40px' }}
            onClick={() => onBackToSignIn(email, newPassword)}
          >
            <span>Proceed to sign in</span>
            <ArrowRight size={15} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
};

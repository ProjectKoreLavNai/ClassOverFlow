import React, { useState, useEffect, useRef } from 'react';
import { ArrowRight, Mail, CheckCircle2, ShieldAlert, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { DEMO_ACCOUNTS, DEMO_ENABLED } from '../../config/demoAccounts';
import { useRetryCountdown } from '../../utils/useRetryCountdown';

interface ForgotPasswordFormProps {
  initialEmail?: string;
  /** `didReset` is true when the password was changed; the new password itself is never passed on. */
  onBackToSignIn: (email?: string, didReset?: boolean) => void;
}

type Step = 'email' | 'new_password' | 'success';

const TITLES: Record<Step, string> = {
  email: 'Forgot password',
  new_password: 'Choose a new password',
  success: 'Password updated',
};

export const ForgotPasswordForm: React.FC<ForgotPasswordFormProps> = ({
  initialEmail = '',
  onBackToSignIn
}) => {
  const { verifyResetEmail, resetPassword } = useAuth();
  const retry = useRetryCountdown();

  const [step, setStep] = useState<Step>('email');

  // Step 1: email
  const [email, setEmail] = useState<string>(initialEmail);
  const [emailError, setEmailError] = useState<string | null>(null);

  // Step 2: new password
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showNewPassword, setShowNewPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === 'email') emailInputRef.current?.focus();
    else if (step === 'new_password') passwordInputRef.current?.focus();
  }, [step]);

  // Escape returns to sign in.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onBackToSignIn(email, step === 'success');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [email, step, onBackToSignIn]);

  const cleanEmail = email.trim().toLowerCase();

  const handleFailure = (res: { message?: string; retryAfter?: number }, fallback: string) => {
    if (res.retryAfter) {
      retry.start(res.retryAfter);
      setError('Too many attempts. Wait for the timer on the button, then try again.');
    } else {
      setError(res.message || fallback);
    }
  };

  // --- Step 1: check the email ---
  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (retry.isWaiting) return;
    setError(null);
    setEmailError(null);

    if (!cleanEmail) {
      setEmailError('Enter your university email address.');
      emailInputRef.current?.focus();
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await verifyResetEmail(cleanEmail);
      if (res.success) setStep('new_password');
      else handleFailure(res, 'We could not start a reset for that email.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Step 2: set the new password ---
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (retry.isWaiting) return;
    setError(null);
    setPasswordError(null);

    // Length, character mix and the confirm match are validated by the backend.
    setIsSubmitting(true);
    try {
      const res = await resetPassword(cleanEmail, newPassword, confirmPassword);
      if (res.success) {
        // Drop the password from memory as soon as it has been sent.
        setNewPassword('');
        setConfirmPassword('');
        setStep('success');
      } else {
        handleFailure(res, 'Unable to update the password. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitLabel = (idle: string, busy: string) =>
    retry.isWaiting ? `Try again in ${retry.secondsLeft}s` : isSubmitting ? busy : idle;

  return (
    <div className="auth-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h1 className="page-title" style={{ fontSize: '1.45rem', margin: 0 }}>{TITLES[step]}</h1>
        <p className="page-sub" style={{ fontSize: '0.82rem', marginTop: '4px' }}>
          {step === 'email' && 'Enter the university email you sign in with.'}
          {step === 'new_password' && <>Set a new password for <strong translate="no">{cleanEmail}</strong>.</>}
          {step === 'success' && 'Your password has been changed on the server.'}
        </p>
      </div>

      <div aria-live="polite">
        {error && (
          <p className="notice notice-negative" role="alert" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldAlert size={15} style={{ flexShrink: 0 }} aria-hidden="true" />
            <span>{error}</span>
          </p>
        )}
      </div>

      {/* STEP 1 */}
      {step === 'email' && (
        <form onSubmit={handleVerifyEmail} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {DEMO_ENABLED && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span className="field-label" style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
                Demo accounts
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {DEMO_ACCOUNTS.map((demo) => (
                  <button
                    key={demo.role}
                    type="button"
                    className="demo-chip"
                    aria-pressed={cleanEmail === demo.email}
                    onClick={() => {
                      setEmail(demo.email);
                      setEmailError(null);
                      setError(null);
                      emailInputRef.current?.focus();
                    }}
                  >
                    <span>{demo.name.split(' ')[0]}</span>
                    <span style={{ opacity: 0.65, fontSize: '0.68rem' }}>({demo.tag})</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="field">
            <label className="field-label" htmlFor="forgot-email">University email</label>
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
                  setError(null);
                }}
                placeholder="e.g. name@university.edu…"
                aria-invalid={Boolean(emailError)}
                aria-describedby={emailError ? 'forgot-email-error' : undefined}
                style={{ paddingRight: '36px', borderColor: emailError ? 'var(--negative)' : undefined }}
                disabled={isSubmitting}
                required
              />
              <div className="input-adorn" style={{ pointerEvents: 'none', color: emailError ? 'var(--negative)' : 'var(--muted)' }} aria-hidden="true">
                <Mail size={16} />
              </div>
            </div>
            {emailError && (
              <span id="forgot-email-error" className="field-hint" style={{ color: 'var(--negative)', fontSize: '0.74rem' }} role="alert">
                {emailError}
              </span>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting || retry.isWaiting}
            className="btn btn-primary"
            style={{ width: '100%', height: '40px', marginTop: '4px' }}
            aria-busy={isSubmitting}
          >
            {isSubmitting && <Loader2 size={15} className="spinner" aria-hidden="true" />}
            <span>{submitLabel('Set a new password', 'Checking…')}</span>
            {!isSubmitting && !retry.isWaiting && <ArrowRight size={15} aria-hidden="true" />}
          </button>
        </form>
      )}

      {/* STEP 2 */}
      {step === 'new_password' && (
        <form onSubmit={handleResetPassword} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="field">
            <label className="field-label" htmlFor="reset-new-password">New password</label>
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
                aria-describedby="reset-password-rules"
                aria-invalid={Boolean(passwordError)}
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

          <div className="field">
            <label className="field-label" htmlFor="reset-confirm-password">Confirm new password</label>
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
            <p className="notice notice-negative" role="alert" style={{ fontSize: '0.78rem' }}>{passwordError}</p>
          )}

          <p id="reset-password-rules" className="password-hint">
            At least 8 characters, with upper-case, lower-case and a number
          </p>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ height: '40px' }}
              onClick={() => {
                setStep('email');
                setError(null);
                setPasswordError(null);
              }}
            >
              Use another email
            </button>
            <button
              type="submit"
              disabled={isSubmitting || retry.isWaiting}
              className="btn btn-primary"
              style={{ flex: 1, height: '40px' }}
              aria-busy={isSubmitting}
            >
              {isSubmitting && <Loader2 size={15} className="spinner" aria-hidden="true" />}
              <span>{submitLabel('Reset password', 'Updating password…')}</span>
            </button>
          </div>
        </form>
      )}

      {/* STEP 3 */}
      {step === 'success' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p className="notice notice-positive" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={15} style={{ flexShrink: 0 }} aria-hidden="true" />
            <span>Sign in with your new password.</span>
          </p>
          <button
            type="button"
            className="btn btn-primary"
            style={{ width: '100%', height: '40px' }}
            onClick={() => onBackToSignIn(cleanEmail, true)}
          >
            <span>Go to sign in</span>
            <ArrowRight size={15} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
};

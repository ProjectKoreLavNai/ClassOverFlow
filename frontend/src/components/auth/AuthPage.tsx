import React, { useState } from 'react';
import { Eye, EyeOff, ArrowRight, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import type { AcademicRole, FilterResult } from '../../types/auth';
import { PasswordStrengthMeter } from './PasswordStrengthMeter';
import { BrandMark } from '../layout/BrandMark';
import { getPersonTint } from '../../utils/courseTheme';
import { ForgotPasswordForm } from './ForgotPasswordForm';
import { DEMO_ACCOUNTS, DEMO_ENABLED, DEMO_PASSWORD } from '../../config/demoAccounts';
import { useRetryCountdown } from '../../utils/useRetryCountdown';

const FEATURES = [
  ['Course stream', 'Announcements that also reach the class Discord channel and Messenger group.'],
  ['Syllabus coverage', 'Tick off topics as they are taught; students see what is left before the exam.'],
  ['Grades & attendance', 'One register per course, with everyone below the 75% minimum flagged.'],
  ['AI studio', 'Lecture plans and quizzes for teachers, revision notes from slides for students.'],
];

const RECOVERY_FEATURES = [
  ['Saved on the server only', 'Your new password goes straight to the ClassOverflow server. Nothing is kept in this browser.'],
  ['Same rules as sign-up', 'At least 8 characters, with upper- and lower-case letters and a number.'],
  ['Department helpdesk', 'In emergency lockouts, CRs and faculty staff can verify your identity.'],
];

export const AuthPage: React.FC = () => {
  const { login, register, switchPersona } = useAuth();
  const [mode, setMode] = useState<'signin' | 'register' | 'forgot'>('signin');

  // Sign In State. Development builds start on the demo teacher; production starts empty.
  const firstDemo = DEMO_ACCOUNTS[0];
  const [signInEmail, setSignInEmail] = useState(firstDemo?.email ?? '');
  const [signInPassword, setSignInPassword] = useState(firstDemo ? DEMO_PASSWORD : '');
  const [showSignInPassword, setShowSignInPassword] = useState(false);
  const [selectedDemoRole, setSelectedDemoRole] = useState<AcademicRole | null>(firstDemo?.role ?? null);
  const retry = useRetryCountdown();

  // Register State
  const [regFullName, setRegFullName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regRole, setRegRole] = useState<AcademicRole>('student');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Feedback banner
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success' | 'info'; message: string } | null>(null);

  const showFailure = (res: FilterResult) => {
    if (res.success) return;
    if (res.retryAfter) {
      // The countdown on the button carries the wait; the notice says why.
      retry.start(res.retryAfter);
      setFeedback({ type: 'error', message: 'Too many sign-in attempts. Wait for the timer on the button, then try again.' });
      return;
    }
    setFeedback({ type: 'error', message: res.message });
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (retry.isWaiting) return;
    setFeedback(null);
    setIsSubmitting(true);
    try {
      showFailure(await login(signInEmail, signInPassword));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (regPassword !== regConfirmPassword) {
      setFeedback({ type: 'error', message: 'The two passwords do not match. Type the same password in both fields.' });
      return;
    }

    if (retry.isWaiting) return;
    setIsSubmitting(true);
    try {
      showFailure(await register({
        fullName: regFullName,
        username: regUsername,
        email: regEmail,
        phone: regPhone,
        role: regRole,
        password: regPassword
      }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectQuickDemo = (item: { role: AcademicRole; email: string }) => {
    setSelectedDemoRole(item.role);
    setSignInEmail(item.email);
    setSignInPassword(DEMO_PASSWORD);
    setFeedback(null);
  };

  const handleQuickLoginDirect = async (role: AcademicRole) => {
    if (retry.isWaiting) return;
    setFeedback(null);
    showFailure(await switchPersona(role));
  };

  const waitLabel = `Try again in ${retry.secondsLeft}s`;

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        background: 'var(--ground)'
      }}
    >
      <div className="auth-card">
        {/* Left column: the form */}
        <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '20px' }}>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontFamily: 'var(--font-heading)', fontSize: '1.2rem', fontWeight: 700 }}>
              <BrandMark />
              <span translate="no">ClassOverflow</span>
            </div>

            {mode === 'forgot' ? (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setMode('signin');
                  setFeedback(null);
                }}
                style={{ gap: '6px' }}
                aria-label="Back to sign in"
              >
                <ArrowLeft size={13} aria-hidden="true" />
                <span>Back to sign in</span>
              </button>
            ) : (
              <div className="segmented" role="group" aria-label="Sign in or register">
                <button type="button" aria-pressed={mode === 'signin'} onClick={() => { setMode('signin'); setFeedback(null); }}>
                  Sign in
                </button>
                <button type="button" aria-pressed={mode === 'register'} onClick={() => { setMode('register'); setFeedback(null); }}>
                  Register
                </button>
              </div>
            )}
          </div>

          {/* FORGOT PASSWORD VIEW */}
          {mode === 'forgot' ? (
            <ForgotPasswordForm
              initialEmail={signInEmail}
              onBackToSignIn={(email, didReset) => {
                if (email) {
                  setSignInEmail(email);
                  setSelectedDemoRole(null);
                }
                // Never carry the new password across screens; the user types it once more.
                setSignInPassword('');
                setFeedback(didReset
                  ? { type: 'success', message: 'Password updated. Sign in with your new password.' }
                  : null);
                setMode('signin');
              }}
            />
          ) : (
            <>
              <div>
                <h1 className="page-title" style={{ fontSize: '1.45rem' }}>
                  {mode === 'signin' ? 'Sign in to your classes' : 'Create your account'}
                </h1>
                <p className="page-sub" style={{ fontSize: '0.82rem' }}>
                  {mode === 'signin'
                    ? DEMO_ENABLED
                      ? 'Use your university email, or pick a demo account below.'
                      : 'Use your university email and password.'
                    : 'Use your university email so your teacher can verify you.'}
                </p>
              </div>

              {/* Demo accounts (sign-in mode, development builds only) */}
              {mode === 'signin' && DEMO_ENABLED && (
                <fieldset style={{ border: 'none' }}>
                  <legend className="field-label" style={{ marginBottom: '8px' }}>Demo accounts (development build)</legend>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '8px' }}>
                    {DEMO_ACCOUNTS.map((item) => {
                      const isSelected = selectedDemoRole === item.role;
                      return (
                        <button
                          key={item.role}
                          type="button"
                          className="demo-account"
                          aria-pressed={isSelected}
                          onClick={() => handleSelectQuickDemo(item)}
                          onDoubleClick={() => handleQuickLoginDirect(item.role)}
                        >
                          <span className="avatar" style={{ backgroundColor: getPersonTint(item.name) }} aria-hidden="true">
                            {item.name.split(' ').map((p) => p[0]).join('').slice(0, 2)}
                          </span>
                          <span style={{ minWidth: 0 }}>
                            <span className="row-title" style={{ fontSize: '0.74rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                            <span className="row-meta" style={{ marginTop: 0, fontSize: '0.66rem' }}>{item.tag}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              )}

              {/* Feedback */}
              <div aria-live="polite">
                {feedback && (
                  <p className={`notice ${feedback.type === 'error' ? 'notice-negative' : 'notice-positive'}`} role={feedback.type === 'error' ? 'alert' : undefined}>
                    {feedback.message}
                  </p>
                )}
              </div>

              {/* SIGN IN FORM */}
              {mode === 'signin' ? (
                <form onSubmit={handleSignIn} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <label className="field">
                    <span className="field-label">University email</span>
                    <input
                      className="input"
                      type="email"
                      name="email"
                      autoComplete="username"
                      spellCheck={false}
                      value={signInEmail}
                      onChange={(e) => {
                        setSignInEmail(e.target.value);
                        setSelectedDemoRole(null);
                      }}
                      placeholder="e.g. name.role@university.edu…"
                      required
                    />
                  </label>

                  <div className="field">
                    <label className="field-label" htmlFor="signin-password">Password</label>
                    <div className="input-wrap">
                      <input
                        id="signin-password"
                        className="input"
                        type={showSignInPassword ? 'text' : 'password'}
                        name="password"
                        autoComplete="current-password"
                        value={signInPassword}
                        onChange={(e) => setSignInPassword(e.target.value)}
                        required
                      />
                      <button
                        type="button"
                        className="input-adorn"
                        onClick={() => setShowSignInPassword(!showSignInPassword)}
                        aria-label={showSignInPassword ? 'Hide password' : 'Show password'}
                      >
                        {showSignInPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px' }}>
                    <button
                      type="button"
                      className="link-button"
                      style={{ fontFamily: 'var(--font-display)', fontSize: '0.78rem' }}
                      onClick={() => {
                        setFeedback(null);
                        setMode('forgot');
                      }}
                    >
                      Forgot password?
                    </button>
                  </div>

                  <button type="submit" disabled={isSubmitting || retry.isWaiting} className="btn btn-primary" style={{ width: '100%', height: '40px' }}>
                    <span>{retry.isWaiting ? waitLabel : isSubmitting ? 'Signing in…' : 'Sign in'}</span>
                    {!isSubmitting && !retry.isWaiting && <ArrowRight size={15} aria-hidden="true" />}
                  </button>
                </form>
              ) : (
                /* REGISTER FORM */
                <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div className="form-pair">
                    <label className="field">
                      <span className="field-label">Full name</span>
                      <input className="input" type="text" name="name" autoComplete="name" value={regFullName} onChange={(e) => setRegFullName(e.target.value)} placeholder="e.g. Kiyotaka Ayanokoji…" required />
                    </label>
                    <label className="field">
                      <span className="field-label">Username</span>
                      <input className="input" type="text" name="username" autoComplete="username" spellCheck={false} value={regUsername} onChange={(e) => setRegUsername(e.target.value)} placeholder="e.g. ayanokoji_14…" minLength={3} maxLength={50} required />
                    </label>
                  </div>

                  <div className="form-pair">
                    <label className="field">
                      <span className="field-label">University email</span>
                      <input className="input" type="email" name="email" autoComplete="email" spellCheck={false} value={regEmail} onChange={(e) => setRegEmail(e.target.value)} placeholder="e.g. name@university.edu…" required />
                    </label>
                    <label className="field">
                      <span className="field-label">Phone</span>
                      <input className="input" type="tel" name="tel" autoComplete="tel" value={regPhone} onChange={(e) => setRegPhone(e.target.value)} placeholder="e.g. +8801700000000…" required />
                    </label>
                  </div>

                  <div className="form-pair">
                    <label className="field">
                      <span className="field-label">Role</span>
                      <select className="select" name="role" value={regRole} onChange={(e) => setRegRole(e.target.value as AcademicRole)}>
                        <option value="student">Student</option>
                        <option value="teacher">Teacher</option>
                      </select>
                    </label>
                  </div>

                  <div className="form-pair">
                    <div className="field">
                      <label className="field-label" htmlFor="reg-password">Password</label>
                      <div className="input-wrap">
                        <input
                          id="reg-password"
                          className="input"
                          type={showRegPassword ? 'text' : 'password'}
                          name="new-password"
                          autoComplete="new-password"
                          aria-describedby="password-rules"
                          value={regPassword}
                          onChange={(e) => setRegPassword(e.target.value)}
                          required
                        />
                        <button
                          type="button"
                          className="input-adorn"
                          onClick={() => setShowRegPassword(!showRegPassword)}
                          aria-label={showRegPassword ? 'Hide password' : 'Show password'}
                        >
                          {showRegPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                        </button>
                      </div>
                    </div>
                    <label className="field">
                      <span className="field-label">Confirm password</span>
                      <input className="input" type="password" name="confirm-password" autoComplete="new-password" value={regConfirmPassword} onChange={(e) => setRegConfirmPassword(e.target.value)} required />
                    </label>
                  </div>

                  <div id="password-rules">
                    <PasswordStrengthMeter password={regPassword} />
                  </div>

                  <button type="submit" disabled={isSubmitting || retry.isWaiting} className="btn btn-primary" style={{ width: '100%', height: '40px' }}>
                    <span>{retry.isWaiting ? waitLabel : isSubmitting ? 'Creating account…' : 'Create account'}</span>
                    {!isSubmitting && !retry.isWaiting && <ArrowRight size={15} aria-hidden="true" />}
                  </button>
                </form>
              )}
            </>
          )}
        </div>

        {/* Right column: what the product does */}
        <aside className="auth-aside" aria-labelledby="auth-aside-title">
          <div>
            <h2 id="auth-aside-title" style={{ fontSize: '1.75rem', lineHeight: 1.25, marginBottom: '20px' }}>
              {mode === 'forgot' ? 'Secure account recovery.' : 'Your whole semester in one place.'}
            </h2>

            <dl style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {(mode === 'forgot' ? RECOVERY_FEATURES : FEATURES).map(([term, desc]) => (
                <div key={term}>
                  <dt style={{ fontWeight: 500 }}>{term}</dt>
                  <dd className="muted" style={{ fontSize: '0.84rem', marginTop: '2px' }}>{desc}</dd>
                </div>
              ))}
            </dl>
          </div>

          <p className="muted" style={{ fontFamily: 'var(--font-display)', fontSize: '0.72rem', marginTop: '24px' }}>
            Team Pr0jectK0reL4vN4i · Batch 3-1 software project
          </p>
        </aside>
      </div>
    </main>
  );
};

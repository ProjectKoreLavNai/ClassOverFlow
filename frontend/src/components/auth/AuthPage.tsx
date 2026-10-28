import React, { useState } from 'react';
import { Eye, EyeOff, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import type { AcademicRole } from '../../types/auth';
import { PasswordStrengthMeter } from './PasswordStrengthMeter';
import { BrandMark } from '../layout/BrandMark';
import { getPersonTint } from '../../utils/courseTheme';

const FEATURES = [
  ['Course stream', 'Announcements that also reach the class Discord channel and Messenger group.'],
  ['Syllabus coverage', 'Tick off topics as they are taught; students see what is left before the exam.'],
  ['Grades & attendance', 'One register per course, with everyone below the 75% minimum flagged.'],
  ['AI studio', 'Lecture plans and quizzes for teachers, revision notes from slides for students.'],
];

export const AuthPage: React.FC = () => {
  const { login, register, switchPersona } = useAuth();
  const [mode, setMode] = useState<'signin' | 'register'>('signin');

  // Sign In State (Defaulted to Teacher: Gojo Satoru)
  const [signInEmail, setSignInEmail] = useState('gojo.teacher@university.edu');
  const [signInPassword, setSignInPassword] = useState('Password@123');
  const [showSignInPassword, setShowSignInPassword] = useState(false);
  const [selectedDemoRole, setSelectedDemoRole] = useState<AcademicRole | null>('teacher');

  // Register State
  const [regFullName, setRegFullName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regRole, setRegRole] = useState<AcademicRole>('student');
  const [regRoll, setRegRoll] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Feedback banner
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success' | 'info'; message: string } | null>(null);

  const testAccounts: Array<{ role: AcademicRole; name: string; email: string; tag: string }> = [
    { role: 'teacher', name: 'Gojo Satoru', email: 'gojo.teacher@university.edu', tag: 'Teacher' },
    { role: 'cr', name: 'Daemon Targaryen', email: 'daemon.cr@university.edu', tag: 'Class representative' },
    { role: 'student', name: 'Kiyotaka Ayanokoji', email: 'ayanokoji.student@university.edu', tag: 'Student' },
    { role: 'admin', name: 'Aizen Sosuke', email: 'aizen.admin@university.edu', tag: 'Admin' }
  ];

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setIsSubmitting(true);
    try {
      const res = await login(signInEmail, signInPassword);
      if (!res.success) {
        setFeedback({ type: 'error', message: res.message });
      }
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

    setIsSubmitting(true);
    try {
      const res = await register({
        fullName: regFullName,
        username: regUsername,
        email: regEmail,
        phone: regPhone,
        role: regRole,
        roll: regRoll,
        password: regPassword
      });

      if (!res.success) {
        setFeedback({ type: 'error', message: res.message });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectQuickDemo = (item: { role: AcademicRole; email: string }) => {
    setSelectedDemoRole(item.role);
    setSignInEmail(item.email);
    setSignInPassword('Password@123');
    setFeedback(null);
  };

  const handleQuickLoginDirect = async (role: AcademicRole) => {
    setFeedback(null);
    await switchPersona(role);
  };

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

            <div className="segmented" role="group" aria-label="Sign in or register">
              <button type="button" aria-pressed={mode === 'signin'} onClick={() => { setMode('signin'); setFeedback(null); }}>
                Sign in
              </button>
              <button type="button" aria-pressed={mode === 'register'} onClick={() => { setMode('register'); setFeedback(null); }}>
                Register
              </button>
            </div>
          </div>

          <div>
            <h1 className="page-title" style={{ fontSize: '1.45rem' }}>{mode === 'signin' ? 'Sign in to your classes' : 'Create your account'}</h1>
            <p className="page-sub" style={{ fontSize: '0.82rem' }}>
              {mode === 'signin'
                ? 'Use your university email, or pick a demo account below.'
                : 'Use your university email so your teacher can verify you.'}
            </p>
          </div>

          {/* Demo accounts (sign-in mode only) */}
          {mode === 'signin' && (
            <fieldset style={{ border: 'none' }}>
              <legend className="field-label" style={{ marginBottom: '8px' }}>Demo accounts</legend>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '8px' }}>
                {testAccounts.map((item) => {
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

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                <label className="check">
                  <input type="checkbox" name="remember" defaultChecked />
                  <span>Remember me</span>
                </label>
                <button
                  type="button"
                  className="link-button"
                  style={{ fontFamily: 'var(--font-display)', fontSize: '0.78rem' }}
                  onClick={() => alert('Password recovery dispatch sent to your institutional email.')}
                >
                  Forgot password?
                </button>
              </div>

              <button type="submit" disabled={isSubmitting} className="btn btn-primary" style={{ width: '100%', height: '40px' }}>
                <span>{isSubmitting ? 'Signing in…' : 'Sign in'}</span>
                {!isSubmitting && <ArrowRight size={15} aria-hidden="true" />}
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
                    <option value="cr">Class representative</option>
                    <option value="teacher">Teacher</option>
                    <option value="admin">Admin</option>
                  </select>
                </label>
                <label className="field">
                  <span className="field-label">Roll or ID</span>
                  <input className="input" type="text" name="roll" inputMode="numeric" autoComplete="off" value={regRoll} onChange={(e) => setRegRoll(e.target.value)} placeholder="e.g. 14…" />
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

              <button type="submit" disabled={isSubmitting} className="btn btn-primary" style={{ width: '100%', height: '40px' }}>
                <span>{isSubmitting ? 'Creating account…' : 'Create account'}</span>
                {!isSubmitting && <ArrowRight size={15} aria-hidden="true" />}
              </button>
            </form>
          )}
        </div>

        {/* Right column: what the product does */}
        <aside className="auth-aside" aria-labelledby="auth-aside-title">
          <div>
            <h2 id="auth-aside-title" style={{ fontSize: '1.75rem', lineHeight: 1.25, marginBottom: '20px' }}>
              Your whole semester in one place.
            </h2>

            <dl style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {FEATURES.map(([term, desc]) => (
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

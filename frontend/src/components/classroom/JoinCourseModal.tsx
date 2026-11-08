import React, { useState, useEffect } from 'react';
import { X, KeyRound, Check, AlertCircle, BookOpen, UserCheck, ArrowRight } from 'lucide-react';
import { ClassroomAcademicFacade } from '../../patterns/facade/ClassroomAcademicFacade';
import { CourseBlueprint } from '../../patterns/prototype/CoursePrototype';
import { useAuth } from '../../context/AuthContext';
import api, { ApiError, isRateLimited } from '../../services/api';
import { DEMO_ENABLED } from '../../config/demoAccounts';
import { useRetryCountdown } from '../../utils/useRetryCountdown';

// One message for every wrong, expired or unknown code, so the response never
// tells a guesser which codes exist.
const INVALID_CODE_MESSAGE = 'That class code didn’t work. Check it with your teacher and try again.';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onJoined: (course: CourseBlueprint) => void;
  initialCode?: string;
}

export const JoinCourseModal: React.FC<Props> = ({ isOpen, onClose, onJoined, initialCode = '' }) => {
  const { session } = useAuth();
  const [invitationId, setInvitationId] = useState(initialCode);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success' | 'info'; message: string } | null>(null);
  const [matchedCourse, setMatchedCourse] = useState<CourseBlueprint | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const retry = useRetryCountdown();

  const facade = ClassroomAcademicFacade.getInstance();

  useEffect(() => {
    if (isOpen) {
      setInvitationId(initialCode);
      setFeedback(null);
      if (initialCode) {
        const found = facade.getCourseByInvitationId(initialCode);
        setMatchedCourse(found || null);
      } else {
        setMatchedCourse(null);
      }
    }
  }, [isOpen, initialCode]);

  // Live lookup preview as student types
  useEffect(() => {
    const clean = invitationId.trim();
    if (clean.length >= 4) {
      const found = facade.getCourseByInvitationId(clean);
      setMatchedCourse(found || null);
    } else {
      setMatchedCourse(null);
    }
  }, [invitationId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || retry.isWaiting) return;
    setIsJoining(true);
    try {
      const result = await api.joinCourse(invitationId.trim());
      await facade.syncWithBackend();
      const joinedCourse = facade.getCourses().find((course) => course.courseId === result.course_id);
      if (!joinedCourse) throw new Error('Enrollment succeeded but the course is not available in your course list');
      setFeedback({
        type: 'success',
        message: `Successfully joined ${joinedCourse.code}: ${joinedCourse.title}!`
      });
      setTimeout(() => {
        onJoined(joinedCourse);
        onClose();
      }, 1200);
    } catch (error) {
      if (isRateLimited(error)) {
        retry.start(error.retryAfter ?? 30);
        setFeedback({ type: 'error', message: 'Too many tries. Wait for the timer on the button, then try again.' });
      } else if (error instanceof ApiError && [400, 404, 410, 422].includes(error.status)) {
        setFeedback({ type: 'error', message: INVALID_CODE_MESSAGE });
      } else {
        setFeedback({
          type: 'error',
          message: error instanceof Error ? error.message : 'Unable to join course',
        });
      }
    } finally {
      setIsJoining(false);
    }
  };

  // Sample codes for local testing only; never shipped in production builds.
  const activeSampleCodes = DEMO_ENABLED
    ? [
        { code: 'os50-cse3104', label: 'CSE-3104 (OS)' },
        { code: 'ml78-cse3106', label: 'CSE-3106 (ML)' },
        { code: 'c7x9-cse3102', label: 'CSE-3102 (Dev)' },
        { code: 'd3b1-cse3101', label: 'CSE-3101 (DBMS)' }
      ]
    : [];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(10, 10, 10, 0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem'
      }}
      onClick={onClose}
    >
      <div
        className="academic-card"
        style={{
          width: '100%',
          maxWidth: '520px',
          backgroundColor: '#FFFDF9',
          borderRadius: '16px',
          padding: '2.25rem',
          position: 'relative',
          boxShadow: '0 16px 48px rgba(0, 0, 0, 0.18)',
          border: '1px solid var(--color-border-strong)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1.25rem',
            right: '1.25rem',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--color-muted-foreground)',
            padding: '0.4rem',
            borderRadius: '6px'
          }}
          title="Close dialog"
        >
          <X size={20} />
        </button>

        {/* Modal Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              backgroundColor: 'var(--raised)',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text)'
            }}
          >
            <KeyRound size={20} />
          </div>
          <div>
            <h2
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '1.5rem',
                margin: 0,
                color: 'var(--text)'
              }}
            >
              Join course
            </h2>
          </div>
        </div>

        <p
          style={{
            fontSize: '0.88rem',
            color: 'var(--muted)',
            margin: '0.5rem 0 1.25rem',
            lineHeight: 1.5
          }}
        >
          Enter the class code shared by your teacher to join the course.
        </p>

        {/* Feedback Alert */}
        {feedback && (
          <div
            role={feedback.type === 'error' ? 'alert' : 'status'}
            style={{
              padding: '0.85rem 1rem',
              borderRadius: '8px',
              marginBottom: '1.25rem',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.65rem',
              fontSize: '0.88rem',
              backgroundColor:
                feedback.type === 'success'
                  ? 'rgba(74, 93, 79, 0.12)'
                  : feedback.type === 'info'
                  ? 'rgba(197, 160, 89, 0.15)'
                  : 'var(--pill-negative-bg)',
              color:
                feedback.type === 'success'
                  ? 'var(--color-success)'
                  : feedback.type === 'info'
                  ? '#7B5E28'
                  : 'var(--color-accent-secondary)',
              border: `1px solid ${
                feedback.type === 'success'
                  ? 'rgba(74, 93, 79, 0.3)'
                  : feedback.type === 'info'
                  ? 'rgba(197, 160, 89, 0.4)'
                  : '#f0c4c6'
              }`
            }}
          >
            {feedback.type === 'success' ? (
              <Check size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            ) : (
              <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            )}
            <div>{feedback.message}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label
              style={{
                display: 'block',
                fontFamily: 'var(--font-display)',
                fontSize: '0.74rem',
                fontWeight: 600,
                color: 'var(--text)',
                marginBottom: '0.45rem'
              }}
            >
              Class code
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                value={invitationId}
                onChange={(e) => setInvitationId(e.target.value)}
                placeholder="e.g. os50-cse3104 or ml78-cse3106"
                required
                autoFocus
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  border: '1.5px solid var(--color-border-strong)',
                  backgroundColor: '#FFFFFF',
                  fontFamily: 'monospace',
                  fontSize: '1.05rem',
                  fontWeight: 600,
                  boxSizing: 'border-box',
                  color: 'var(--color-foreground)',
                  outline: 'none',
                  transition: 'border-color 0.15s ease, box-shadow 0.15s ease'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'var(--color-accent)';
                  e.target.style.boxShadow = '0 0 0 3px rgba(29, 95, 191, 0.18)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'var(--color-border-strong)';
                  e.target.style.boxShadow = 'none';
                }}
              />
              {matchedCourse && (
                <span
                  style={{
                    position: 'absolute',
                    right: '1rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    fontSize: '0.76rem',
                    color: 'var(--color-success)',
                    fontWeight: 700,
                    backgroundColor: 'rgba(74, 93, 79, 0.12)',
                    padding: '0.2rem 0.5rem',
                    borderRadius: '4px'
                  }}
                >
                  <Check size={13} /> Matched
                </span>
              )}
            </div>
          </div>

          {/* Matched Course Live Preview Card */}
          {matchedCourse && (
            <div
              style={{
                padding: '1rem 1.15rem',
                backgroundColor: 'var(--color-surface-sunken)',
                borderRadius: '10px',
                border: '1px solid var(--color-border)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.9rem'
              }}
            >
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '8px',
                  background: matchedCourse.bannerBg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFFFFF',
                  flexShrink: 0,
                  boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
                }}
              >
                <BookOpen size={20} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <strong style={{ fontSize: '0.95rem', color: 'var(--color-foreground)' }}>
                    {matchedCourse.code}
                  </strong>
                  <span style={{ fontSize: '0.78rem', color: 'var(--color-muted-foreground)' }}>
                    • {matchedCourse.term}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: '0.84rem',
                    color: 'var(--color-muted-foreground)',
                    marginTop: '0.15rem',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {matchedCourse.title} • {matchedCourse.instructor}
                </div>
              </div>

              {session && facade.isStudentEnrolled(matchedCourse.code, session.email) && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    fontSize: '0.75rem',
                    color: 'var(--color-accent-text)',
                    fontWeight: 600,
                    padding: '0.2rem 0.5rem',
                    borderRadius: '4px',
                    backgroundColor: 'rgba(122, 137, 115, 0.15)'
                  }}
                >
                  <UserCheck size={13} /> Enrolled
                </span>
              )}
            </div>
          )}

          {/* Demo Invitation Codes Chip Quick-selector */}
          {activeSampleCodes.length > 0 && (
          <div>
            <span
              style={{
                display: 'block',
                fontSize: '0.74rem',
                fontFamily: 'var(--font-display)',
                color: 'var(--color-muted-foreground)',
                marginBottom: '0.45rem'
              }}
            >
              Sample class codes
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
              {activeSampleCodes.map((sample) => (
                <button
                  key={sample.code}
                  type="button"
                  onClick={() => setInvitationId(sample.code)}
                  style={{
                    background: invitationId === sample.code ? 'var(--color-accent-text)' : 'var(--color-surface-sunken)',
                    color: invitationId === sample.code ? '#FFFFFF' : 'var(--color-foreground)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '6px',
                    padding: '0.3rem 0.6rem',
                    fontSize: '0.78rem',
                    fontFamily: 'monospace',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {sample.code}
                </button>
              ))}
            </div>
          </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.75rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              style={{ padding: '0.65rem 1.25rem' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isJoining || retry.isWaiting}
              style={{
                padding: '0.65rem 1.4rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem'
              }}
            >
              <span>
                {retry.isWaiting ? `Try again in ${retry.secondsLeft}s` : isJoining ? 'Joining…' : 'Join course'}
              </span>
              {!retry.isWaiting && <ArrowRight size={16} aria-hidden="true" />}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

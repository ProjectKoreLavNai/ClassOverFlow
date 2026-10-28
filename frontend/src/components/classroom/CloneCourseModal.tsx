import React, { useState } from 'react';
import { Copy, X, Sparkles, Check } from 'lucide-react';
import { ClassroomAcademicFacade } from '../../patterns/facade/ClassroomAcademicFacade';
import { CourseBlueprint } from '../../patterns/prototype/CoursePrototype';
import { useAuth } from '../../context/AuthContext';

interface Props {
  sourceCourse: CourseBlueprint;
  isOpen: boolean;
  onClose: () => void;
  onCloned: (clonedCourse: CourseBlueprint) => void;
}

export const CloneCourseModal: React.FC<Props> = ({ sourceCourse, isOpen, onClose, onCloned }) => {
  const { session } = useAuth();
  const [newTitle, setNewTitle] = useState(sourceCourse.title);
  const [newTerm, setNewTerm] = useState('Spring 2027');
  const [newCode, setNewCode] = useState(`${sourceCourse.code}-2`);
  const [feedback, setFeedback] = useState<string | null>(null);

  if (!isOpen) return null;

  const totalTopics = sourceCourse.units.reduce((acc, u) => acc + u.topics.length, 0);

  const handleClone = (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;

    const facade = ClassroomAcademicFacade.getInstance();
    const startTime = performance.now();
    const result = facade.cloneCourseBlueprint(
      sourceCourse.code,
      newTitle,
      newTerm,
      newCode,
      session
    );
    const elapsed = Math.round(performance.now() - startTime);

    if (result.success && result.clonedCourse) {
      setFeedback(`Cloned in ${elapsed}ms via Prototype pattern! New join code: ${result.clonedCourse.cohortCode}`);
      setTimeout(() => {
        onCloned(result.clonedCourse!);
        onClose();
      }, 1000);
    } else {
      setFeedback(result.message);
    }
  };

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
          backgroundColor: 'var(--color-background)',
          borderRadius: '12px',
          padding: '2rem',
          position: 'relative',
          boxShadow: '0 16px 48px rgba(0, 0, 0, 0.18)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted-foreground)' }}
        >
          <X size={20} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-accent-text)', marginBottom: '0.4rem' }}>
          <Sparkles size={18} />
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.72rem', fontWeight: 700 }}>
            Pattern 5: Prototype Pattern (Deep Clone)
          </span>
        </div>

        <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', marginBottom: '0.5rem' }}>
          Duplicate Course Blueprint
        </h3>

        <p style={{ fontSize: '0.86rem', color: 'var(--color-muted-foreground)', marginBottom: '1.25rem' }}>
          Deep-copies all <strong>{sourceCourse.units.length} units</strong> and <strong>{totalTopics} syllabus topics</strong> from <em>{sourceCourse.code}</em>. Completed progress will reset to 0% and a brand-new enrollment code will be generated.
        </p>

        {feedback && (
          <div
            style={{
              padding: '0.65rem 0.85rem',
              borderRadius: '6px',
              backgroundColor: 'rgba(79, 107, 58, 0.1)',
              border: '1px solid var(--color-success)',
              color: 'var(--color-success)',
              fontSize: '0.84rem',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}
          >
            <Check size={16} />
            <span>{feedback}</span>
          </div>
        )}

        <form onSubmit={handleClone} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
          <div>
            <label style={{ display: 'block', fontFamily: 'var(--font-display)', fontSize: '0.72rem', fontWeight: 600, marginBottom: '0.25rem' }}>
              Cloned Course Code
            </label>
            <input
              type="text"
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              required
              style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '6px', border: '1px solid var(--color-border-strong)', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontFamily: 'var(--font-display)', fontSize: '0.72rem', fontWeight: 600, marginBottom: '0.25rem' }}>
              New Course Title
            </label>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              required
              style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '6px', border: '1px solid var(--color-border-strong)', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontFamily: 'var(--font-display)', fontSize: '0.72rem', fontWeight: 600, marginBottom: '0.25rem' }}>
              Target Academic Term
            </label>
            <select
              value={newTerm}
              onChange={(e) => setNewTerm(e.target.value)}
              style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '6px', border: '1px solid var(--color-border-strong)', background: 'var(--color-background)', boxSizing: 'border-box' }}
            >
              <option value="Spring 2027">Spring 2027</option>
              <option value="Summer 2027">Summer 2027</option>
              <option value="Fall 2027">Fall 2027</option>
              <option value="Special Term">Special Remedial Term</option>
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Copy size={15} />
              <span>Clone Blueprint (≤150ms)</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

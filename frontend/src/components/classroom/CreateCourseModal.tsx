import React, { useState } from 'react';
import { X } from 'lucide-react';
import { ClassroomAcademicFacade } from '../../patterns/facade/ClassroomAcademicFacade';
import { CourseBlueprint } from '../../patterns/prototype/CoursePrototype';
import { useAuth } from '../../context/AuthContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (course: CourseBlueprint) => void;
}

export const CreateCourseModal: React.FC<Props> = ({ isOpen, onClose, onCreated }) => {
  const { session } = useAuth();
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [term, setTerm] = useState('Fall 2026');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;

    const facade = ClassroomAcademicFacade.getInstance();
    const result = facade.createCourse(code, title, term, session);

    if (result.success && result.course) {
      onCreated(result.course);
      onClose();
    } else {
      setError(result.message);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-course-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="btn btn-ghost btn-sm btn-icon modal-close" aria-label="Close">
          <X size={18} aria-hidden="true" />
        </button>

        <h2 id="create-course-title" className="modal-title">Create course</h2>
        <p className="modal-desc">
          The course gets a syllabus template and a class code students can join with.
        </p>

        {error && (
          <p className="notice notice-negative" role="alert" style={{ marginBottom: '16px' }}>{error}</p>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <label className="field">
            <span className="field-label">Course code</span>
            <input
              className="input"
              type="text"
              name="course-code"
              autoComplete="off"
              spellCheck={false}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. CSE-3103…"
              required
              autoFocus
            />
          </label>

          <label className="field">
            <span className="field-label">Course title</span>
            <input
              className="input"
              type="text"
              name="course-title"
              autoComplete="off"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Compiler Design & Formal Languages…"
              required
            />
          </label>

          <label className="field">
            <span className="field-label">Term</span>
            <input
              className="input"
              type="text"
              name="course-term"
              autoComplete="off"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="e.g. Fall 2026…"
              required
            />
          </label>

          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Create course
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

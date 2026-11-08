import React, { useState } from 'react';
import { Copy, X, Check } from 'lucide-react';
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
    const result = facade.cloneCourseBlueprint(
      sourceCourse.code,
      newTitle,
      newTerm,
      newCode,
      session
    );

    if (result.success && result.clonedCourse) {
      setFeedback(`Course duplicated. New class code: ${result.clonedCourse.cohortCode}`);
      setTimeout(() => {
        onCloned(result.clonedCourse!);
        onClose();
      }, 1000);
    } else {
      setFeedback(result.message);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="clone-course-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="btn btn-ghost btn-sm btn-icon modal-close"
          aria-label="Close"
        >
          <X size={18} aria-hidden="true" />
        </button>

        <h2 id="clone-course-title" className="modal-title">
          Duplicate course
        </h2>

        <p className="modal-desc">
          Copies all {sourceCourse.units.length} units and {totalTopics} syllabus topics from {sourceCourse.code} into a new term with a fresh class code.
        </p>

        {feedback && (
          <p className="notice notice-positive" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Check size={15} aria-hidden="true" />
            <span>{feedback}</span>
          </p>
        )}

        <form onSubmit={handleClone} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <label className="field">
            <span className="field-label">Course code</span>
            <input
              className="input"
              type="text"
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              required
            />
          </label>

          <label className="field">
            <span className="field-label">Course title</span>
            <input
              className="input"
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              required
            />
          </label>

          <label className="field">
            <span className="field-label">Term</span>
            <select
              className="select"
              value={newTerm}
              onChange={(e) => setNewTerm(e.target.value)}
            >
              <option value="Spring 2027">Spring 2027</option>
              <option value="Summer 2027">Summer 2027</option>
              <option value="Fall 2027">Fall 2027</option>
              <option value="Special Term">Special Term</option>
            </select>
          </label>

          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              <Copy size={15} aria-hidden="true" />
              <span>Duplicate course</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

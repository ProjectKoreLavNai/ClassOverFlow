import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, RotateCcw } from 'lucide-react';
import api from '../../services/api';

export interface MarksDistributionItem {
  name: string;
  total_marks: number;
}

export const DEFAULT_MARKS_DISTRIBUTION: MarksDistributionItem[] = [
  { name: 'Attendance', total_marks: 5 },
  { name: 'Assignment/presentation', total_marks: 5 },
  { name: 'CT', total_marks: 10 },
  { name: 'Mid term', total_marks: 20 },
  { name: 'Final', total_marks: 60 },
];

export const getStoredMarksDistribution = (courseId: number): MarksDistributionItem[] => {
  try {
    const raw = localStorage.getItem(`classoverflow_marks_dist_${courseId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((item) => ({
          name: String(item.name).trim(),
          total_marks: Math.max(0.01, Number(item.total_marks) || 0),
        }));
      }
    }
  } catch {
    // fallback to default
  }
  return DEFAULT_MARKS_DISTRIBUTION;
};

export const storeMarksDistribution = (courseId: number, items: MarksDistributionItem[]): void => {
  try {
    localStorage.setItem(`classoverflow_marks_dist_${courseId}`, JSON.stringify(items));
  } catch {
    // localStorage failure fallback
  }
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  courseId: number;
  initialDistribution?: MarksDistributionItem[];
  onSaved: (items: MarksDistributionItem[]) => void;
}

export const MarksDistributionModal: React.FC<Props> = ({
  isOpen,
  onClose,
  courseId,
  initialDistribution,
  onSaved,
}) => {
  const [items, setItems] = useState<MarksDistributionItem[]>(() =>
    initialDistribution && initialDistribution.length > 0
      ? initialDistribution
      : getStoredMarksDistribution(courseId)
  );
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setItems(
        initialDistribution && initialDistribution.length > 0
          ? initialDistribution
          : getStoredMarksDistribution(courseId)
      );
      setError(null);
    }
  }, [isOpen, courseId, initialDistribution]);

  // Keyboard navigation: Escape key closes modal
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const totalSum = Math.round(items.reduce((sum, item) => sum + (Number(item.total_marks) || 0), 0) * 100) / 100;

  const handleItemChange = (index: number, field: keyof MarksDistributionItem, value: string) => {
    setItems((prev) => {
      const updated = [...prev];
      if (field === 'name') {
        updated[index] = { ...updated[index], name: value };
      } else {
        const numVal = parseFloat(value);
        updated[index] = { ...updated[index], total_marks: isNaN(numVal) ? 0 : numVal };
      }
      return updated;
    });
    setError(null);
  };

  const handleAddItem = () => {
    setItems((prev) => [...prev, { name: '', total_marks: 10 }]);
    setError(null);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      setError('At least one assessment category is required.');
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
    setError(null);
  };

  const handleResetDefault = () => {
    setItems(DEFAULT_MARKS_DISTRIBUTION);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    const cleanItems: MarksDistributionItem[] = [];
    const seenNames = new Set<string>();

    for (const item of items) {
      const trimmedName = item.name.trim();
      if (!trimmedName) {
        setError('Assessment category name cannot be empty.');
        return;
      }
      const lower = trimmedName.toLowerCase();
      if (seenNames.has(lower)) {
        setError(`Duplicate assessment name: "${trimmedName}". Names must be unique.`);
        return;
      }
      seenNames.add(lower);

      const markVal = Number(item.total_marks);
      if (isNaN(markVal) || markVal <= 0) {
        setError(`Total marks for "${trimmedName}" must be greater than 0.`);
        return;
      }
      cleanItems.push({ name: trimmedName, total_marks: markVal });
    }

    setIsSaving(true);
    try {
      const savedItems = await api.saveMarksDistribution(courseId, cleanItems);
      storeMarksDistribution(courseId, cleanItems);
      onSaved(savedItems);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save marks distribution');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="marks-dist-title"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '580px', width: '92%' }}
      >
        <button
          onClick={onClose}
          className="btn btn-ghost btn-sm btn-icon modal-close"
          aria-label="Close"
        >
          <X size={18} aria-hidden="true" />
        </button>

        <h2 id="marks-dist-title" className="modal-title">
          Marks distribution
        </h2>
        <p className="modal-desc">
          Set the assessment categories and maximum marks for this course.
        </p>

        {error && (
          <p className="notice notice-negative" role="alert" style={{ marginBottom: '14px' }}>
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="stack" style={{ gap: '14px' }}>
          {/* Default Standard Banner */}
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-control)',
              backgroundColor: 'var(--raised)',
              border: '1px solid var(--border)',
              fontSize: '0.82rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <span className="muted">
              Default: Attendance (5), Assignment/presentation (5), CT (10), Mid term (20), Final (60)
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={handleResetDefault}
              title="Reset to default distribution"
              style={{ fontSize: '0.78rem', height: '28px', padding: '0 8px', whiteSpace: 'nowrap' }}
            >
              <RotateCcw size={13} aria-hidden="true" />
              <span>Reset</span>
            </button>
          </div>

          {/* Assessment items list */}
          <div
            style={{
              maxHeight: '320px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              paddingRight: '4px',
            }}
          >
            {items.map((item, index) => (
              <div
                key={index}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 100px 36px',
                  gap: '8px',
                  alignItems: 'center',
                  background: 'var(--surface)',
                  padding: '6px 8px',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                }}
              >
                <div>
                  <input
                    className="input"
                    type="text"
                    value={item.name}
                    placeholder="Assessment name (e.g. CT, Final)"
                    maxLength={150}
                    onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                    aria-label={`Assessment name ${index + 1}`}
                    required
                    style={{ fontSize: '0.88rem' }}
                  />
                </div>
                <div>
                  <div style={{ position: 'relative' }}>
                    <input
                      className="input num"
                      type="number"
                      step="0.5"
                      min="0.5"
                      max="100"
                      value={item.total_marks || ''}
                      onChange={(e) => handleItemChange(index, 'total_marks', e.target.value)}
                      aria-label={`Total marks for ${item.name}`}
                      required
                      style={{ fontSize: '0.88rem', paddingRight: '22px' }}
                    />
                    <span
                      style={{
                        position: 'absolute',
                        right: '7px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        fontSize: '0.72rem',
                        color: 'var(--muted)',
                        pointerEvents: 'none',
                      }}
                    >
                      m
                    </span>
                  </div>
                </div>
                <div>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm btn-icon"
                    onClick={() => handleRemoveItem(index)}
                    title="Remove assessment"
                    disabled={items.length <= 1}
                    style={{
                      color: items.length > 1 ? 'var(--negative)' : 'var(--muted)',
                      opacity: items.length <= 1 ? 0.35 : 1,
                      width: '32px',
                      height: '32px',
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Add item button */}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleAddItem}
            style={{ alignSelf: 'flex-start' }}
          >
            <Plus size={14} aria-hidden="true" />
            <span>Add category</span>
          </button>

          {/* Total & Summary bar */}
          <div
            style={{
              paddingTop: '12px',
              borderTop: '1px solid var(--rule)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
            }}
          >
            <div className="num" style={{ fontSize: '0.88rem' }}>
              <span className="muted">Total: </span>
              <strong style={{ fontWeight: 600 }}>{totalSum} marks</strong>
              {totalSum !== 100 && (
                <span className="muted" style={{ marginLeft: '8px', fontSize: '0.78rem' }}>
                  (standard total is 100)
                </span>
              )}
            </div>

            <div className="modal-actions" style={{ marginTop: 0 }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={onClose}
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={isSaving}
              >
                {isSaving ? 'Saving…' : 'Save distribution'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

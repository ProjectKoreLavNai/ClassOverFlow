import React from 'react';
import { ShieldAlert, X } from 'lucide-react';
import type { SecurityViolation } from '../../patterns/proxy';

interface Props {
  violation: SecurityViolation | null;
  onClose: () => void;
}

export const ForbiddenModal: React.FC<Props> = ({ violation, onClose }) => {
  if (!violation) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="forbidden-title"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '440px' }}
      >
        <button
          onClick={onClose}
          className="btn btn-ghost btn-sm btn-icon modal-close"
          aria-label="Close"
        >
          <X size={18} aria-hidden="true" />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <ShieldAlert size={20} style={{ color: 'var(--negative)', flexShrink: 0 }} aria-hidden="true" />
          <h2 id="forbidden-title" className="modal-title" style={{ margin: 0 }}>
            Access restricted
          </h2>
        </div>

        <p className="modal-desc" style={{ marginBottom: '20px' }}>
          Your <strong>{violation.currentRole}</strong> account cannot access{' '}
          <strong>{violation.resource}</strong>. Required role:{' '}
          <strong>{violation.requiredRole}</strong>.
        </p>

        <div className="modal-actions">
          <button className="btn btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

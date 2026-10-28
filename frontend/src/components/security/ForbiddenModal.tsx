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
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(10, 10, 10, 0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '1rem'
      }}
      className="animate-fade-in"
    >
      <div
        style={{
          background: 'var(--color-background)',
          border: '2px solid var(--color-accent-secondary)',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '480px',
          padding: '2rem',
          boxShadow: '0 16px 48px rgba(0, 0, 0, 0.18)',
          textAlign: 'center',
          position: 'relative'
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: 'none',
            border: 'none',
            color: 'var(--color-muted-foreground)',
            cursor: 'pointer'
          }}
        >
          <X size={18} />
        </button>

        <div
          style={{
            width: '56px',
            height: '56px',
            margin: '0 auto 1.25rem',
            background: 'var(--pill-negative-bg)',
            border: '2px solid var(--color-accent-secondary)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-accent-secondary)'
          }}
        >
          <ShieldAlert size={28} />
        </div>

        <span
          style={{
            display: 'inline-block',
            fontFamily: 'var(--font-display)',
            fontSize: '0.74rem',
            fontWeight: 700,
            color: 'var(--color-accent-secondary)',
            marginBottom: '0.75rem'
          }}
        >
          RBAC Security Notice
        </span>

        <h3
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '1.5rem',
            color: 'var(--color-accent-secondary)',
            marginBottom: '0.5rem'
          }}
        >
          403 Access Forbidden
        </h3>

        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '0.95rem',
            color: 'var(--color-muted-foreground)',
            marginBottom: '1.5rem',
            lineHeight: 1.5
          }}
        >
          Your active persona (<strong>{violation.currentRole}</strong>) lacks permission to access{' '}
          <strong style={{ color: 'var(--color-foreground)' }}>{violation.resource}</strong>.
          <br /><br />
          Required authorization level: <span style={{ color: 'var(--color-accent-secondary)', fontWeight: 600 }}>{violation.requiredRole}</span>.
        </p>

        <button
          className="btn btn-primary"
          style={{ width: '100%', padding: '0.75rem' }}
          onClick={onClose}
        >
          Acknowledge & Return Safely
        </button>
      </div>
    </div>
  );
};

import React from 'react';
import {
  X,
  ShieldCheck,
  BookOpen,
  Megaphone,
  CheckSquare,
  ShieldAlert,
  FileSpreadsheet,
  Building,
  Mail,
  Phone,
  Hash
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const ProfileModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { session } = useAuth();

  if (!isOpen || !session) return null;

  // Master capability list - each mapped to its session permission check
  const systemFeatures = [
    {
      id: 'admin_console',
      title: 'Institutional Administration & Governance',
      description: 'Manage institutional accounts, verify domains, and audit course lifecycles.',
      icon: ShieldAlert,
      color: 'var(--color-accent-secondary)',
      hasAccess: session.canAccessAdmin()
    },
    {
      id: 'cr_desk',
      title: 'CR Coordination & Multi-Channel Broadcast',
      description: 'Synchronize schedule changes and broadcast emergency deadline alerts to Discord & Messenger.',
      icon: Megaphone,
      color: 'var(--color-info)',
      hasAccess: session.canAccessCRDesk()
    },
    {
      id: 'course_creation',
      title: 'Course Inception & Curriculum Management',
      description: 'Establish new course offerings, assign grading weights, and enroll students.',
      icon: BookOpen,
      color: 'var(--color-accent)',
      hasAccess: session.canCreateCourse()
    },
    {
      id: 'gradebook_edit',
      title: 'Transactional Gradebook Modification',
      description: 'Record, revise, and publish in-course assessment marks.',
      icon: FileSpreadsheet,
      color: 'var(--color-success)',
      hasAccess: session.canEditGrades()
    },
    {
      id: 'submit_work',
      title: 'Coursework & Laboratory Task Submission',
      description: 'Submit assignments, SRS models, and review automated feedback.',
      icon: CheckSquare,
      color: 'var(--color-info)',
      hasAccess: session.canSubmitWork()
    },
    {
      id: 'broadcast_alerts',
      title: 'Cohort Announcement Broadcast',
      description: 'Authorize multi-channel webhook broadcasts to cohort communication channels.',
      icon: Megaphone,
      color: 'var(--color-accent-text)',
      hasAccess: session.canBroadcastAlerts()
    }
  ];

  // REMOVE features where the user does NOT have access
  const authorizedFeatures = systemFeatures.filter((f) => f.hasAccess);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(10, 10, 10, 0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        zIndex: 1000
      }}
      onClick={onClose}
    >
      <div
        className="academic-card"
        style={{
          width: '100%',
          maxWidth: '560px',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '2rem',
          position: 'relative',
          backgroundColor: 'var(--color-background)',
          borderRadius: '14px',
          boxShadow: '0 16px 48px rgba(0, 0, 0, 0.18)'
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
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--color-muted-foreground)',
            padding: '4px',
            borderRadius: '6px'
          }}
          title="Close profile interface"
        >
          <X size={20} />
        </button>

        {/* Profile Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '1.5rem' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: 'var(--color-surface-sunken)',
              border: '2px solid var(--color-accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-heading)',
              fontWeight: 700,
              fontSize: '1.5rem',
              color: 'var(--color-foreground)',
              flexShrink: 0
            }}
          >
            {session.avatar}
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '1.5rem', fontFamily: 'var(--font-heading)', color: 'var(--color-foreground)', margin: 0 }}>
                {session.name}
              </h2>
              <span className="status-chip chip-verified" style={{ fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                <ShieldCheck size={12} />
                Verified .edu
              </span>
            </div>
            <span style={{ display: 'block', fontSize: '0.85rem', fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--color-accent-text)', marginTop: '0.2rem' }}>
              {session.getRoleLabel()}
            </span>
          </div>
        </div>

        {/* Academic Details Section */}
        <div
          style={{
            backgroundColor: 'var(--color-surface-sunken)',
            border: '1px solid var(--color-border)',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1.5rem',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '0.75rem',
            fontSize: '0.84rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-muted-foreground)' }}>
            <Mail size={15} color="var(--color-accent-text)" />
            <span style={{ color: 'var(--color-foreground)' }}>{session.email}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-muted-foreground)' }}>
            <Building size={15} color="var(--color-accent-text)" />
            <span style={{ color: 'var(--color-foreground)' }}>{session.department}</span>
          </div>

          {session.roll && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-muted-foreground)' }}>
              <Hash size={15} color="var(--color-accent-text)" />
              <span style={{ color: 'var(--color-foreground)' }}>Roll / ID: {session.roll}</span>
            </div>
          )}

          {session.phone && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-muted-foreground)' }}>
              <Phone size={15} color="var(--color-accent-text)" />
              <span style={{ color: 'var(--color-foreground)' }}>{session.phone}</span>
            </div>
          )}
        </div>

        {/* Authorized Features Section (Unauthorized features removed) */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.75rem' }}>
            <h4 style={{ fontSize: '1.05rem', fontFamily: 'var(--font-heading)', margin: 0 }}>
              Authorized Platform Features
            </h4>
            <span style={{ fontSize: '0.74rem', fontFamily: 'var(--font-display)', color: 'var(--color-muted-foreground)' }}>
              {authorizedFeatures.length} accessible features
            </span>
          </div>

          <p style={{ fontSize: '0.8rem', color: 'var(--color-muted-foreground)', marginBottom: '1rem' }}>
            Features where this account lacks access are removed per Role-Based Access Control (RBAC).
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {authorizedFeatures.map((feat) => {
              const Icon = feat.icon;
              return (
                <div
                  key={feat.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.75rem',
                    padding: '0.75rem 0.9rem',
                    backgroundColor: 'var(--color-background)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '8px'
                  }}
                >
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '6px',
                      backgroundColor: 'var(--color-surface-sunken)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: feat.color,
                      flexShrink: 0,
                      marginTop: '2px'
                    }}
                  >
                    <Icon size={16} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '0.88rem', color: 'var(--color-foreground)' }}>
                        {feat.title}
                      </strong>
                      <span className="status-chip chip-verified" style={{ fontSize: '0.72rem' }}>
                        <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: 'var(--color-success)', display: 'inline-block' }} />
                        Active
                      </span>
                    </div>
                    <p style={{ fontSize: '0.78rem', color: 'var(--color-muted-foreground)', margin: '0.2rem 0 0' }}>
                      {feat.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer Actions */}
        <div style={{ marginTop: '1.75rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            Close Profile
          </button>
        </div>
      </div>
    </div>
  );
};

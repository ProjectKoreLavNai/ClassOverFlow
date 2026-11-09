import React, { useEffect, useState } from 'react';
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
  Hash,
  Pencil,
  Save
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const ProfileModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { session, updateProfile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [profileFeedback, setProfileFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    if (!session) return;
    setFullName(session.name);
    setUsername(session.username || session.email.split('@')[0]);
    setPhone(session.phone || '');
  }, [session, isOpen]);

  if (!isOpen || !session) return null;

  const handleProfileSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setProfileFeedback(null);
    try {
      await updateProfile({
        fullName,
        username,
        ...(session.role !== 'admin' ? { phone } : {}),
      });
      setIsEditing(false);
      setProfileFeedback({ type: 'success', message: 'Profile updated.' });
    } catch (error) {
      setProfileFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : 'Unable to update profile',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Master capability list - each mapped to its session permission check
  const systemFeatures = [
    {
      id: 'admin_console',
      title: 'Admin console',
      description: 'Verify accounts, manage user roles, and retire courses.',
      icon: ShieldAlert,
      color: 'var(--color-accent-secondary)',
      hasAccess: session.canAccessAdmin()
    },
    {
      id: 'cr_desk',
      title: 'CR desk',
      description: 'Coordinate schedule polls and send deadline reminders to Discord and Messenger.',
      icon: Megaphone,
      color: 'var(--color-info)',
      hasAccess: session.canAccessCRDesk()
    },
    {
      id: 'course_creation',
      title: 'Course management',
      description: 'Create courses, generate class codes, and configure marks distribution.',
      icon: BookOpen,
      color: 'var(--color-accent)',
      hasAccess: session.canCreateCourse()
    },
    {
      id: 'gradebook_edit',
      title: 'Attendance & gradebook',
      description: 'Record daily attendance and save assessment marks.',
      icon: FileSpreadsheet,
      color: 'var(--color-success)',
      hasAccess: session.canEditGrades()
    },
    {
      id: 'submit_work',
      title: 'Coursework & study tools',
      description: 'Track upcoming assignments and generate lecture revision notes.',
      icon: CheckSquare,
      color: 'var(--color-info)',
      hasAccess: session.canSubmitWork()
    },
    {
      id: 'broadcast_alerts',
      title: 'Class announcements',
      description: 'Post announcements to the course stream and connected channels.',
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

        {profileFeedback && (
          <p className={`notice ${profileFeedback.type === 'error' ? 'notice-negative' : 'notice-positive'}`} role={profileFeedback.type === 'error' ? 'alert' : 'status'}>
            {profileFeedback.message}
          </p>
        )}

        {isEditing ? (
          <form
            id="profile-update-form"
            onSubmit={handleProfileSubmit}
            style={{
              backgroundColor: 'var(--color-surface-sunken)',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.85rem',
            }}
          >
            <label className="field">
              <span className="field-label">Full name</span>
              <input className="input" value={fullName} onChange={(event) => setFullName(event.target.value)} required />
            </label>
            <label className="field">
              <span className="field-label">Username</span>
              <input className="input" value={username} onChange={(event) => setUsername(event.target.value)} required />
            </label>
            <label className="field">
              <span className="field-label">Email (cannot be changed)</span>
              <input className="input" type="email" value={session.email} readOnly aria-readonly="true" />
            </label>
            {session.role !== 'admin' && (
              <label className="field">
                <span className="field-label">Phone</span>
                <input className="input" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} />
              </label>
            )}
          </form>
        ) : (
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
        )}

        {/* Authorized Features Section */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.75rem' }}>
            <h4 style={{ fontSize: '1.05rem', fontFamily: 'var(--font-heading)', margin: 0 }}>
              Permissions
            </h4>
            <span style={{ fontSize: '0.74rem', fontFamily: 'var(--font-display)', color: 'var(--color-muted-foreground)' }}>
              {authorizedFeatures.length} enabled
            </span>
          </div>

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
          {isEditing ? (
            <>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setIsEditing(false);
                  setProfileFeedback(null);
                }}
                disabled={isSaving}
              >
                Cancel
              </button>
              <button className="btn btn-primary btn-sm" type="submit" form="profile-update-form" disabled={isSaving}>
                <Save size={14} />
                {isSaving ? 'Saving…' : 'Save changes'}
              </button>
            </>
          ) : (
            <>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setProfileFeedback(null);
                  setIsEditing(true);
                }}
              >
                <Pencil size={14} />
                Edit profile
              </button>
              <button className="btn btn-secondary btn-sm" onClick={onClose}>
                Close Profile
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

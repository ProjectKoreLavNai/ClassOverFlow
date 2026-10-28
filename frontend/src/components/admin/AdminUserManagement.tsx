import React, { useState } from 'react';
import { ShieldCheck, UserX } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import type { AcademicRole } from '../../types/auth';
import { getPersonTint } from '../../utils/courseTheme';

const ROLE_LABELS: Record<AcademicRole, string> = {
  student: 'Student',
  cr: 'Class representative',
  teacher: 'Teacher',
  admin: 'Administrator',
};

export const AdminUserManagement: React.FC = () => {
  const { users, verifyUser, updateUserRole, deleteUser } = useAuth();
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleRoleChange = (email: string, newRole: AcademicRole) => {
    updateUserRole(email, newRole);
    showToast(`${email} is now ${ROLE_LABELS[newRole].toLowerCase()}.`);
  };

  const handleVerify = (email: string) => {
    verifyUser(email);
    showToast(`${email} verified.`);
  };

  const handleDelete = (email: string, name: string) => {
    if (window.confirm(`Are you sure you want to permanently delete account for ${name} (${email})?`)) {
      const ok = deleteUser(email);
      if (ok) {
        showToast(`Account for ${name} deleted.`);
      } else {
        alert('Cannot delete the active administrator account.');
      }
    }
  };

  const pending = users.filter((u) => !u.isVerified).length;

  return (
    <section className="panel" aria-labelledby="accounts-title">
      <div className="panel-head" style={{ marginBottom: '4px' }}>
        <h2 id="accounts-title" className="panel-title" style={{ fontSize: '1.4rem' }}>Accounts</h2>
        <span className="panel-note num" aria-live="polite">
          {toastMessage ?? `${users.length} accounts · ${pending === 0 ? 'all verified' : `${pending} waiting for verification`}`}
        </span>
      </div>

      <div className="table-wrap">
        <table className="table table-stack" style={{ minWidth: '760px' }}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Verification</th>
              <th>Role</th>
              <th style={{ textAlign: 'right' }}>
                <span className="visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span className="avatar" style={{ backgroundColor: getPersonTint(user.fullName) }} aria-hidden="true">
                      {user.avatar}
                    </span>
                    <div>
                      <span style={{ fontWeight: 500 }}>{user.fullName}</span>
                      {user.roll && <span className="cell-sub">Roll {user.roll}</span>}
                    </div>
                  </div>
                </td>

                <td className="muted" translate="no">{user.email}</td>

                <td>
                  {user.isVerified ? (
                    <span className="status-chip chip-verified">Verified</span>
                  ) : (
                    <span className="pill pill-warning">Waiting for verification</span>
                  )}
                </td>

                <td>
                  <select
                    className="select"
                    value={user.role}
                    onChange={(e) => handleRoleChange(user.email, e.target.value as AcademicRole)}
                    aria-label={`Role for ${user.fullName}`}
                    style={{ minHeight: '32px', height: '32px', padding: '0 8px', width: 'auto' }}
                  >
                    <option value="student">Student</option>
                    <option value="cr">Class representative</option>
                    <option value="teacher">Teacher</option>
                    <option value="admin">Administrator</option>
                  </select>
                </td>

                <td style={{ textAlign: 'right' }}>
                  <div style={{ display: 'inline-flex', gap: '4px' }}>
                    {!user.isVerified && (
                      <button className="btn btn-primary btn-sm" onClick={() => handleVerify(user.email)}>
                        <ShieldCheck size={14} aria-hidden="true" />
                        <span>Verify</span>
                      </button>
                    )}

                    <button
                      className="btn btn-ghost btn-sm btn-icon"
                      style={{ color: 'var(--negative)' }}
                      onClick={() => handleDelete(user.email, user.fullName)}
                      aria-label={`Delete account for ${user.fullName}`}
                      title="Delete account"
                    >
                      <UserX size={15} aria-hidden="true" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

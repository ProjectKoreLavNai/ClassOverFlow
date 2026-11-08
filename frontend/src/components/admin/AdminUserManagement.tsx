import React, { useEffect, useState } from 'react';
import { ShieldCheck, UserX } from 'lucide-react';
import api, { type BackendUser } from '../../services/api';
import type { AcademicUser } from '../../types/auth';
import type { AcademicRole } from '../../types/auth';
import { getPersonTint } from '../../utils/courseTheme';

const ROLE_LABELS: Record<AcademicRole, string> = {
  student: 'Student',
  cr: 'Class representative',
  teacher: 'Teacher',
  admin: 'Administrator',
};

export const AdminUserManagement: React.FC = () => {
  const [users, setUsers] = useState<AcademicUser[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const mapUser = (user: BackendUser): AcademicUser => ({
    id: String(user.user_id),
    email: user.email,
    fullName: user.full_name || user.username,
    role: user.role as AcademicRole,
    department: '',
    avatar: (user.full_name || user.username).split(/\s+/).map((part) => part[0] || '').join('').slice(0, 2).toUpperCase(),
    isVerified: Boolean(user.is_verified),
    isInstitutional: true,
    phone: user.phone || undefined,
  });

  const refreshUsers = async () => {
    try {
      const result = await api.listAllAdminUsers();
      setUsers(result.map(mapUser));
      setLoadError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load users';
      setLoadError(message);
      setToastMessage(message);
    }
  };

  useEffect(() => {
    void refreshUsers();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleRoleChange = async (user: AcademicUser, newRole: AcademicRole) => {
    try {
      const updated = await api.updateAdminUser(Number(user.id), { role: newRole });
      setUsers((current) => current.map((entry) => entry.id === user.id ? mapUser(updated) : entry));
      showToast(`${user.email} is now ${ROLE_LABELS[newRole].toLowerCase()}.`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to update user role');
    }
  };

  const handleVerify = async (user: AcademicUser) => {
    try {
      const updated = await api.updateAdminUser(Number(user.id), { is_verified: true });
      setUsers((current) => current.map((entry) => entry.id === user.id ? mapUser(updated) : entry));
      showToast(`${user.email} verified.`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to verify user');
    }
  };

  const handleDelete = async (user: AcademicUser) => {
    if (window.confirm(`Are you sure you want to permanently delete account for ${user.fullName} (${user.email})?`)) {
      try {
        await api.deleteAdminUser(Number(user.id));
        setUsers((current) => current.filter((entry) => entry.id !== user.id));
        showToast(`Account for ${user.fullName} deleted.`);
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Unable to delete account');
      }
    }
  };

  const pending = users.filter((u) => !u.isVerified).length;

  return (
    <section className="panel" aria-labelledby="accounts-title">
      <div className="panel-head" style={{ marginBottom: '4px' }}>
        <h2 id="accounts-title" className="panel-title" style={{ fontSize: '1.4rem' }}>Accounts</h2>
        <span className="panel-note num" aria-live="polite">
          {toastMessage ?? loadError ?? `${users.length} accounts · ${pending === 0 ? 'all verified' : `${pending} waiting for verification`}`}
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
                    <span className="status-chip chip-unverified">Pending</span>
                  )}
                </td>

                <td>
                  <select
                    className="select"
                    value={user.role}
                    onChange={(e) => void handleRoleChange(user, e.target.value as AcademicRole)}
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
                      <button className="btn btn-primary btn-sm" onClick={() => void handleVerify(user)}>
                        <ShieldCheck size={14} aria-hidden="true" />
                        <span>Verify</span>
                      </button>
                    )}

                    <button
                      className="btn btn-ghost btn-sm btn-icon"
                      style={{ color: 'var(--negative)' }}
                      onClick={() => void handleDelete(user)}
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

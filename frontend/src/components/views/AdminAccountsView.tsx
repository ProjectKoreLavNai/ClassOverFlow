import React from 'react';
import { AdminUserManagement } from '../admin/AdminUserManagement';

export const AdminAccountsView: React.FC = () => (
  <div className="page">
    <div className="page-head">
      <div>
        <h1 className="page-title">Account management</h1>
        <p className="page-sub">Verify accounts, change roles and remove accounts</p>
      </div>
    </div>

    <div className="stack">
      <AdminUserManagement />
    </div>
  </div>
);

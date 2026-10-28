import React from 'react';
import { Trash2 } from 'lucide-react';
import { AdminUserManagement } from '../admin/AdminUserManagement';

const COURSES = [
  { code: 'CSE-3102', name: 'Software Design and Development', term: 'Fall 2026', active: true },
  { code: 'CSE-3101', name: 'Database Management Systems', term: 'Fall 2026', active: true },
  { code: 'CSE-2201', name: 'Data Structures and Algorithms', term: 'Spring 2026', active: false }
];

export const AdminConsoleView: React.FC = () => {
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Admin console</h1>
          <p className="page-sub">Verify accounts, change roles and retire old courses</p>
        </div>
      </div>

      <div className="stack">

        {/* User Account Verification & Role Assignment Table */}
        <AdminUserManagement />

        {/* Course Governance Safeguards */}
        <section className="panel" aria-labelledby="courses-title">
          <div className="panel-head" style={{ marginBottom: '4px' }}>
            <h2 id="courses-title" className="panel-title">Courses</h2>
            <span className="panel-note num">{COURSES.length} courses</span>
          </div>
          <p className="panel-desc" style={{ marginTop: 0, marginBottom: '4px' }}>
            Only administrators can decommission a course.
          </p>

          <ul className="rows">
            {COURSES.map((c) => (
              <li key={c.code} className="row">
                <div className="row-main">
                  <span className="row-title">{c.code}: {c.name}</span>
                  <span className="row-meta">{c.active ? 'Active' : 'Archived'} · {c.term}</span>
                </div>
                <button
                  className="btn btn-destructive btn-sm"
                  onClick={() => alert(`Admin decommission action triggered for course ${c.code}`)}
                >
                  <Trash2 size={14} aria-hidden="true" />
                  <span>Decommission</span>
                </button>
              </li>
            ))}
          </ul>
        </section>

      </div>
    </div>
  );
};

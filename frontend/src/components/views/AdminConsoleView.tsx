import React, { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { AdminUserManagement } from '../admin/AdminUserManagement';
import api, { type BackendCourse } from '../../services/api';

export const AdminConsoleView: React.FC = () => {
  const [courses, setCourses] = useState<BackendCourse[]>([]);
  const [courseError, setCourseError] = useState<string | null>(null);

  const refreshCourses = async () => {
    try {
      setCourses(await api.listCourses());
      setCourseError(null);
    } catch (error) {
      setCourseError(error instanceof Error ? error.message : 'Unable to load courses');
    }
  };

  useEffect(() => {
    void refreshCourses();
  }, []);

  const decommissionCourse = async (course: BackendCourse) => {
    if (!window.confirm(`Permanently decommission ${course.course_code}: ${course.course_name}?`)) return;
    try {
      await api.deleteCourse(course.course_id);
      setCourses((current) => current.filter((entry) => entry.course_id !== course.course_id));
    } catch (error) {
      setCourseError(error instanceof Error ? error.message : 'Unable to decommission course');
    }
  };

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
            <span className="panel-note num">{courses.length} courses</span>
          </div>
          <p className="panel-desc" style={{ marginTop: 0, marginBottom: '4px' }}>
            Only administrators can decommission a course.
          </p>

          <ul className="rows">
            {courseError && <li className="row notice notice-negative" role="alert">{courseError}</li>}
            {courses.map((course) => (
              <li key={course.course_id} className="row">
                <div className="row-main">
                  <span className="row-title">{course.course_code}: {course.course_name}</span>
                  <span className="row-meta">
                    {course.teacher_email || 'Teacher'} · {course.students_count ?? 0} students
                  </span>
                </div>
                <button
                  className="btn btn-destructive btn-sm"
                  onClick={() => void decommissionCourse(course)}
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

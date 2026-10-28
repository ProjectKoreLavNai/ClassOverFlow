import React from 'react';
import { BookOpen, CheckSquare, Megaphone, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { SecurityBouncerProxy } from '../../patterns/proxy';
import { ClassroomAcademicFacade } from '../../patterns/facade/ClassroomAcademicFacade';
import { getCourseTheme } from '../../utils/courseTheme';

interface Props {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  isOpen: boolean;
  activeCourseCode: string | null;
  onSelectCourse: (code: string) => void;
}

export const Sidebar: React.FC<Props> = ({ activeTab, onSelectTab, isOpen, activeCourseCode, onSelectCourse }) => {
  const { session, setViolation } = useAuth();

  const handleTabClick = (tabId: string) => {
    // Pattern 3: Proxy Pattern (Security Bouncer RBAC Check)
    const check = SecurityBouncerProxy.inspectNavigation(tabId, session);
    if (!check.allowed) {
      setViolation(check);
      return;
    }
    onSelectTab(tabId);
  };

  const allNavItems = [
    {
      id: 'classrooms',
      label: session?.role === 'student' ? 'My classrooms' : 'All classrooms',
      icon: BookOpen,
      allowed: session ? session.role !== 'admin' : true
    },
    {
      id: 'todo',
      label: 'To-do',
      icon: CheckSquare,
      allowed: session ? session.canSubmitWork() : false
    },
    {
      id: 'crdesk',
      label: 'CR desk',
      icon: Megaphone,
      allowed: session ? session.canAccessCRDesk() : false
    },
    {
      id: 'admin',
      label: 'Admin console',
      icon: ShieldCheck,
      allowed: session ? session.canAccessAdmin() : false
    },
  ];

  // Remove features from the interface where the user does not have access
  const visibleNavItems = allNavItems.filter((item) => item.allowed);

  // Like Google Classroom: the classes you teach or are enrolled in, one click away
  const facade = ClassroomAcademicFacade.getInstance();
  const showCourses = !!session && session.role !== 'admin';
  const courses = !session || !showCourses
    ? []
    : session.role === 'student'
      ? facade.getEnrolledCoursesForStudent(session.email)
      : facade.getCourses();

  return (
    <aside className={`app-side${isOpen ? ' is-open' : ''}`} id="app-nav">
      <nav aria-label="Main" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              type="button"
              className="nav-item"
              onClick={() => handleTabClick(item.id)}
              aria-current={isActive && !activeCourseCode ? 'page' : undefined}
            >
              <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {showCourses && courses.length > 0 && (
        <nav aria-label={session?.role === 'student' ? 'Enrolled courses' : 'Courses'} className="nav-courses">
          <div className="nav-group-label">{session?.role === 'teacher' ? 'Teaching' : session?.role === 'student' ? 'Enrolled' : 'Courses'}</div>
          {courses.map((course) => {
            const theme = getCourseTheme(course);
            const title = course.title.replace(/^[A-Z]{2,4}-\d{3,4}:\s*/, '');
            return (
              <button
                key={course.code}
                type="button"
                className="nav-item nav-course"
                onClick={() => onSelectCourse(course.code)}
                aria-current={activeCourseCode === course.code ? 'page' : undefined}
              >
                <span className="nav-course-dot" style={{ backgroundColor: theme.banner }} aria-hidden="true">
                  {title.charAt(0)}
                </span>
                <span className="nav-course-text">
                  <span className="truncate">{title}</span>
                  <span className="nav-course-code">{course.code}</span>
                </span>
              </button>
            );
          })}
        </nav>
      )}

      <div className="nav-foot">
        Semester 3-1
        <br />
        Computer Science & Engineering
      </div>
    </aside>
  );
};

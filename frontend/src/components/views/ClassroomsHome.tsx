import React, { useEffect, useState } from 'react';
import { Plus, UserPlus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { SecurityBouncerProxy } from '../../patterns/proxy';
import { ClassroomAcademicFacade } from '../../patterns/facade/ClassroomAcademicFacade';
import { CourseBlueprint } from '../../patterns/prototype/CoursePrototype';
import { CourseDetailView } from '../classroom/CourseDetailView';
import { CreateCourseModal } from '../classroom/CreateCourseModal';
import { JoinCourseModal } from '../classroom/JoinCourseModal';
import { getCourseTheme } from '../../utils/courseTheme';

// A thin ring in the course's colour; the track is the whole syllabus, the arc the covered share.
const CoverageRing: React.FC<{ pct: number | null; color: string }> = ({ pct, color }) => {
  const r = 28;
  const circumference = 2 * Math.PI * r;
  return (
    <div className="ring" role="img" aria-label={pct === null ? 'No syllabus topics yet' : `${pct}% of the syllabus covered`}>
      <svg width="68" height="68" viewBox="0 0 68 68" aria-hidden="true">
        <circle cx="34" cy="34" r={r} fill="none" stroke="var(--track)" strokeWidth="6" />
        {(pct ?? 0) > 0 && (
          <circle
            cx="34"
            cy="34"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${(circumference * (pct ?? 0)) / 100} ${circumference}`}
            transform="rotate(-90 34 34)"
          />
        )}
      </svg>
      <span className="ring-value num">{pct === null ? '–' : `${pct}%`}</span>
    </div>
  );
};

interface Props {
  // The open course lives in App so the sidebar's course list can open one too.
  selectedCode: string | null;
  onSelectCode: (code: string | null) => void;
}

export const ClassroomsHome: React.FC<Props> = ({ selectedCode, onSelectCode }) => {
  const { session, setViolation } = useAuth();
  const facade = ClassroomAcademicFacade.getInstance();

  const [courses, setCourses] = useState<CourseBlueprint[]>(facade.getCourses());
  const [courseLoadError, setCourseLoadError] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isJoinOpen, setIsJoinOpen] = useState(false);
  const [joinPrefillCode, setJoinPrefillCode] = useState('');

  useEffect(() => {
    let active = true;
    facade.syncWithBackend()
      .then(() => {
        if (active) {
          setCourses(facade.getCourses());
          setCourseLoadError(null);
        }
      })
      .catch((error: unknown) => {
        if (active) setCourseLoadError(error instanceof Error ? error.message : 'Unable to load courses');
      });
    return () => { active = false; };
  }, [facade, session?.id, session?.role]);

  const handleCreateCourseClick = () => {
    // Pattern 3: Proxy Check
    const check = SecurityBouncerProxy.inspectAction('create_course', session);
    if (!check.allowed) {
      setViolation(check);
      return;
    }
    setIsCreateOpen(true);
  };

  const handleJoinCourseClick = () => {
    // Pattern 3: Proxy Check
    const check = SecurityBouncerProxy.inspectAction('join_course', session);
    if (!check.allowed) {
      setViolation(check);
      return;
    }
    setJoinPrefillCode('');
    setIsJoinOpen(true);
  };

  const isStudent = session?.role === 'student' || session?.role === 'cr';
  // The backend course list is already scoped to courses this user can access.
  const displayedCourses = courses;

  // If a course is selected, render the Course Detail Workspace
  const selectedCourse = selectedCode ? facade.getCourseByCode(selectedCode) ?? null : null;
  // For students, ONLY enrolled courses can be opened
  const isBlocked = !!selectedCourse && !displayedCourses.some((item) => item.courseId === selectedCourse.courseId);
  useEffect(() => {
    if (isBlocked || (selectedCode && !selectedCourse)) onSelectCode(null);
  }, [isBlocked, selectedCode, selectedCourse, onSelectCode]);

  if (selectedCourse && !isBlocked) {
    return (
      <CourseDetailView
        course={selectedCourse}
        onBack={() => {
          onSelectCode(null);
          setCourses(facade.getCourses());
        }}
        onCourseUpdated={(updated) => {
          onSelectCode(updated.code);
          setCourses(facade.getCourses());
        }}
      />
    );
  }

  const courseCount = displayedCourses.length;

  return (
    <div className="page">
      {/* Title & Action Bar */}
      <div className="page-head">
        <div>
          <h1 className="page-title">{isStudent ? 'My classrooms' : 'All classrooms'}</h1>
          <p className="page-sub">
            {courseCount === 1 ? '1 course' : `${courseCount} courses`} this semester
          </p>
        </div>

        <div className="page-actions">
          {/* Join Course for students / scholars */}
          {session?.canJoinCourse() && (
            <button className="btn btn-primary" onClick={handleJoinCourseClick} id="btn-join-course-home">
              <UserPlus size={16} aria-hidden="true" />
              <span>Join course</span>
            </button>
          )}

          {/* Feature only visible if user has course creation authority */}
          {session?.canCreateCourse() && (
            <button className="btn btn-primary" onClick={handleCreateCourseClick}>
              <Plus size={16} aria-hidden="true" />
              <span>Create course</span>
            </button>
          )}
        </div>
      </div>

      {displayedCourses.length === 0 ? (
        <div className="panel" style={{ maxWidth: '560px' }}>
          <h2 className="panel-title">{courseLoadError ? 'Courses could not be loaded' : "You haven't joined a course yet"}</h2>
          <p className="muted" style={{ margin: '6px 0 16px' }}>
            {courseLoadError || 'Ask your teacher or CR for the class code, then join with it here.'}
          </p>
          {isStudent && <button className="btn btn-primary" onClick={handleJoinCourseClick}>
            <UserPlus size={16} aria-hidden="true" />
            <span>Join with a class code</span>
          </button>}
        </div>
      ) : (
        <ul className="course-grid" style={{ listStyle: 'none' }}>
          {displayedCourses.map((course) => {
            const topics = course.units.flatMap((u) => u.topics);
            const coveredTopics = topics.filter((t) => t.isCompleted).length;
            const pct = topics.length > 0 ? Math.round((coveredTopics / topics.length) * 100) : null;

            const theme = getCourseTheme(course);
            const isEnrolled = isStudent
              ? true
              : session ? facade.isStudentEnrolled(course.code, session.email) : false;

            // Title without its code prefix; section and room without the credits
            const cleanTitle = course.title.replace(/^[A-Z]{2,4}-\d{3,4}:\s*/, '');
            const sectionParts = course.sectionInfo.split('•').map((s) => s.trim()).filter((s) => !/credit/i.test(s));
            const subtitle = [...sectionParts.slice(0, 2), course.instructor].join(' · ');

            const upcomingText = (course.duePreview || '').replace(/^Due\s+/i, '').replace(/^Upcoming:\s*/i, '');

            return (
              <li key={course.code} className="course-card" data-course-card onClick={() => onSelectCode(course.code)}>
                <div className="course-banner" style={{ backgroundColor: theme.banner }}>
                  <div className="course-code">{course.code}</div>
                  <h2 className="course-title">
                    <button
                      type="button"
                      className="course-open"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectCode(course.code);
                      }}
                    >
                      {cleanTitle}
                    </button>
                  </h2>
                  <div className="course-meta truncate" title={subtitle}>{subtitle}</div>
                </div>

                <div className="course-body">
                  <div className="coverage">
                    <div style={{ minWidth: 0 }}>
                      <h3 className="coverage-title">Syllabus coverage</h3>
                      <p className="coverage-sub num">
                        {topics.length === 0 ? 'No topics in the syllabus yet' : `${coveredTopics} of ${topics.length} topics covered`}
                      </p>
                    </div>
                    <CoverageRing pct={pct} color={theme.accent} />
                  </div>

                  <p className="upcoming" title={upcomingText || undefined}>
                    <strong>Upcoming:</strong>
                    <span className="truncate">{upcomingText || 'Nothing due'}</span>
                  </p>
                </div>

                <div className="course-foot">
                  <span className="num">
                    {course.studentsCount === 1 ? '1 student' : `${course.studentsCount} students`}
                  </span>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {isStudent && !isEnrolled && (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setJoinPrefillCode(course.cohortCode);
                          setIsJoinOpen(true);
                        }}
                      >
                        <UserPlus size={14} aria-hidden="true" />
                        <span>Join</span>
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Create Course Modal */}
      <CreateCourseModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreated={(newCourse) => {
          setCourses(facade.getCourses());
          onSelectCode(newCourse.code);
        }}
      />

      {/* Join Course Modal for Students */}
      <JoinCourseModal
        isOpen={isJoinOpen}
        initialCode={joinPrefillCode}
        onClose={() => setIsJoinOpen(false)}
        onJoined={(joinedCourse) => {
          setCourses(facade.getCourses());
          onSelectCode(joinedCourse.code);
        }}
      />
    </div>
  );
};

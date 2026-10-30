import React, { useEffect, useState } from 'react';
import {
  ArrowLeft, Copy, Check, ExternalLink,
  CheckCircle2, Circle,
  Send, UserPlus, Lock
} from 'lucide-react';
import { CourseBlueprint } from '../../patterns/prototype/CoursePrototype';
import { ClassroomAcademicFacade } from '../../patterns/facade/ClassroomAcademicFacade';
import type { CourseAnnouncement } from '../../patterns/facade/ClassroomAcademicFacade';
import { JoinCourseModal } from './JoinCourseModal';
import { useAuth } from '../../context/AuthContext';
import { SecurityBouncerProxy } from '../../patterns/proxy';
import { getCourseTheme, getInitials, getPersonTint } from '../../utils/courseTheme';
import api, { type BackendAssignment, type BackendGradebook, type BackendMark } from '../../services/api';

interface Props {
  course: CourseBlueprint;
  onBack: () => void;
  onCourseUpdated: (course: CourseBlueprint) => void;
}

type CourseTab = 'stream' | 'classwork' | 'syllabus' | 'grades' | 'people' | 'aistudio';

const COURSE_TABS: Array<{ id: CourseTab; label: string }> = [
  { id: 'stream', label: 'Stream' },
  { id: 'classwork', label: 'Classwork' },
  { id: 'syllabus', label: 'Syllabus' },
  { id: 'grades', label: 'Grades & attendance' },
  { id: 'people', label: 'People' },
  { id: 'aistudio', label: 'AI studio' },
];

const ATTENDANCE_MINIMUM = 75;
const pct1 = (value: number) => `${value.toFixed(1)}%`;

export const CourseDetailView: React.FC<Props> = ({ course, onBack, onCourseUpdated }) => {
  const { session, setViolation } = useAuth();
  const facade = ClassroomAcademicFacade.getInstance();
  const isTeacher = session?.role === 'teacher';
  const theme = getCourseTheme(course);

  // Course workspace tabs: STREAM, CLASSWORK, SYLLABUS COVERAGE, GRADEBOOK, PEOPLE, AI STUDIO
  const [activeTab, setActiveTab] = useState<CourseTab>('stream');

  // Announcements
  const [announcements, setAnnouncements] = useState<CourseAnnouncement[]>([]);
  const [upcoming, setUpcoming] = useState<BackendAssignment[]>([]);
  const [gradebook, setGradebook] = useState<BackendGradebook | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().slice(0, 10));
  const [attendanceStatuses, setAttendanceStatuses] = useState<Record<number, 'PRESENT' | 'ABSENT'>>({});
  const [markDrafts, setMarkDrafts] = useState<Record<string, string>>({});
  const [isSavingGradebook, setIsSavingGradebook] = useState(false);
  const [gradebookFeedback, setGradebookFeedback] = useState<string | null>(null);

  // Composer state
  const [isComposerExpanded, setIsComposerExpanded] = useState(false);
  const [postTitle, setPostTitle] = useState('');
  const [postContent, setPostContent] = useState('');
  const [streamDiscord, setStreamDiscord] = useState(true);
  const [publishFeedback, setPublishFeedback] = useState<string | null>(null);

  // Class code state
  const [copiedCode, setCopiedCode] = useState(false);
  const [classCodeFeedback, setClassCodeFeedback] = useState<string | null>(null);
  const [isJoinOpen, setIsJoinOpen] = useState(false);

  const isLearner = session?.role === 'student' || session?.role === 'cr';
  const isEnrolled = isLearner
    ? Boolean(course.courseId)
    : session ? facade.isStudentEnrolled(course.code, session.email) : false;

  const refreshCourseData = async () => {
    if (!course.courseId) return;
    try {
      const [announcementRows, upcomingRows, gradebookData] = await Promise.all([
        api.listAnnouncements(course.courseId),
        api.listCourseUpcoming(course.courseId),
        api.getGradebook(course.courseId),
      ]);
      setAnnouncements(announcementRows.map((item) => ({
        id: String(item.announcement_id),
        courseCode: course.code,
        authorName: item.author_email?.split('@')[0] || 'Teacher',
        authorRole: 'Teacher',
        authorAvatar: getInitials(item.author_email?.split('@')[0] || 'Teacher'),
        title: item.title,
        content: item.content,
        attachmentTag: '',
        streamedToDiscord: false,
        createdAt: item.created_at ? new Date(item.created_at).toLocaleString() : '',
        likes: 0,
      })));
      setUpcoming(upcomingRows);
      setGradebook(gradebookData);
      setDataError(null);
    } catch (error) {
      setDataError(error instanceof Error ? error.message : 'Unable to load course records');
    }
  };

  useEffect(() => {
    void refreshCourseData();
  }, [course.courseId]);

  useEffect(() => {
    const selectedSession = gradebook?.sessions.find((item) => item.session_date === attendanceDate);
    if (selectedSession) {
      setAttendanceStatuses(Object.fromEntries(
        selectedSession.records.map((record) => [record.student_id, record.status])
      ));
    } else if (gradebook) {
      setAttendanceStatuses(Object.fromEntries(
        gradebook.students.map((student) => [student.student_id, 'ABSENT'])
      ));
    }
  }, [attendanceDate, gradebook]);

  const belowMinimum = gradebook?.below_minimum ?? [];
  const averageAttendance = gradebook?.average_attendance;
  const averageTotal = gradebook?.students.length
    ? gradebook.students.reduce((sum, student) => {
      const marks = student.marks.reduce((total, mark) => total + Number(mark.marks_obtained), 0);
      return sum + marks;
    }, 0) / gradebook.students.length
    : null;
  const getStudentMark = (marks: BackendMark[], name: string) =>
    marks.find((mark) => mark.assessment_name.toLowerCase() === name.toLowerCase());
  const getMarkValue = (studentId: number, name: string, mark?: BackendMark) =>
    markDrafts[`${studentId}:${name}`] ?? (mark ? String(mark.marks_obtained) : '');

  // AI insights card state in gradebook
  const [showAIInsights, setShowAIInsights] = useState(false);

  // ==========================================
  // AI STUDIO INTEGRATION (3 TOOLS & RBAC)
  // ==========================================
  // Tool 1: Draft AI Lecture Plan (Teacher only)
  const [planTopic, setPlanTopic] = useState(`${course.code}: Architectural Design Patterns & UML Modeling`);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState<string | null>(null);
  const [planPublished, setPlanPublished] = useState(false);

  // Tool 2: Formative 10-Question Quiz Engine (Teacher only)
  const [quizTopic, setQuizTopic] = useState(`${course.code} Formative Quiz: GoF Patterns & Architecture`);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [generatedQuiz, setGeneratedQuiz] = useState<Array<{ q: string; options: string[]; answer: number; explanation: string }> | null>(null);
  const [quizAssigned, setQuizAssigned] = useState(false);

  // Tool 3: Slide & Lecture Summarizer (Available for Students & Teachers)
  const [slideDeck, setSlideDeck] = useState(`${course.code} Lecture 01-04: Core Architectural Principles`);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [generatedSummary, setGeneratedSummary] = useState<{
    overview: string;
    keyTakeaways: string[];
    definitions: Array<{ term: string; definition: string }>;
    examFocus: string[];
  } | null>(null);
  const [copiedSummary, setCopiedSummary] = useState(false);

  // Tool 1 Handler
  const handleGeneratePlan = () => {
    const check = SecurityBouncerProxy.inspectAction('draft_lecture_plan', session);
    if (!check.allowed) {
      setViolation(check);
      return;
    }
    setIsGeneratingPlan(true);
    setTimeout(() => {
      setIsGeneratingPlan(false);
      setGeneratedPlan(`Lecture plan for ${course.code} (${course.title})
• Core objective: analyse GoF structural & creational patterns in enterprise software design.
• Flow:
  1. Introduction (15m): software decoupling and anti-patterns.
  2. Live walkthrough (30m): step-by-step UML modelling of Proxy and Facade boundaries.
  3. Student drill (25m): identifying RBAC security bouncers in transaction pipelines.
• Formative assessment: 10 MCQ quiz on architectural trade-offs.`);
    }, 900);
  };

  const handlePublishPlanToStream = async () => {
    if (!generatedPlan || !session || !course.courseId) return;
    try {
      await api.createAnnouncement(course.courseId, {
        title: `AI Lecture Plan: ${planTopic}`,
        content: generatedPlan,
      });
      await refreshCourseData();
      setPlanPublished(true);
      setTimeout(() => setPlanPublished(false), 4000);
    } catch (error) {
      setPublishFeedback(error instanceof Error ? error.message : 'Unable to publish lecture plan');
    }
  };

  // Tool 2 Handler
  const handleGenerateQuiz = () => {
    const check = SecurityBouncerProxy.inspectAction('generate_quiz', session);
    if (!check.allowed) {
      setViolation(check);
      return;
    }
    setIsGeneratingQuiz(true);
    setTimeout(() => {
      setIsGeneratingQuiz(false);
      setGeneratedQuiz([
        { q: 'Which GoF pattern provides a surrogate or bouncer to control access to a target object?', options: ['Adapter', 'Proxy', 'Facade', 'Composite'], answer: 1, explanation: 'Proxy controls access to another object (e.g. RBAC security bouncer).' },
        { q: 'What is the primary role of a Facade pattern in enterprise architectural design?', options: ['Manage object creation lifecycles', 'Provide a simplified, unified interface to a complex subsystem', 'Serialize network buffers', 'Enforce immutable database schema'], answer: 1, explanation: 'Facade encapsulates subsystem complexity behind a simple coarse-grained interface.' },
        { q: 'In Role-Based Access Control (RBAC), at which layer should the security proxy intercept unauthorized requests?', options: ['Database write trigger', 'Client rendering cycle', 'Application Gateway / Service Boundary', 'Physical disk controller'], answer: 2, explanation: 'Service boundaries intercept unauthorized calls before business logic executes.' },
        { q: 'Which pattern is ideal when cloning an existing syllabus blueprint without subclass coupling?', options: ['Singleton', 'Prototype', 'Observer', 'State'], answer: 1, explanation: 'Prototype permits cloning existing objects via clone interfaces.' },
        { q: 'How does an Academic Facade prevent tight coupling in classroom management workflows?', options: ['By exposing raw SQL queries', 'By encapsulating grade calculation, attendance, and roster synchronization behind single calls', 'By running background daemons', 'By bypassing role validation'], answer: 1, explanation: 'It orchestrates complex operations through a clean, unified API.' },
        { q: 'In multi-channel academic notifications, which pattern notifies Discord and Messenger listeners concurrently?', options: ['Observer', 'Command', 'Memento', 'Interpreter'], answer: 0, explanation: 'Observer defines a one-to-many subscription model between subjects and notification sinks.' },
        { q: 'When is Chain of Responsibility preferable over nested if-else validation statements?', options: ['When only one single check is ever needed', 'When sequential authentication and institutional verification filters must be decoupled', 'When sorting array elements', 'When compiling WebAssembly code'], answer: 1, explanation: 'Chain of Responsibility links independent handlers without rigid coupling.' },
        { q: 'Which statement best describes the Singleton pattern in session authentication state?', options: ['Creates a new session object per HTTP request', 'Ensures a single shared instance manages global authentication state', 'Requires multiple inheritance', 'Disables garbage collection'], answer: 1, explanation: 'Singleton guarantees only one instance exists and provides a global access point.' },
        { q: 'What is the key benefit of formative assessment quizzes over summative examinations?', options: ['Formative quizzes award final graduation degrees', 'They provide immediate feedback for continuous learning rather than final grading judgment', 'They take 3 hours to grade manually', 'They require external invigilators'], answer: 1, explanation: 'Formative quizzes assess real-time student understanding and pinpoint syllabus gaps.' },
        { q: 'In UML Class Diagrams, how is a dependency relationship between an interface and implementer represented?', options: ['Solid line with solid arrowhead', 'Dashed line with hollow triangle arrowhead', 'Dotted red circle', 'Double parallel lines'], answer: 1, explanation: 'Interface realization is denoted with a dashed line ending with a hollow triangular arrowhead.' }
      ]);
    }, 1000);
  };

  const handleAssignQuiz = () => {
    setQuizAssigned(true);
    setTimeout(() => setQuizAssigned(false), 4000);
  };

  // Tool 3 Handler (Available for Students & Teachers)
  const handleGenerateSummary = () => {
    setIsGeneratingSummary(true);
    setTimeout(() => {
      setIsGeneratingSummary(false);
      setGeneratedSummary({
        overview: `Revision brief for ${course.code} from the slide deck "${slideDeck}", focused on the exam's learning objectives and structural design principles.`,
        keyTakeaways: [
          'Creational vs Structural Patterns: Factory and Prototype manage object creation; Proxy and Facade manage architectural composition and security.',
          'RBAC Security Proxy: Protects critical course assets (grades, quizzes, lecture plans) from unauthorized execution (HTTP 403 Forbidden).',
          'Academic Facade: Consolidates syllabus coverage, student roster, and automated attendance registers into a unified interface.',
          'Exam Weightage: 70% of midterm questions test UML diagrams, GoF structural patterns, and architectural trade-offs.'
        ],
        definitions: [
          { term: 'Proxy Pattern', definition: 'A structural pattern that provides a surrogate or placeholder to control and authenticate access to another resource.' },
          { term: 'Facade Pattern', definition: 'A pattern that provides a simplified, higher-level interface to a complex library or subsystem.' },
          { term: 'Prototype Pattern', definition: 'A pattern that allows cloning existing course objects without coupling code to their specific classes.' }
        ],
        examFocus: [
          'Be prepared to diagram Proxy vs Facade interactions using standard UML notation.',
          'Explain why separating Teacher, Student, CR, and Admin personas using the Factory Method pattern prevents privilege escalation.'
        ]
      });
    }, 850);
  };

  const handleCopySummary = () => {
    if (!generatedSummary) return;
    const text = `CLASS REVISION BRIEF: ${course.code} - ${slideDeck}\n\nOVERVIEW:\n${generatedSummary.overview}\n\nKEY TAKEAWAYS:\n${generatedSummary.keyTakeaways.map((k) => `• ${k}`).join('\n')}\n\nEXAM FOCUS:\n${generatedSummary.examFocus.map((f) => `• ${f}`).join('\n')}`;
    navigator.clipboard.writeText(text);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 3000);
  };

  const handleCopyCode = async () => {
    try {
      let classCode = course.cohortCode;
      const generated = !classCode;
      if (generated) {
        if (!course.courseId) throw new Error('This course does not have a database ID');
        const result = await api.generateCourseClassCode(course.courseId);
        classCode = result.class_code;
        course.cohortCode = classCode;
        onCourseUpdated(course);
      }

      try {
        await navigator.clipboard.writeText(classCode);
      } catch {
        const input = document.createElement('textarea');
        input.value = classCode;
        input.setAttribute('readonly', '');
        input.style.position = 'fixed';
        input.style.opacity = '0';
        document.body.appendChild(input);
        let copied = false;
        try {
          input.select();
          copied = document.execCommand('copy');
        } finally {
          input.remove();
        }
        if (!copied) throw new Error('Clipboard access is unavailable');
      }

      setCopiedCode(true);
      setClassCodeFeedback(
        generated
          ? 'New class code generated and copied. Any previous code has been replaced.'
          : 'Class code copied.'
      );
      setTimeout(() => {
        setCopiedCode(false);
        setClassCodeFeedback(null);
      }, 3000);
    } catch (error) {
      setCopiedCode(false);
      setClassCodeFeedback(error instanceof Error ? error.message : 'Unable to copy class code');
    }
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !course.courseId) return;
    try {
      await api.createAnnouncement(course.courseId, {
        title: postTitle.trim() || 'Course Stream Memo',
        content: postContent.trim(),
      });
      await refreshCourseData();
      setPostTitle('');
      setPostContent('');
      setIsComposerExpanded(false);
      setPublishFeedback('Announcement published to course stream.');
      setTimeout(() => setPublishFeedback(null), 4000);
    } catch (error) {
      setPublishFeedback(error instanceof Error ? error.message : 'Unable to publish announcement');
    }
  };

  const handleSaveGradebook = async () => {
    if (!course.courseId || !gradebook) return;
    setIsSavingGradebook(true);
    setGradebookFeedback(null);
    try {
      const marksToSave: Array<{
        mark_id?: number;
        student_id: number;
        assessment_name: string;
        marks_obtained: number;
        total_marks: number;
      }> = [];
      const deleteMarkIds: number[] = [];
      for (const student of gradebook.students) {
        for (const assessment of [
          { name: 'Assignment', total: 30 },
          { name: 'Quiz', total: 20 },
          { name: 'Midterm', total: 50 },
        ]) {
          const mark = getStudentMark(student.marks, assessment.name);
          const draft = markDrafts[`${student.student_id}:${assessment.name}`];
          if (draft === undefined) continue;
          if (draft.trim() === '') {
            if (mark) deleteMarkIds.push(mark.mark_id);
            continue;
          }
          const obtained = Number(draft);
          if (!Number.isFinite(obtained) || obtained < 0 || obtained > assessment.total) {
            throw new Error(`${assessment.name} marks must be between 0 and ${assessment.total}`);
          }
          if (!mark || Number(mark.marks_obtained) !== obtained || Number(mark.total_marks) !== assessment.total) {
            marksToSave.push({
              ...(mark ? { mark_id: mark.mark_id } : {}),
              student_id: student.student_id,
              assessment_name: assessment.name,
              marks_obtained: obtained,
              total_marks: assessment.total,
            });
          }
        }
      }
      await api.saveGradebook(course.courseId, {
        session_date: attendanceDate,
        attendance: gradebook.students.map((student) => ({
          student_id: student.student_id,
          status: attendanceStatuses[student.student_id] || 'ABSENT',
        })),
        marks: marksToSave,
        delete_mark_ids: deleteMarkIds,
      });
      setMarkDrafts({});
      await refreshCourseData();
      setGradebookFeedback('Attendance and marks saved.');
    } catch (error) {
      setGradebookFeedback(error instanceof Error ? error.message : 'Unable to save gradebook');
      await refreshCourseData();
    } finally {
      setIsSavingGradebook(false);
    }
  };

  const handleToggleTopic = (topicId: string) => {
    facade.toggleTopicCompletion(course.code, topicId);
    const updated = facade.getCourseByCode(course.code);
    if (updated) onCourseUpdated(updated);
  };

  const allTopics = course.units.flatMap((u) => u.topics);
  const completedTopics = allTopics.filter((t) => t.isCompleted);
  const progressPercent = allTopics.length > 0 ? Math.round((completedTopics.length / allTopics.length) * 100) : null;
  const totalHours = allTopics.reduce((sum, t) => sum + t.durationHours, 0);
  const coveredHours = completedTopics.reduce((sum, t) => sum + t.durationHours, 0);

  const cleanTitle = course.title.replace(/^[A-Z]{2,4}-\d{3,4}:\s*/, '');
  const sectionLine = course.sectionInfo.split('•').map((s) => s.trim()).filter((s) => !/credit/i.test(s)).join(' · ');
  const discordChannel = `#${course.code.toLowerCase().replace(/[^a-z0-9]/g, '')}-announcements`;

  if (isLearner && !isEnrolled) {
    return (
      <div className="page">
        <div className="panel" style={{ maxWidth: '560px' }}>
          <Lock size={20} aria-hidden="true" style={{ color: 'var(--muted)', marginBottom: '12px' }} />
          <h1 className="panel-title" style={{ fontSize: '1.6rem' }}>You're not enrolled in {course.code}</h1>
          <p className="muted" style={{ margin: '6px 0 20px' }}>
            Students can only open the courses they have joined. Join {cleanTitle} with its class code to see its stream and classwork.
          </p>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={() => setIsJoinOpen(true)}>
              <UserPlus size={15} aria-hidden="true" />
              <span>Join with code</span>
            </button>
            <button className="btn btn-secondary" onClick={onBack}>
              <ArrowLeft size={15} aria-hidden="true" />
              <span>Back to my classrooms</span>
            </button>
          </div>
          <JoinCourseModal
            isOpen={isJoinOpen}
            onClose={() => setIsJoinOpen(false)}
            onJoined={() => {
              setIsJoinOpen(false);
              const updated = facade.getCourseByCode(course.code);
              if (updated) onCourseUpdated(updated);
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="page">

      {/* Back */}
      <button onClick={onBack} className="btn btn-ghost btn-sm" style={{ marginLeft: '-10px', marginBottom: '12px' }}>
        <ArrowLeft size={15} aria-hidden="true" />
        <span>{isLearner ? 'My classrooms' : 'All classrooms'}</span>
      </button>

      {/* Course header: identity band, then one strip split by dividers */}
      <section className="course-header" aria-labelledby="course-title">
        <div className="course-header-band" style={{ backgroundColor: theme.banner }}>
          <div style={{ minWidth: 0 }}>
            <div className="course-code">{course.code}</div>
            <h1 id="course-title" className="page-title" style={{ marginTop: '2px' }}>{cleanTitle}</h1>
            <p className="course-meta" style={{ fontFamily: 'var(--font-body)', fontSize: '0.95rem' }}>
              {course.instructor}{sectionLine ? ` · ${sectionLine}` : ''}
            </p>
          </div>

          <div className="page-actions">
            {/* Requirement: REMOVE showing classroom code in students account */}
            {session?.role === 'teacher' ? (
              <>
                <button
                  onClick={() => void handleCopyCode()}
                  className="btn btn-secondary btn-sm"
                  aria-label={course.cohortCode ? `Copy class code ${course.cohortCode}` : 'Generate and copy class code'}
                >
                  {copiedCode ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
                  <span>{course.cohortCode ? 'Class code' : 'Generate class code'}</span>
                  {course.cohortCode && <span className="mono" translate="no">{course.cohortCode}</span>}
                </button>
                <span aria-live="polite" role={classCodeFeedback && !copiedCode ? 'alert' : 'status'}>
                  {classCodeFeedback}
                </span>
              </>
            ) : isLearner && isEnrolled ? (
              <span className="pill"><Check size={12} aria-hidden="true" /> Enrolled · {course.term}</span>
            ) : isLearner ? (
              <button onClick={() => setIsJoinOpen(true)} className="btn btn-primary btn-sm">
                <UserPlus size={14} aria-hidden="true" />
                <span>Join course</span>
              </button>
            ) : null}
          </div>
        </div>

        <div className="stat-strip">
          <div className="stat">
            <div className="stat-label">Syllabus covered</div>
            <div className="stat-value">{progressPercent === null ? '–' : <>{progressPercent}<span className="stat-unit">%</span></>}</div>
            <div className="bar" style={{ marginTop: '10px', maxWidth: '200px' }} aria-hidden="true">
              <div className="bar-fill" style={{ width: `${progressPercent ?? 0}%` }} />
            </div>
          </div>
          <div className="stat">
            <div className="stat-label">Students enrolled</div>
            <div className="stat-value">{course.studentsCount}</div>
            <div className="stat-note">{course.term}</div>
          </div>
          <div className="stat">
            <div className="stat-label">{isLearner ? 'Your attendance' : 'Average attendance'}</div>
            <div className="stat-value">
              {averageAttendance === null || averageAttendance === undefined
                ? '–'
                : <>{averageAttendance.toFixed(1)}<span className="stat-unit">%</span></>}
            </div>
            <div className="stat-note">Over {gradebook?.classes_held ?? 0} classes held</div>
          </div>
          <div className="stat">
            <div className="stat-label">{isLearner ? 'Attendance status' : `Below ${ATTENDANCE_MINIMUM}% attendance`}</div>
            <div className="stat-value" style={{ color: belowMinimum.length > 0 ? 'var(--negative)' : undefined }}>
              {gradebook
                ? (isLearner
                  ? gradebook.classes_held === 0
                    ? '–'
                    : belowMinimum.length > 0 ? 'At risk' : 'OK'
                  : belowMinimum.length)
                : '–'}
            </div>
            <div className="stat-note">
              {!gradebook
                ? 'Loading attendance data'
                : gradebook.classes_held === 0
                  ? 'No attendance recorded yet'
                  : belowMinimum.length > 0
                    ? isLearner
                      ? `Your attendance is below ${ATTENDANCE_MINIMUM}%.`
                      : belowMinimum.map((student) => student.full_name).join(', ')
                    : isLearner
                      ? `Your attendance is at least ${ATTENDANCE_MINIMUM}%.`
                      : 'Everyone is above the minimum'}
            </div>
          </div>
        </div>
      </section>

      {/* Course tabs */}
      <div className="tabs" role="tablist" aria-label="Course sections" style={{ marginTop: '16px' }}>
        {COURSE_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={activeTab === tab.id}
            aria-controls="course-panel"
            className="tab"
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div id="course-panel" role="tabpanel" aria-labelledby={`tab-${activeTab}`}>

      {/* ====================================================================
          TAB 1: STREAM
          ==================================================================== */}
      {activeTab === 'stream' && (
        <div className="stream">

          {/* Left Column: Upcoming Deadlines */}
          <aside className="panel" aria-labelledby="upcoming-title">
            <h2 id="upcoming-title" className="panel-title" style={{ marginBottom: '4px' }}>Upcoming</h2>
            {dataError && <p className="notice notice-negative" role="alert">{dataError}</p>}
            <ul className="rows">
              {upcoming.map((item) => (
                <li key={item.assignment_id} className="row" style={{ minHeight: '56px' }}>
                  <div className="row-main">
                    <span className="row-title">{item.title}</span>
                    <span className="row-meta">
                      Due {item.deadline ? new Date(item.deadline).toLocaleString() : 'No deadline'} · {item.total_marks} marks
                    </span>
                  </div>
                </li>
              ))}
              {upcoming.length === 0 && <li className="row muted">No upcoming coursework.</li>}
            </ul>
          </aside>

          {/* Right Column: Announcements Feed */}
          <div className="stack">
            {dataError && <p className="notice notice-negative" role="alert">{dataError}</p>}

            {/* Announcement Composer */}
            <div className="panel" style={{ padding: isComposerExpanded ? undefined : '12px 16px' }}>
              {!isComposerExpanded ? (
                <button type="button" className="composer-open" onClick={() => setIsComposerExpanded(true)}>
                  {session && (
                    <span className="avatar" style={{ backgroundColor: getPersonTint(session.name) }} aria-hidden="true">
                      {session.avatar}
                    </span>
                  )}
                  <span>Announce something to your class…</span>
                </button>
              ) : (
                <form onSubmit={handlePublish} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <h2 className="panel-title" style={{ fontSize: '1.25rem' }}>New announcement</h2>

                  <label className="field">
                    <span className="field-label">Title</span>
                    <input
                      className="input"
                      type="text"
                      name="announcement-title"
                      autoComplete="off"
                      value={postTitle}
                      onChange={(e) => setPostTitle(e.target.value)}
                      placeholder="e.g. Lab moved to Room 402…"
                      required
                    />
                  </label>

                  <label className="field">
                    <span className="field-label">Message</span>
                    <textarea
                      className="textarea"
                      name="announcement-body"
                      value={postContent}
                      onChange={(e) => setPostContent(e.target.value)}
                      rows={4}
                      required
                    />
                  </label>

                  {/* External Platform Streaming Toggle */}
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={streamDiscord}
                      onChange={(e) => setStreamDiscord(e.target.checked)}
                    />
                    <span>Also post to <span translate="no">{discordChannel}</span> on Discord and the Messenger group</span>
                  </label>

                  <div className="modal-actions">
                    <button type="button" className="btn btn-ghost" onClick={() => setIsComposerExpanded(false)}>
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary">
                      Post announcement
                    </button>
                  </div>
                </form>
              )}

              <div aria-live="polite">
                {publishFeedback && (
                  <p className="notice notice-positive" style={{ marginTop: '12px' }}>{publishFeedback}</p>
                )}
              </div>
            </div>

            {/* Stream Feed */}
            {announcements.length === 0 && (
              <p className="panel muted">No announcements yet. Posts you make here show up for every student in the class.</p>
            )}
            {announcements.map((item) => (
              <article key={item.id} className="panel">
                <div className="post-head">
                  <div className="post-author">
                    <span className="avatar" style={{ backgroundColor: getPersonTint(item.authorName) }} aria-hidden="true">
                      {getInitials(item.authorName)}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <span className="row-title">{item.authorName}</span>
                      <span className="row-meta" style={{ marginTop: 0 }}>{item.authorRole} · {item.createdAt}</span>
                    </div>
                  </div>
                </div>

                <h3 className="post-title">{item.title}</h3>
                <p className="post-body">{item.content}</p>

                <div className="post-foot">
                  <span className="num">{item.likes === 1 ? '1 acknowledgement' : `${item.likes} acknowledgements`}</span>
                  {item.streamedToDiscord && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                      <ExternalLink size={12} aria-hidden="true" />
                      Also posted to Discord
                    </span>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {/* ====================================================================
          TAB 2: CLASSWORK
          ==================================================================== */}
      {activeTab === 'classwork' && (
        <div className="stack">
          <div className="page-head" style={{ marginBottom: 0 }}>
            <div>
              <h2 className="section-title" style={{ marginBottom: 0 }}>Classwork</h2>
              <p className="page-sub">Assignments and quizzes for this course</p>
            </div>
          </div>
          {dataError && <p className="notice notice-negative" role="alert">{dataError}</p>}
          <section className="panel" aria-label="Course assignments and quizzes">
            <ul className="rows">
              {upcoming.map((item) => (
                <li key={item.assignment_id} className="row">
                  <div className="row-main">
                    <span className="row-title">{item.title}</span>
                    <span className="row-meta">
                      Due {item.deadline ? new Date(item.deadline).toLocaleString() : 'No deadline'}
                    </span>
                  </div>
                  <div className="row-end">
                    <span className="row-meta">{item.total_marks} marks</span>
                  </div>
                </li>
              ))}
              {upcoming.length === 0 && (
                <li className="row muted">
                  {dataError ? 'Classwork could not be loaded.' : 'No upcoming classwork.'}
                </li>
              )}
            </ul>
          </section>
        </div>
      )}

      {/* ====================================================================
          TAB 3: SYLLABUS COVERAGE
          ==================================================================== */}
      {activeTab === 'syllabus' && (
        <div className="stack">
          <section className="panel" aria-labelledby="coverage-title">
            <div className="panel-head" style={{ alignItems: 'flex-end' }}>
              <div>
                <h2 id="coverage-title" className="panel-title" style={{ fontSize: '2.2rem' }}>Syllabus coverage</h2>
                <p className="panel-note num">
                  {completedTopics.length} of {allTopics.length} topics · {coveredHours} of {totalHours} lecture hours
                </p>
              </div>
              <span className="stat-value" style={{ marginTop: 0 }}>
                {progressPercent === null ? '–' : <>{progressPercent}<span className="stat-unit">%</span></>}
              </span>
            </div>

            {/* One track per unit, as long as the unit's hours */}
            <ul className="rows">
              {course.units.map((unit) => {
                const unitHours = unit.topics.reduce((s, t) => s + t.durationHours, 0);
                const unitDone = unit.topics.filter((t) => t.isCompleted).reduce((s, t) => s + t.durationHours, 0);
                return (
                  <li key={unit.title} className="row" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(120px, 2fr) 72px', alignItems: 'center' }}>
                    <span className="row-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{unit.title}</span>
                    <div className="bar" aria-hidden="true">
                      <div className="bar-fill" style={{ width: unitHours > 0 ? `${(unitDone / unitHours) * 100}%` : '0%' }} />
                    </div>
                    <span className="num muted" style={{ textAlign: 'right', fontSize: '0.82rem' }}>{unitDone} / {unitHours} h</span>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* Topic-by-Topic Checklist */}
          <section className="panel" aria-labelledby="topics-title">
            <div className="panel-head">
              <h2 id="topics-title" className="panel-title" style={{ fontSize: '1.4rem' }}>Topics</h2>
              {session?.canEditGrades() && <span className="panel-note">Tick a topic once it's been taught</span>}
            </div>
            {allTopics.length === 0 ? (
              <p className="muted">This course has no syllabus topics yet.</p>
            ) : (
              <ul className="rows">
                {allTopics.map((topic) => (
                  <li key={topic.id} className="row">
                    <div className="row-main">
                      <span className="row-title">{topic.title}</span>
                      <span className="row-meta">
                        {topic.learningObjectives.join(', ')} · {topic.durationHours} h
                      </span>
                    </div>
                    <div className="row-end">
                      <span className="row-meta" style={{ marginTop: 0, color: topic.isCompleted ? 'var(--text)' : undefined }}>
                        {topic.isCompleted ? 'Covered' : 'Not yet covered'}
                      </span>
                      {session?.canEditGrades() ? (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm btn-icon"
                          onClick={() => handleToggleTopic(topic.id)}
                          aria-pressed={topic.isCompleted}
                          aria-label={`Mark "${topic.title}" as ${topic.isCompleted ? 'not covered' : 'covered'}`}
                          style={{ color: topic.isCompleted ? 'var(--data)' : 'var(--muted)' }}
                        >
                          {topic.isCompleted ? <CheckCircle2 size={18} aria-hidden="true" /> : <Circle size={18} aria-hidden="true" />}
                        </button>
                      ) : (
                        <span style={{ display: 'inline-flex', color: topic.isCompleted ? 'var(--data)' : 'var(--control)' }} aria-hidden="true">
                          {topic.isCompleted ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {/* ====================================================================
          TAB 4: GRADEBOOK & ATTENDANCE
          ==================================================================== */}
      {activeTab === 'grades' && (
        <div className="stack">
          <div className="page-head" style={{ marginBottom: 0 }}>
            <div>
              <h2 className="section-title" style={{ marginBottom: 0 }}>Grades & attendance</h2>
              <p className="page-sub">
                {!gradebook || gradebook.classes_held === 0
                  ? 'No attendance has been recorded yet.'
                  : isLearner
                    ? belowMinimum.length > 0
                      ? `Your attendance is below the ${ATTENDANCE_MINIMUM}% minimum.`
                      : `Your attendance is at or above the ${ATTENDANCE_MINIMUM}% minimum.`
                  : belowMinimum.length === 0
                    ? `Everyone is above the ${ATTENDANCE_MINIMUM}% attendance minimum.`
                    : `${belowMinimum.map((student) => `${student.full_name} (${pct1(student.attendance_percent)})`).join(', ')} ${belowMinimum.length === 1 ? 'is' : 'are'} below the ${ATTENDANCE_MINIMUM}% attendance minimum.`}
              </p>
            </div>
            <div className="page-actions">
              <button className="btn btn-secondary btn-sm" onClick={() => setShowAIInsights(!showAIInsights)} aria-expanded={showAIInsights}>
                {showAIInsights ? 'Hide AI summary' : 'AI summary'}
              </button>
              {session?.canEditGrades() && (
                <>
                  <input
                    className="input"
                    type="date"
                    value={attendanceDate}
                    onChange={(event) => setAttendanceDate(event.target.value)}
                    aria-label="Attendance session date"
                  />
                  <button className="btn btn-primary btn-sm" onClick={() => void handleSaveGradebook()} disabled={isSavingGradebook || !gradebook}>
                    {isSavingGradebook ? 'Saving…' : 'Save changes'}
                  </button>
                </>
              )}
            </div>
          </div>
          {dataError && <p className="notice notice-negative" role="alert">{dataError}</p>}
          {gradebookFeedback && <p className="notice" role="status">{gradebookFeedback}</p>}

          {/* AI summary, built from the same rows as the table */}
          {showAIInsights && (
            <section className="panel" aria-labelledby="ai-summary-title">
              <h3 id="ai-summary-title" className="panel-title" style={{ fontSize: '1.2rem', marginBottom: '6px' }}>AI summary</h3>
              <p style={{ maxWidth: '72ch' }}>
                {isLearner ? 'Your marks average ' : 'The class averages '}
                <span className="num">{averageTotal?.toFixed(1) ?? '–'}</span> of 100 so far, and {isLearner ? 'your attendance is ' : 'attendance averages '}
                <span className="num">{averageAttendance === null || averageAttendance === undefined ? '–' : pct1(averageAttendance)}</span> over {gradebook?.classes_held ?? 0} classes.
                {belowMinimum.length > 0 && (
                  <> {isLearner ? 'Your attendance is' : belowMinimum.map((student) => student.full_name).join(', ')} {isLearner ? '' : belowMinimum.length === 1 ? 'is' : 'are'} below the {ATTENDANCE_MINIMUM}% minimum.</>
                )}
              </p>
            </section>
          )}

          <div className="panel" style={{ paddingTop: '8px', paddingBottom: '8px' }}>
            <div className="table-wrap">
              <table className="table" style={{ minWidth: '760px' }}>
                <thead>
                  <tr>
                    <th style={{ width: '48px' }}>Roll</th>
                    <th>Student</th>
                    <th className="num">Attendance <span className="muted">(min {ATTENDANCE_MINIMUM}%)</span></th>
                    <th className="num">Assignment /30</th>
                    <th className="num">Quiz /20</th>
                    <th className="num">Midterm /50</th>
                    <th className="num">Total /100</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(gradebook?.students || []).map((student) => {
                    const attendancePercent = student.attendance_percent;
                    const isShort = attendancePercent !== null && attendancePercent < ATTENDANCE_MINIMUM;
                    const assignmentMark = getStudentMark(student.marks, 'Assignment');
                    const quizMark = getStudentMark(student.marks, 'Quiz');
                    const midtermMark = getStudentMark(student.marks, 'Midterm');
                    const total = Number(assignmentMark?.marks_obtained || 0)
                      + Number(quizMark?.marks_obtained || 0)
                      + Number(midtermMark?.marks_obtained || 0);
                    return (
                      <tr key={student.student_id}>
                        <td className="muted" style={{ fontVariantNumeric: 'tabular-nums' }}>{student.student_id}</td>
                        <td>
                          <span style={{ fontWeight: 500 }}>{student.full_name}</span>
                          <span className="cell-sub">{student.username}</span>
                        </td>
                        <td className="num">
                          <div className="attend" title={`${student.attended} of ${gradebook?.classes_held ?? 0} classes`}>
                            <span className="attend-track" aria-hidden="true">
                              <span className={`attend-fill${isShort ? ' is-short' : ''}`} style={{ width: `${attendancePercent ?? 0}%` }} />
                              <span className="attend-min" style={{ left: `${ATTENDANCE_MINIMUM}%` }} />
                            </span>
                            <span className="attend-value" style={{ color: isShort ? 'var(--negative)' : undefined }}>
                              {attendancePercent === null ? '–' : pct1(attendancePercent)}
                            </span>
                          </div>
                          {session?.canEditGrades() ? (
                            <select
                              className="select"
                              value={attendanceStatuses[student.student_id] || 'ABSENT'}
                              onChange={(event) => setAttendanceStatuses((current) => ({
                                ...current,
                                [student.student_id]: event.target.value as 'PRESENT' | 'ABSENT',
                              }))}
                              aria-label={`Attendance status for ${student.full_name}`}
                            >
                              <option value="PRESENT">Present</option>
                              <option value="ABSENT">Absent</option>
                            </select>
                          ) : (
                            <span className="cell-sub">{student.attended} of {gradebook?.classes_held ?? 0}</span>
                          )}
                        </td>
                        {[
                          { name: 'Assignment', total: 30, mark: assignmentMark },
                          { name: 'Quiz', total: 20, mark: quizMark },
                          { name: 'Midterm', total: 50, mark: midtermMark },
                        ].map(({ name, total: maximum, mark }) => (
                          <td className="num" key={name}>
                            {session?.canEditGrades() ? (
                              <input
                                className="input"
                                type="number"
                                min="0"
                                max={maximum}
                                step="0.01"
                                value={getMarkValue(student.student_id, name, mark)}
                                onChange={(event) => setMarkDrafts((current) => ({
                                  ...current,
                                  [`${student.student_id}:${name}`]: event.target.value,
                                }))}
                                aria-label={`${name} marks for ${student.full_name}`}
                              />
                            ) : mark ? `${mark.marks_obtained}/${mark.total_marks}` : '–'}
                          </td>
                        ))}
                        <td className="num" style={{ fontWeight: 600 }}>{total}</td>
                        <td>
                          {isShort ? (
                            <span className="pill pill-negative">Attendance risk</span>
                          ) : (
                            <span className="muted">{total >= 90 ? 'Exemplary' : 'On track'}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {gradebook?.students.length === 0 && (
                    <tr><td colSpan={8} className="muted">No students are enrolled in this course.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          TAB 5: PEOPLE (ROSTER)
          ==================================================================== */}
      {activeTab === 'people' && (
        <div className="stack">
          {/* Instructors & Faculty */}
          <section className="panel" aria-labelledby="teachers-title">
            <div className="panel-head" style={{ marginBottom: '4px' }}>
              <h2 id="teachers-title" className="panel-title" style={{ fontSize: '1.85rem' }}>Teacher</h2>
            </div>
            <ul className="rows">
              <li className="row">
                <div className="post-author">
                  <span className="avatar avatar-lg" style={{ backgroundColor: getPersonTint(course.instructor) }} aria-hidden="true">
                    {getInitials(course.instructor)}
                  </span>
                  <div>
                    <span className="row-title">{course.instructor}</span>
                    <span className="row-meta">Course teacher</span>
                  </div>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={() => alert(`Contacting ${course.instructor}`)}>
                  Message
                </button>
              </li>
            </ul>
          </section>

          {/* Classmates & Batch Roster */}
          <section className="panel" aria-labelledby="students-title">
            <div className="panel-head" style={{ marginBottom: '4px' }}>
              <h2 id="students-title" className="panel-title" style={{ fontSize: '1.85rem' }}>Students</h2>
              <span className="panel-note num">
                {(course.enrolledStudents?.length ?? 0) < course.studentsCount
                  ? `Showing ${course.enrolledStudents?.length ?? 0} of ${course.studentsCount} enrolled`
                  : `${course.studentsCount} enrolled`}
              </span>
            </div>

            {(course.enrolledStudents && course.enrolledStudents.length > 0) ? (
              <ul className="rows">
                {course.enrolledStudents.map((stud) => {
                  const isCurrentUser = session?.email.toLowerCase() === stud.email.toLowerCase();
                  const isCR = stud.email.includes('.cr@');
                  return (
                    <li key={stud.email} className="row">
                      <div className="post-author">
                        <span className="avatar avatar-lg" style={{ backgroundColor: getPersonTint(stud.name) }} aria-hidden="true">
                          {stud.avatar || getInitials(stud.name)}
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <span className="row-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {stud.name}
                            {isCR && <span className="pill">CR</span>}
                            {isCurrentUser && <span className="pill">You</span>}
                          </span>
                          <span className="row-meta">{stud.roll || '–'} · {stud.email}</span>
                        </div>
                      </div>

                      {isCR && !isCurrentUser && (
                        <button className="btn btn-secondary btn-sm" onClick={() => alert('Opening CR Coordination Chat')}>
                          Message CR
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="muted">No students have joined yet. Share the class code to let them in.</p>
            )}
          </section>
        </div>
      )}

      {/* ====================================================================
          TAB 6: AI STUDIO (INTEGRATED INSIDE COURSE PANEL)
          1. Draft AI Lecture Plan (Teacher Only)
          2. Formative 10-Question Quiz Engine (Teacher Only)
          3. Slide and Lecture Summarizer (Available for Students & Teachers)
          ==================================================================== */}
      {activeTab === 'aistudio' && (
        <div className="stack">
          {/* Tools 1 & 2 Grid (Rendered strictly for Course Teachers / Faculty) */}
          {isTeacher && (
            <div className="split">
              {/* Tool 1: Draft AI Lecture Plan */}
              <section className="panel" aria-labelledby="plan-title">
                <h2 id="plan-title" className="panel-title" style={{ fontSize: '1.25rem', marginBottom: '4px' }}>Lecture plan</h2>
                <p className="panel-desc" style={{ marginTop: 0 }}>
                  Drafts a timed lesson plan with class activities from the syllabus outcomes for one topic.
                </p>

                <label className="field" style={{ marginBottom: '14px' }}>
                  <span className="field-label">Lecture topic</span>
                  <input
                    className="input"
                    type="text"
                    name="plan-topic"
                    autoComplete="off"
                    value={planTopic}
                    onChange={(e) => setPlanTopic(e.target.value)}
                  />
                </label>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button className="btn btn-primary btn-sm" disabled={isGeneratingPlan} onClick={handleGeneratePlan}>
                    {isGeneratingPlan ? 'Drafting…' : 'Draft lecture plan'}
                  </button>

                  {generatedPlan && (
                    <button className="btn btn-secondary btn-sm" onClick={handlePublishPlanToStream}>
                      <Send size={13} aria-hidden="true" />
                      <span>Post to stream</span>
                    </button>
                  )}
                </div>

                <div aria-live="polite">
                  {planPublished && (
                    <p className="notice notice-positive" style={{ marginTop: '12px' }}>
                      Posted to the stream and sent to Discord.
                    </p>
                  )}
                </div>

                {generatedPlan && (
                  <div style={{ marginTop: '16px', padding: '14px 16px', backgroundColor: 'var(--color-surface-sunken)', borderRadius: 'var(--radius-control)', fontSize: '0.84rem', whiteSpace: 'pre-line', lineHeight: 1.6 }}>
                    {generatedPlan}
                  </div>
                )}
              </section>

              {/* Tool 2: Formative 10-Question Quiz Engine */}
              <section className="panel" aria-labelledby="quiz-title">
                <h2 id="quiz-title" className="panel-title" style={{ fontSize: '1.25rem', marginBottom: '4px' }}>10-question quiz</h2>
                <p className="panel-desc" style={{ marginTop: 0 }}>
                  Writes 10 multiple-choice questions with an answer key, graded automatically when students submit.
                </p>

                <label className="field" style={{ marginBottom: '14px' }}>
                  <span className="field-label">Unit or quiz topic</span>
                  <input
                    className="input"
                    type="text"
                    name="quiz-topic"
                    autoComplete="off"
                    value={quizTopic}
                    onChange={(e) => setQuizTopic(e.target.value)}
                  />
                </label>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button className={`btn btn-sm ${generatedQuiz ? 'btn-secondary' : 'btn-primary'}`} disabled={isGeneratingQuiz} onClick={handleGenerateQuiz}>
                    {isGeneratingQuiz ? 'Writing questions…' : generatedQuiz ? 'Write again' : 'Write quiz'}
                  </button>

                  {generatedQuiz && (
                    <button className="btn btn-primary btn-sm" onClick={handleAssignQuiz}>
                      Assign to classwork
                    </button>
                  )}
                </div>

                <div aria-live="polite">
                  {quizAssigned && (
                    <p className="notice notice-positive" style={{ marginTop: '12px' }}>
                      Quiz added to Classwork with automatic grading.
                    </p>
                  )}
                </div>

                {generatedQuiz && (
                  <ol style={{ marginTop: '16px', maxHeight: '320px', overflowY: 'auto', overscrollBehavior: 'contain', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.82rem' }}>
                    {generatedQuiz.map((item, idx) => (
                      <li key={idx}>
                        <span style={{ fontWeight: 500 }}>{item.q}</span>
                        <ul style={{ listStyle: 'none', margin: '4px 0', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '2px 12px' }}>
                          {item.options.map((opt, optIdx) => (
                            <li key={optIdx} style={{ color: optIdx === item.answer ? 'var(--text)' : 'var(--muted)', fontWeight: optIdx === item.answer ? 500 : 400 }}>
                              {String.fromCharCode(65 + optIdx)}. {opt}{optIdx === item.answer && ' (answer)'}
                            </li>
                          ))}
                        </ul>
                        <span className="muted" style={{ fontSize: '0.74rem' }}>{item.explanation}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </div>
          )}

          {/* Tool 3: Slide & Lecture Summarizer (Available for Students, removed for Teacher context) */}
          {!isTeacher && (
            <section className="panel" aria-labelledby="summary-title">
              <h2 id="summary-title" className="panel-title" style={{ fontSize: '1.4rem', marginBottom: '4px' }}>Lecture summary</h2>
              <p className="panel-desc" style={{ marginTop: 0 }}>
                Turns a {course.code} slide deck into revision notes: key takeaways, terms and what the exam focuses on.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', alignItems: 'start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '400px' }}>
                  <label className="field">
                    <span className="field-label">Slide deck</span>
                    <select className="select" value={slideDeck} onChange={(e) => setSlideDeck(e.target.value)}>
                      <option value={`${course.code} Lecture 01-04: Software Architecture & Requirements`}>
                        {course.code} Lecture 01-04: Software Architecture & Requirements
                      </option>
                      <option value={`${course.code} Lecture 05-08: GoF Creational & Structural Patterns`}>
                        {course.code} Lecture 05-08: GoF Creational & Structural Patterns
                      </option>
                      <option value={`${course.code} Lecture 09-12: Behavioral Patterns & State Machines`}>
                        {course.code} Lecture 09-12: Behavioral Patterns & State Machines
                      </option>
                      <option value={`${course.code} Lecture 13-15: Database Transactions & ACID Boundaries`}>
                        {course.code} Lecture 13-15: Database Transactions & ACID Boundaries
                      </option>
                    </select>
                  </label>

                  <button className="btn btn-primary" disabled={isGeneratingSummary} onClick={handleGenerateSummary} style={{ alignSelf: 'flex-start' }}>
                    {isGeneratingSummary ? 'Summarising…' : 'Summarise deck'}
                  </button>
                </div>

                <div>
                  {generatedSummary ? (
                    <div style={{ padding: '16px', backgroundColor: 'var(--color-surface-sunken)', borderRadius: 'var(--radius-card)' }}>
                      <div className="panel-head">
                        <h3 className="panel-title" style={{ fontSize: '1.1rem' }}>{slideDeck}</h3>
                        <button onClick={handleCopySummary} className="btn btn-ghost btn-sm">
                          {copiedSummary ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
                          <span aria-live="polite">{copiedSummary ? 'Copied' : 'Copy notes'}</span>
                        </button>
                      </div>

                      <p style={{ fontSize: '0.85rem', marginBottom: '14px', maxWidth: '72ch' }}>{generatedSummary.overview}</p>

                      <h4 style={{ fontFamily: 'var(--font-display)', fontSize: '0.82rem', marginBottom: '4px' }}>Key takeaways</h4>
                      <ul style={{ paddingLeft: '18px', fontSize: '0.82rem', lineHeight: 1.55, marginBottom: '14px' }}>
                        {generatedSummary.keyTakeaways.map((item, idx) => (
                          <li key={idx} style={{ marginBottom: '4px' }}>{item}</li>
                        ))}
                      </ul>

                      <h4 style={{ fontFamily: 'var(--font-display)', fontSize: '0.82rem', marginBottom: '4px' }}>For the exam</h4>
                      <ul style={{ paddingLeft: '18px', fontSize: '0.82rem', lineHeight: 1.55, marginBottom: '14px' }}>
                        {generatedSummary.examFocus.map((f, idx) => (
                          <li key={idx} style={{ marginBottom: '4px' }}>{f}</li>
                        ))}
                      </ul>

                      <h4 style={{ fontFamily: 'var(--font-display)', fontSize: '0.82rem', marginBottom: '6px' }}>Terms</h4>
                      <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
                        {generatedSummary.definitions.map((d, idx) => (
                          <div key={idx} style={{ padding: '10px 12px', backgroundColor: 'var(--surface)', borderRadius: 'var(--radius-control)', fontSize: '0.78rem' }}>
                            <dt style={{ fontWeight: 500 }}>{d.term}</dt>
                            <dd className="muted">{d.definition}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  ) : (
                    <p style={{ padding: '16px', border: '1px dashed var(--control)', borderRadius: 'var(--radius-card)', color: 'var(--muted)', fontSize: '0.88rem' }}>
                      Pick a deck and choose <strong style={{ color: 'var(--text)', fontWeight: 500 }}>Summarise deck</strong>. Your notes appear here.
                    </p>
                  )}
                </div>
              </div>
            </section>
          )}
        </div>
      )}
      </div>

      {/* Join Course Modal (for student accounts) */}
      <JoinCourseModal
        isOpen={isJoinOpen}
        initialCode={course.cohortCode}
        onClose={() => setIsJoinOpen(false)}
        onJoined={(joinedCourse) => {
          onCourseUpdated(joinedCourse);
        }}
      />
    </div>
  );
};

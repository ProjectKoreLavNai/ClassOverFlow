import React, { useState } from 'react';
import {
  ArrowLeft, Copy, Check, ExternalLink,
  CheckCircle2, Circle,
  Send, UserPlus, Lock
} from 'lucide-react';
import { CourseBlueprint } from '../../patterns/prototype/CoursePrototype';
import { ClassroomAcademicFacade } from '../../patterns/facade/ClassroomAcademicFacade';
import type { CourseAnnouncement } from '../../patterns/facade/ClassroomAcademicFacade';
import { CloneCourseModal } from './CloneCourseModal';
import { JoinCourseModal } from './JoinCourseModal';
import { useAuth } from '../../context/AuthContext';
import { SecurityBouncerProxy } from '../../patterns/proxy';
import { getCourseTheme, getInitials, getPersonTint } from '../../utils/courseTheme';

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

// Sample gradebook. Percentages, totals and averages below are computed from these rows.
const CLASSES_HELD = 25;
const ATTENDANCE_MINIMUM = 75;
const GRADEBOOK = [
  { roll: '55', name: 'Daemon Targaryen', role: 'Class Representative', attended: 24, assign: 28, quiz: 19, mid: 47 },
  { roll: '21', name: 'Gojo Satoru', role: 'QA Specialist', attended: 25, assign: 29, quiz: 18, mid: 46 },
  { roll: '14', name: 'Kiyotaka Ayanokoji', role: 'Frontend Lead', attended: 23, assign: 27, quiz: 19, mid: 45 },
  { roll: '03', name: 'Aizen Sosuke', role: 'Backend Engineer', attended: 24, assign: 28, quiz: 20, mid: 48 },
  { roll: '07', name: 'Farhan Sadik', role: 'Regular Student', attended: 18, assign: 22, quiz: 14, mid: 34 },
].map((row) => ({
  ...row,
  attPct: (row.attended / CLASSES_HELD) * 100,
  total: row.assign + row.quiz + row.mid,
}));
const AVERAGE_ATTENDANCE = (GRADEBOOK.reduce((sum, r) => sum + r.attended, 0) / (GRADEBOOK.length * CLASSES_HELD)) * 100;
const AVERAGE_TOTAL = GRADEBOOK.reduce((sum, r) => sum + r.total, 0) / GRADEBOOK.length;
const BELOW_MINIMUM = GRADEBOOK.filter((r) => r.attPct < ATTENDANCE_MINIMUM);
console.assert(
  GRADEBOOK.every((r) => r.total === r.assign + r.quiz + r.mid && r.total <= 100),
  'Gradebook totals must equal their parts'
);

const UPCOMING = [
  { kind: 'In-course task', title: 'Software Requirements (SRS)', when: 'Due Friday, 11:59 PM' },
  { kind: 'Quiz', title: 'Architecture & Use Cases', when: 'Sunday, Oct 26 · 20 marks' },
  { kind: 'Lab submission', title: 'Database Schema & ERD Model', when: 'Next Wednesday' },
];

const pct1 = (value: number) => `${value.toFixed(1)}%`;

export const CourseDetailView: React.FC<Props> = ({ course, onBack, onCourseUpdated }) => {
  const { session, setViolation } = useAuth();
  const facade = ClassroomAcademicFacade.getInstance();
  const isTeacher = session?.role === 'teacher';
  const theme = getCourseTheme(course);

  // Course workspace tabs: STREAM, CLASSWORK, SYLLABUS COVERAGE, GRADEBOOK, PEOPLE, AI STUDIO
  const [activeTab, setActiveTab] = useState<CourseTab>('stream');

  // Announcements
  const [announcements, setAnnouncements] = useState<CourseAnnouncement[]>(facade.getAnnouncements(course.code));

  // Composer state
  const [isComposerExpanded, setIsComposerExpanded] = useState(false);
  const [postTitle, setPostTitle] = useState('');
  const [postContent, setPostContent] = useState('');
  const [streamDiscord, setStreamDiscord] = useState(true);
  const [publishFeedback, setPublishFeedback] = useState<string | null>(null);

  // Copy code & Clone modal state
  const [copiedCode, setCopiedCode] = useState(false);
  const [isCloneOpen, setIsCloneOpen] = useState(false);
  const [isJoinOpen, setIsJoinOpen] = useState(false);

  const isEnrolled = session ? facade.isStudentEnrolled(course.code, session.email) : false;

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

  const handlePublishPlanToStream = () => {
    if (!generatedPlan || !session) return;
    const res = facade.publishAnnouncement(
      course.code,
      `AI Lecture Plan: ${planTopic}`,
      generatedPlan,
      session,
      true,
      'Lecture Plan'
    );
    if (res.success) {
      setAnnouncements(facade.getAnnouncements(course.code));
      setPlanPublished(true);
      setTimeout(() => setPlanPublished(false), 4000);
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

  const handleCopyCode = () => {
    navigator.clipboard.writeText(course.cohortCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handlePublish = (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;

    const res = facade.publishAnnouncement(
      course.code,
      postTitle || 'Course Stream Memo',
      postContent,
      session,
      streamDiscord,
      'Official Announcement'
    );

    if (res.success && res.announcement) {
      setAnnouncements(facade.getAnnouncements(course.code));
      setPostTitle('');
      setPostContent('');
      setIsComposerExpanded(false);
      setPublishFeedback(res.message);
      setTimeout(() => setPublishFeedback(null), 4000);
    } else {
      setPublishFeedback(res.message);
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

  if (session?.role === 'student' && !isEnrolled) {
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
        <span>{session?.role === 'student' ? 'My classrooms' : 'All classrooms'}</span>
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
            {session?.role !== 'student' ? (
              <>
                <button
                  onClick={handleCopyCode}
                  className="btn btn-secondary btn-sm"
                  aria-label={`Copy class code ${course.cohortCode}`}
                >
                  {copiedCode ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
                  <span>Class code</span>
                  <span className="mono" translate="no">{course.cohortCode}</span>
                </button>
                {session?.canCreateCourse() && (
                  <button onClick={() => setIsCloneOpen(true)} className="btn btn-secondary btn-sm">
                    Duplicate course
                  </button>
                )}
                <span aria-live="polite" className="visually-hidden">{copiedCode ? 'Class code copied' : ''}</span>
              </>
            ) : isEnrolled ? (
              <span className="pill"><Check size={12} aria-hidden="true" /> Enrolled · {course.term}</span>
            ) : (
              <button onClick={() => setIsJoinOpen(true)} className="btn btn-primary btn-sm">
                <UserPlus size={14} aria-hidden="true" />
                <span>Join course</span>
              </button>
            )}
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
            <div className="stat-label">Average attendance</div>
            <div className="stat-value">{AVERAGE_ATTENDANCE.toFixed(1)}<span className="stat-unit">%</span></div>
            <div className="stat-note">Over {CLASSES_HELD} classes held</div>
          </div>
          <div className="stat">
            <div className="stat-label">Below {ATTENDANCE_MINIMUM}% attendance</div>
            <div className="stat-value" style={{ color: BELOW_MINIMUM.length > 0 ? 'var(--negative)' : undefined }}>
              {BELOW_MINIMUM.length}
            </div>
            <div className="stat-note">
              {BELOW_MINIMUM.length > 0 ? BELOW_MINIMUM.map((r) => r.name).join(', ') : 'Everyone is above the minimum'}
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
            <ul className="rows">
              {UPCOMING.map((item) => (
                <li key={item.title} className="row" style={{ minHeight: '56px' }}>
                  <div className="row-main">
                    <span className="row-title">{item.title}</span>
                    <span className="row-meta">{item.kind} · {item.when}</span>
                  </div>
                </li>
              ))}
            </ul>
          </aside>

          {/* Right Column: Announcements Feed */}
          <div className="stack">

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
              <p className="page-sub">Grouped by unit</p>
            </div>
            {session?.canCreateCourse() && (
              <button className="btn btn-primary btn-sm" onClick={() => alert('New assignment & quiz form')}>
                Create assignment or quiz
              </button>
            )}
          </div>

          {/* Unit I */}
          <section className="panel" aria-labelledby="unit-1">
            <div className="panel-head">
              <h3 id="unit-1" className="panel-title" style={{ fontSize: '1.25rem' }}>Unit 1 · Architectural analysis & UML modelling</h3>
              <span className="panel-note">Covered in lecture</span>
            </div>
            <ul className="rows">
              <li className="row">
                <div className="row-main">
                  <span className="row-title">Use case diagram & SRS specification</span>
                  <span className="row-meta">Posted Oct 12 · 100 points · individual or team</span>
                </div>
                <div className="row-end">
                  <span className="row-meta">Due Friday, 11:59 PM</span>
                  <span className="pill">Assignment</span>
                </div>
              </li>
              <li className="row">
                <div className="row-main">
                  <span className="row-title">Lecture plan 3: Use case analysis & boundary design</span>
                  <span className="row-meta">Drafted with AI studio · approved by the teacher</span>
                </div>
                <div className="row-end">
                  <span className="pill">Lecture plan</span>
                </div>
              </li>
            </ul>
          </section>

          {/* Unit II */}
          <section className="panel" aria-labelledby="unit-2">
            <div className="panel-head">
              <h3 id="unit-2" className="panel-title" style={{ fontSize: '1.25rem' }}>Unit 2 · AI-assisted workflow & automated quizzing</h3>
              <span className="panel-note">In progress</span>
            </div>
            <ul className="rows">
              <li className="row">
                <div className="row-main">
                  <span className="row-title">Formative quiz 1: Software architecture principles</span>
                  <span className="row-meta">10 questions · graded automatically · 20 marks</span>
                </div>
                <div className="row-end">
                  <span className="row-meta">Due Sunday</span>
                  <span className="pill">Quiz</span>
                </div>
              </li>
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
                {BELOW_MINIMUM.length === 0
                  ? `Everyone is above the ${ATTENDANCE_MINIMUM}% attendance minimum.`
                  : `${BELOW_MINIMUM.map((r) => `${r.name} (${pct1(r.attPct)})`).join(', ')} ${BELOW_MINIMUM.length === 1 ? 'is' : 'are'} below the ${ATTENDANCE_MINIMUM}% attendance minimum.`}
              </p>
            </div>
            <div className="page-actions">
              <button className="btn btn-secondary btn-sm" onClick={() => setShowAIInsights(!showAIInsights)} aria-expanded={showAIInsights}>
                {showAIInsights ? 'Hide AI summary' : 'AI summary'}
              </button>
              {session?.canEditGrades() && (
                <button className="btn btn-primary btn-sm" onClick={() => alert('Attendance & marks successfully saved to database transactions!')}>
                  Save changes
                </button>
              )}
            </div>
          </div>

          {/* AI summary, built from the same rows as the table */}
          {showAIInsights && (
            <section className="panel" aria-labelledby="ai-summary-title">
              <h3 id="ai-summary-title" className="panel-title" style={{ fontSize: '1.2rem', marginBottom: '6px' }}>AI summary</h3>
              <p style={{ maxWidth: '72ch' }}>
                The class averages <span className="num">{AVERAGE_TOTAL.toFixed(1)}</span> of 100 so far, and attendance averages{' '}
                <span className="num">{pct1(AVERAGE_ATTENDANCE)}</span> over {CLASSES_HELD} classes.
                {BELOW_MINIMUM.length > 0 && (
                  <> {BELOW_MINIMUM.map((r) => `${r.name} (roll ${r.roll})`).join(', ')} {BELOW_MINIMUM.length === 1 ? 'is' : 'are'} below the {ATTENDANCE_MINIMUM}% minimum; a counselling reminder is waiting for your approval.</>
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
                  {GRADEBOOK.map((row) => {
                    const isShort = row.attPct < ATTENDANCE_MINIMUM;
                    return (
                      <tr key={row.roll}>
                        <td className="muted" style={{ fontVariantNumeric: 'tabular-nums' }}>{row.roll}</td>
                        <td>
                          <span style={{ fontWeight: 500 }}>{row.name}</span>
                          <span className="cell-sub">{row.role}</span>
                        </td>
                        <td className="num">
                          <div className="attend" title={`${row.attended} of ${CLASSES_HELD} classes`}>
                            <span className="attend-track" aria-hidden="true">
                              <span className={`attend-fill${isShort ? ' is-short' : ''}`} style={{ width: `${row.attPct}%` }} />
                              <span className="attend-min" style={{ left: `${ATTENDANCE_MINIMUM}%` }} />
                            </span>
                            <span className="attend-value" style={{ color: isShort ? 'var(--negative)' : undefined }}>
                              {pct1(row.attPct)}
                            </span>
                          </div>
                          <span className="cell-sub">{row.attended} of {CLASSES_HELD}</span>
                        </td>
                        <td className="num">{row.assign}</td>
                        <td className="num">{row.quiz}</td>
                        <td className="num">{row.mid}</td>
                        <td className="num" style={{ fontWeight: 600 }}>{row.total}</td>
                        <td>
                          {isShort ? (
                            <span className="pill pill-negative">Attendance risk</span>
                          ) : (
                            <span className="muted">{row.total >= 90 ? 'Exemplary' : 'On track'}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
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
                          <span className="row-meta">Roll {stud.roll || '–'} · {stud.email}</span>
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

      {/* Clone Course Modal (Prototype Pattern) */}
      <CloneCourseModal
        sourceCourse={course}
        isOpen={isCloneOpen}
        onClose={() => setIsCloneOpen(false)}
        onCloned={(cloned) => {
          onCourseUpdated(cloned);
          alert(`Course duplicated via Prototype pattern! Join code: ${cloned.cohortCode}`);
        }}
      />

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

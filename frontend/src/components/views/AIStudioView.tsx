import React, { useState } from 'react';
import { Sparkles, HelpCircle, FileText, CheckCircle2, Copy, BookOpen } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { SecurityBouncerProxy } from '../../patterns/proxy';

export const AIStudioView: React.FC = () => {
  const { session, setViolation } = useAuth();
  const isTeacher = session?.role === 'teacher';

  // 1. Draft AI Lecture Plan State
  const [topic, setTopic] = useState('Architectural Design Patterns (GoF & Structural)');
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [generatedDraft, setGeneratedDraft] = useState<string | null>(null);

  // 2. Formative 10-Question Quiz Engine State
  const [quizTopic, setQuizTopic] = useState('Structural Patterns & UML Class Diagrams');
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [generatedQuiz, setGeneratedQuiz] = useState<Array<{ q: string; options: string[]; answer: number; explanation: string }> | null>(null);

  // 3. Slide & Lecture Summarizer State (Available for Students)
  const [slideDeck, setSlideDeck] = useState('Lecture 01-04: Software Architecture & Requirements Engineering');
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [generatedSummary, setGeneratedSummary] = useState<{
    overview: string;
    keyTakeaways: string[];
    examFocus: string[];
    definitions: Array<{ term: string; definition: string }>;
  } | null>(null);
  const [copiedSummary, setCopiedSummary] = useState(false);

  // Action Handlers with RBAC Security Checks
  const handleGeneratePlan = () => {
    const check = SecurityBouncerProxy.inspectAction('draft_lecture_plan', session);
    if (!check.allowed) {
      setViolation(check);
      return;
    }
    setIsGeneratingPlan(true);
    setTimeout(() => {
      setIsGeneratingPlan(false);
      setGeneratedDraft(`Lecture plan:
• Learning Objective: Master GoF Structural Patterns (Proxy, Facade, Decorator, Adapter).
• Recommended Pedagogical Arc:
  1. Motivation (15m): Disparate subsystems vs. unified client interfaces.
  2. Live Demonstration (25m): Step-by-step UML modeling of the Facade & Proxy bouncers.
  3. Interactive Student Activity (30m): Reverse-engineering role-based access control filters.
• Formative Assessment: 10 MCQ automated quiz covering ACID transaction boundaries & proxy traps.`);
    }, 900);
  };

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
        { q: 'Which GoF structural pattern provides a surrogate or placeholder to control access to another object?', options: ['Adapter', 'Proxy', 'Facade', 'Composite'], answer: 1, explanation: 'Proxy controls and manages access to the underlying real subject.' },
        { q: 'What is the primary role of a Facade pattern in enterprise architectural design?', options: ['Manage object creation lifecycles', 'Provide a simplified, unified interface to a complex subsystem', 'Serialize data over network sockets', 'Enforce immutable database schema'], answer: 1, explanation: 'Facade simplifies subsystem complexity by presenting a high-level facade interface.' },
        { q: 'In Role-Based Access Control (RBAC), at which layer should the security proxy intercept unauthorized requests?', options: ['Database write trigger', 'Client rendering cycle', 'Application Gateway / Service Boundary', 'Physical storage controller'], answer: 2, explanation: 'Service boundaries and gateway proxies block unauthorized executions before business logic fires.' },
        { q: 'Which pattern is ideal when cloning an existing syllabus blueprint without subclass coupling?', options: ['Singleton', 'Prototype', 'Observer', 'State'], answer: 1, explanation: 'Prototype permits cloning existing objects via clone interfaces.' },
        { q: 'How does an Academic Facade prevent tight coupling in classroom management workflows?', options: ['By exposing raw SQL queries', 'By encapsulating grade calculation, attendance, and roster synchronization behind single calls', 'By running multiple daemon threads', 'By bypassing role validation'], answer: 1, explanation: 'It orchestrates complex operations through a clean, coarse-grained API.' },
        { q: 'In multi-channel academic notifications, which pattern notifies Discord and Messenger listeners concurrently?', options: ['Observer', 'Command', 'Memento', 'Interpreter'], answer: 0, explanation: 'Observer defines a one-to-many dependency between subject and notification channels.' },
        { q: 'When is Chain of Responsibility preferable over nested if-else validation statements?', options: ['When only one single check is ever needed', 'When sequential authentication and institutional verification filters must be decoupled', 'When sorting array elements', 'When compiling WebAssembly code'], answer: 1, explanation: 'Chain of Responsibility links independent handlers without tight coupling.' },
        { q: 'Which statement best describes the Singleton pattern in session authentication state?', options: ['Creates a new session object per HTTP request', 'Ensures a single shared instance manages global authentication state', 'Requires multiple inheritance', 'Disables garbage collection'], answer: 1, explanation: 'Singleton guarantees only one instance exists and provides a global access point.' },
        { q: 'What is the key benefit of formative assessment quizzes over summative examinations?', options: ['Formative quizzes award final graduation degrees', 'They provide immediate feedback for continuous learning rather than final grading judgment', 'They take 3 hours to grade manually', 'They require external invigilators'], answer: 1, explanation: 'Formative quizzes assess real-time student understanding and pinpoint syllabus gaps.' },
        { q: 'In UML Class Diagrams, how is a dependency relationship between an interface and implementer represented?', options: ['Solid line with solid arrowhead', 'Dashed line with hollow triangle arrowhead', 'Dotted red circle', 'Double parallel lines'], answer: 1, explanation: 'Interface realization is denoted with a dashed line ending with a hollow triangular arrowhead.' }
      ]);
    }, 1000);
  };

  const handleGenerateSummary = () => {
    setIsGeneratingSummary(true);
    setTimeout(() => {
      setIsGeneratingSummary(false);
      setGeneratedSummary({
        overview: 'Comprehensive student revision brief extracted directly from syllabus slides, focusing on Software Architecture, GoF Patterns, and SRS validation.',
        keyTakeaways: [
          'Creational vs Structural Patterns: Know the distinction between how objects are instantiated (Factory, Prototype) and how classes/objects are composed into larger structures (Proxy, Facade).',
          'Security Bouncer Proxy: Intercepts forbidden calls (HTTP 403) before sensitive student records or grades are altered.',
          'ClassOverflow Unified Facade: Replaces disparate Excel spreadsheets by coordinating syllabus tracking, automated attendance, and gradebook commits in one cohesive transaction.',
          'Exam Weightage: 70% of final exam items will test UML architectural models, pattern rationale, and role authorization pipelines.'
        ],
        definitions: [
          { term: 'Proxy Pattern', definition: 'A structural design pattern that provides an object that acts as a substitute or bouncer for a real service object.' },
          { term: 'Prototype Pattern', definition: 'A creational design pattern that allows copying existing syllabus configurations without making code dependent on their concrete classes.' },
          { term: 'Facade Pattern', definition: 'A structural design pattern that provides a simplified interface to a complex set of classes or third-party libraries.' }
        ],
        examFocus: [
          'Be prepared to draw UML class diagrams illustrating Proxy and Facade relationships.',
          'Explain why separating Teacher, Student, CR, and Admin personas using the Factory Method pattern prevents privilege escalation.'
        ]
      });
    }, 850);
  };

  const handleCopySummary = () => {
    if (!generatedSummary) return;
    const text = `CLASS STUDY NOTES: ${slideDeck}\n\nOVERVIEW:\n${generatedSummary.overview}\n\nKEY TAKEAWAYS:\n${generatedSummary.keyTakeaways.map((k) => `• ${k}`).join('\n')}\n\nEXAM FOCUS:\n${generatedSummary.examFocus.map((f) => `• ${f}`).join('\n')}`;
    navigator.clipboard.writeText(text);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 3000);
  };

  return (
    <div className="animate-fade-in" style={{ padding: '2rem' }}>
      {isTeacher && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>

          {/* ====================================================================
              TOOL 1: DRAFT AI LECTURE PLAN (AVAILABLE FOR TEACHER)
              ==================================================================== */}
          <div className="academic-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-accent-text)' }}>
                  <Sparkles size={20} />
                  <h3 style={{ fontSize: '1.35rem', margin: 0 }}>Draft AI Lecture Plan</h3>
                </div>
              </div>

              <p style={{ color: 'var(--color-muted-foreground)', fontSize: '0.88rem', marginBottom: '1.25rem' }}>
                Synthesizes structured lesson blueprints, timing breakdowns, and recommended classroom activities directly from syllabus learning outcomes.
              </p>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontFamily: 'var(--font-display)', fontSize: '0.74rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                  Lecture Academic Topic:
                </label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '6px', border: '1px solid var(--color-border-strong)', boxSizing: 'border-box' }}
                />
              </div>

              <button
                className="btn btn-primary"
                disabled={isGeneratingPlan}
                onClick={handleGeneratePlan}
                style={{ width: '100%', padding: '0.65rem' }}
              >
                <Sparkles size={16} />
                <span>{isGeneratingPlan ? 'Synthesizing with Gemini AI...' : 'Generate Draft Lecture Plan'}</span>
              </button>

              {generatedDraft && (
                <div style={{ marginTop: '1.25rem', padding: '1rem', backgroundColor: 'var(--color-surface-sunken)', borderRadius: '6px', fontSize: '0.86rem', whiteSpace: 'pre-line', lineHeight: 1.55 }}>
                  {generatedDraft}
                </div>
              )}
            </div>
          </div>

          {/* ====================================================================
              TOOL 2: FORMATIVE 10-QUESTION QUIZ ENGINE (AVAILABLE FOR TEACHER)
              ==================================================================== */}
          <div className="academic-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-success)' }}>
                  <HelpCircle size={20} />
                  <h3 style={{ fontSize: '1.35rem', margin: 0 }}>Formative 10-Question Quiz Engine</h3>
                </div>
                <span style={{ fontSize: '0.74rem', color: 'var(--color-success)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--color-success)' }} />
                  Teacher Privilege
                </span>
              </div>

              <p style={{ color: 'var(--color-muted-foreground)', fontSize: '0.88rem', marginBottom: '1.25rem' }}>
                Automatically synthesizes 10 multiple-choice questions aligned with lecture outcomes, equipped with instant automated grading and answer keys.
              </p>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontFamily: 'var(--font-display)', fontSize: '0.74rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                  Target Syllabus Unit / Topic:
                </label>
                <input
                  type="text"
                  value={quizTopic}
                  onChange={(e) => setQuizTopic(e.target.value)}
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '6px', border: '1px solid var(--color-border-strong)', boxSizing: 'border-box' }}
                />
              </div>

              <button
                className="btn btn-secondary"
                disabled={isGeneratingQuiz}
                onClick={handleGenerateQuiz}
                style={{ width: '100%', padding: '0.65rem' }}
              >
                <HelpCircle size={16} />
                <span>{isGeneratingQuiz ? 'Authoring 10 Formative Questions...' : 'Draft 10-Question Quiz'}</span>
              </button>

              {generatedQuiz && (
                <div style={{ marginTop: '1.25rem', maxHeight: '280px', overflowY: 'auto', padding: '0.85rem', backgroundColor: 'var(--color-surface-sunken)', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.82rem' }}>
                  <div style={{ fontWeight: 700, color: 'var(--color-success)' }}>
                    10 Questions Generated with Answer Keys
                  </div>
                  {generatedQuiz.map((item, idx) => (
                    <div key={idx} style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>
                      <strong>Q{idx + 1}: {item.q}</strong>
                      <div style={{ margin: '0.35rem 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.25rem' }}>
                        {item.options.map((opt, optIdx) => (
                          <span key={optIdx} style={{ color: optIdx === item.answer ? 'var(--color-success)' : 'var(--color-muted-foreground)', fontWeight: optIdx === item.answer ? 600 : 400 }}>
                            {String.fromCharCode(65 + optIdx)}. {opt} {optIdx === item.answer && ' (answer)'}
                          </span>
                        ))}
                      </div>
                      <span style={{ fontSize: '0.74rem', color: 'var(--color-accent-text)' }}>Rationale: {item.explanation}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* ====================================================================
          TOOL 3: SLIDE AND LECTURE SUMMARIZER (AVAILABLE FOR STUDENTS)
          ==================================================================== */}
      {!isTeacher && (
        <div className="academic-card" style={{ marginTop: '2rem', borderLeft: '4px solid var(--color-info)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-info)' }}>
            <FileText size={22} />
            <h3 style={{ fontSize: '1.45rem', margin: 0 }}>Slide and Lecture Summarizer</h3>
          </div>
        </div>

        <p style={{ color: 'var(--color-muted-foreground)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
          Turns a lecture deck into revision notes: key takeaways, terms and what the exam focuses on.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 360px) 1fr', gap: '2rem' }}>
          <div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontFamily: 'var(--font-display)', fontSize: '0.74rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                Course Slide Deck / Topic:
              </label>
              <select
                value={slideDeck}
                onChange={(e) => setSlideDeck(e.target.value)}
                style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '6px', border: '1px solid var(--color-border-strong)', background: 'var(--color-background)', boxSizing: 'border-box' }}
              >
                <option value="Lecture 01-04: Software Architecture & Requirements Engineering">
                  Lecture 01-04: Software Architecture & Requirements Engineering
                </option>
                <option value="Lecture 05-08: GoF Creational & Structural Patterns">
                  Lecture 05-08: GoF Creational & Structural Patterns
                </option>
                <option value="Lecture 09-12: Behavioral Patterns & State Machines">
                  Lecture 09-12: Behavioral Patterns & State Machines
                </option>
                <option value="Lecture 13-15: Database Transactions & ACID Boundaries">
                  Lecture 13-15: Database Transactions & ACID Boundaries
                </option>
              </select>
            </div>

            <button
              className="btn btn-primary"
              disabled={isGeneratingSummary}
              onClick={handleGenerateSummary}
              style={{ width: '100%', padding: '0.65rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem' }}
            >
              <BookOpen size={16} />
              <span>{isGeneratingSummary ? 'Synthesizing Lecture Summary...' : 'Generate High-Yield Summary'}</span>
            </button>
          </div>

          <div>
            {generatedSummary ? (
              <div style={{ padding: '1.25rem', backgroundColor: 'var(--color-surface-sunken)', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h4 style={{ margin: 0, fontSize: '1.1rem', fontFamily: 'var(--font-heading)' }}>
                    Study Brief: {slideDeck}
                  </h4>
                  <button
                    onClick={handleCopySummary}
                    className="btn btn-ghost btn-sm"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                  >
                    {copiedSummary ? <CheckCircle2 size={14} color="var(--color-success)" /> : <Copy size={14} />}
                    <span>{copiedSummary ? 'Copied to Clipboard' : 'Copy Notes'}</span>
                  </button>
                </div>

                <p style={{ fontSize: '0.85rem', color: 'var(--color-foreground)', lineHeight: 1.5, marginBottom: '0.85rem' }}>
                  {generatedSummary.overview}
                </p>

                <div style={{ marginBottom: '0.85rem' }}>
                  <strong style={{ fontSize: '0.82rem', fontFamily: 'var(--font-display)', color: 'var(--color-accent-text)', display: 'block', marginBottom: '0.35rem' }}>
                    High-Yield Key Takeaways
                  </strong>
                  <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.82rem', lineHeight: 1.5, color: 'var(--color-foreground)' }}>
                    {generatedSummary.keyTakeaways.map((item, idx) => (
                      <li key={idx} style={{ marginBottom: '0.25rem' }}>{item}</li>
                    ))}
                  </ul>
                </div>

                <div style={{ marginBottom: '0.85rem' }}>
                  <strong style={{ fontSize: '0.82rem', fontFamily: 'var(--font-display)', color: 'var(--color-info)', display: 'block', marginBottom: '0.35rem' }}>
                    Exam Focus & Priority Review
                  </strong>
                  <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.82rem', lineHeight: 1.5, color: 'var(--color-foreground)' }}>
                    {generatedSummary.examFocus.map((f, idx) => (
                      <li key={idx} style={{ marginBottom: '0.2rem' }}>{f}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <strong style={{ fontSize: '0.82rem', fontFamily: 'var(--font-display)', color: 'var(--color-success)', display: 'block', marginBottom: '0.35rem' }}>
                    Core Architectural Terminology
                  </strong>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.5rem', marginTop: '0.35rem' }}>
                    {generatedSummary.definitions.map((d, idx) => (
                      <div key={idx} style={{ padding: '0.5rem 0.75rem', backgroundColor: 'var(--color-background)', borderRadius: '6px', border: '1px solid var(--color-border)', fontSize: '0.78rem' }}>
                        <span style={{ fontWeight: 700, color: 'var(--color-foreground)', display: 'block' }}>{d.term}</span>
                        <span style={{ color: 'var(--color-muted-foreground)' }}>{d.definition}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ padding: '2rem', textAlign: 'center', backgroundColor: 'var(--color-surface-sunken)', borderRadius: '8px', border: '1px dashed var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                <FileText size={32} style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
                <p style={{ margin: 0, fontSize: '0.88rem' }}>
                  Select a course slide deck on the left and click <strong>Generate High-Yield Summary</strong> to extract student revision notes and exam takeaways.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
      )}

    </div>
  );
};

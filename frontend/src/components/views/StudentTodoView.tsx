import React, { useState } from 'react';
import { Calendar, CheckCircle2, FileText, UserPlus } from 'lucide-react';
import { JoinCourseModal } from '../classroom/JoinCourseModal';
import { getCourseTheme } from '../../utils/courseTheme';

type TodoFilter = 'assigned' | 'missing' | 'done';

export const StudentTodoView: React.FC = () => {
  const [isJoinOpen, setIsJoinOpen] = useState(false);
  const [filter, setFilter] = useState<TodoFilter>('assigned');
  const tasks = [
    {
      id: 1,
      courseCode: 'CSE-3102',
      course: 'Software Design',
      title: 'Software Requirements Specification (SRS) & Use Case Model',
      deadline: 'Oct 25, 11:59 PM',
      points: '100 points',
      status: 'assigned' as TodoFilter
    },
    {
      id: 2,
      courseCode: 'CSE-3101',
      course: 'Database Systems',
      title: 'Database ERD Normalization Assignment',
      deadline: 'Oct 28, 11:59 PM',
      points: '50 points',
      status: 'assigned' as TodoFilter
    },
    {
      id: 3,
      courseCode: 'CSE-3102',
      course: 'Software Design',
      title: 'Formative AI Quiz on Behavioral Design Patterns',
      deadline: 'Nov 02, 10:00 PM',
      points: '10 questions',
      status: 'assigned' as TodoFilter
    }
  ];

  const counts = {
    assigned: tasks.filter((t) => t.status === 'assigned').length,
    missing: tasks.filter((t) => t.status === 'missing').length,
    done: tasks.filter((t) => t.status === 'done').length,
  };
  const visible = tasks.filter((t) => t.status === filter);
  const emptyText: Record<TodoFilter, string> = {
    assigned: 'Nothing assigned right now.',
    missing: 'Nothing missing. Everything due so far has been handed in.',
    done: 'Work you hand in shows up here once it has been graded.',
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">To-do</h1>
          <p className="page-sub">Coursework, quizzes and lab submissions from every course you're in</p>
        </div>

        <button className="btn btn-secondary" onClick={() => setIsJoinOpen(true)}>
          <UserPlus size={16} aria-hidden="true" />
          <span>Join course</span>
        </button>
      </div>

      <div className="segmented" role="group" aria-label="Filter coursework" style={{ marginBottom: '16px' }}>
        {([
          ['assigned', 'Assigned'],
          ['missing', 'Missing'],
          ['done', 'Done'],
        ] as Array<[TodoFilter, string]>).map(([id, label]) => (
          <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)}>
            {label} <span className="num muted">{counts[id]}</span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="panel muted">{emptyText[filter]}</p>
      ) : (
        <ul className="todo-list">
          {visible.map((task) => (
            <li key={task.id} className="todo-card">
              <span className="todo-icon" aria-hidden="true">
                <FileText size={20} strokeWidth={1.75} />
              </span>

              <div className="todo-main">
                <span className="todo-course" style={{ color: getCourseTheme({ code: task.courseCode }).textAccent }}>
                  {task.courseCode}: {task.course}
                </span>
                <h2 className="todo-title">{task.title}</h2>
                <span className="todo-meta">
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <Calendar size={14} aria-hidden="true" />
                    Due {task.deadline}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{task.points}</span>
                </span>
              </div>

              <button
                className="btn btn-secondary"
                onClick={() => alert(`Opening submission workspace for ${task.title}`)}
              >
                <CheckCircle2 size={16} aria-hidden="true" />
                <span>Submit work</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <JoinCourseModal
        isOpen={isJoinOpen}
        onClose={() => setIsJoinOpen(false)}
        onJoined={(course) => alert(`Successfully enrolled in ${course.code}: ${course.title}!`)}
      />
    </div>
  );
};

import React, { useState } from 'react';
import { Send } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { SecurityBouncerProxy } from '../../patterns/proxy';

// Sample reschedule poll; the share is computed from the votes.
const POLL = { proposal: 'Move the CSE-3102 lab to Thursday, 2:00 PM', yes: 48, no: 4 };

export const CRDeskView: React.FC = () => {
  const { session, setViolation } = useAuth();
  const [broadcastMsg, setBroadcastMsg] = useState(
    'Urgent Reminder to Batch 3-1: Only 48 hours left to submit the Software Requirements Specification (SRS) & Use Case Model on ClassOverflow.'
  );
  const [toast, setToast] = useState<string | null>(null);

  const handleBroadcast = () => {
    // Pattern 3: Proxy Check
    const check = SecurityBouncerProxy.inspectAction('broadcast_deadline', session);
    if (!check.allowed) {
      setViolation(check);
      return;
    }

    setToast('Sent to the course Discord channel and the Messenger group.');
    setTimeout(() => setToast(null), 4000);
  };

  const votes = POLL.yes + POLL.no;
  const yesShare = votes > 0 ? (POLL.yes / votes) * 100 : 0;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">CR desk</h1>
          <p className="page-sub">
            {session?.name || 'Class representative'}{session?.roll ? `, roll ${session.roll}` : ''} · deadline broadcasts and schedule requests
          </p>
        </div>
      </div>

      <div className="split split-3-2">

        {/* Urgent Broadcast Dispatch */}
        <section className="panel" aria-labelledby="broadcast-title">
          <h2 id="broadcast-title" className="panel-title" style={{ marginBottom: '4px' }}>Deadline broadcast</h2>
          <p className="panel-desc" style={{ marginTop: 0 }}>
            Sends a reminder to the course's Discord channel and the class Messenger group at once.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <label className="field">
              <span className="field-label">Course</span>
              <select className="select" name="broadcast-course">
                <option>CSE-3102: Software Design & Development</option>
                <option>CSE-3101: Database Management Systems</option>
              </select>
            </label>

            <label className="field">
              <span className="field-label">Message</span>
              <textarea
                className="textarea"
                name="broadcast-message"
                value={broadcastMsg}
                onChange={(e) => setBroadcastMsg(e.target.value)}
                rows={4}
              />
            </label>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={handleBroadcast}>
                <Send size={15} aria-hidden="true" />
                <span>Send broadcast</span>
              </button>
              <span aria-live="polite" className="muted" style={{ fontSize: '0.85rem' }}>{toast}</span>
            </div>
          </div>
        </section>

        {/* Schedule Reschedule Coordination */}
        <section className="panel" aria-labelledby="poll-title" style={{ display: 'flex', flexDirection: 'column' }}>
          <h2 id="poll-title" className="panel-title" style={{ marginBottom: '4px' }}>Reschedule poll</h2>
          <p className="panel-desc" style={{ marginTop: 0 }}>
            Makeup classes and slot changes the class has voted on.
          </p>

          <div style={{ padding: '14px 16px', backgroundColor: 'var(--color-surface-sunken)', borderRadius: 'var(--radius-control)' }}>
            <span className="row-title">{POLL.proposal}</span>
            <div className="bar" style={{ marginTop: '12px', backgroundColor: '#dcdcda' }} role="img" aria-label={`${POLL.yes} yes, ${POLL.no} no`}>
              <div className="bar-fill" style={{ width: `${yesShare}%`, backgroundColor: 'var(--text)' }} />
            </div>
            <div className="bar-ends num">
              <span>{POLL.yes} yes</span>
              <span>{POLL.no} no</span>
            </div>
            <p className="row-meta" style={{ marginTop: '8px' }}>Quorum reached · {votes} votes</p>
          </div>
          <div style={{ minHeight: '16px', flex: 'none' }} />

          <button
            className="btn btn-secondary btn-sm"
            style={{ marginTop: 'auto', alignSelf: 'flex-start' }}
            onClick={() => alert('Schedule proposal forwarded to Course Chair Gojo Satoru')}
          >
            Send request to teacher
          </button>
        </section>

      </div>
    </div>
  );
};

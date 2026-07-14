import { useState } from 'react';
import Modal from './Modal.jsx';
import StatusBadge from './StatusBadge.jsx';
import LifecycleRail from './LifecycleRail.jsx';
import Banner from './Banner.jsx';
import { formatDate } from '../lib/constants.js';
import './TicketDetailModal.css';

export default function TicketDetailModal({
  ticket,
  onClose,
  canSeeComments = false,
  onAddComment,
  actions = [],
}) {
  const [commentText, setCommentText] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');

  async function submitComment(e) {
    e.preventDefault();
    if (!commentText.trim() || !onAddComment) return;
    setPosting(true);
    setError('');
    try {
      await onAddComment(commentText.trim());
      setCommentText('');
    } catch (err) {
      setError(err.message || 'Could not add comment');
    } finally {
      setPosting(false);
    }
  }

  return (
    <Modal title={`Ticket ${ticket.id}`} onClose={onClose} width={640}>
      <div className="td-head">
        <h2 className="td-title">{ticket.title}</h2>
        <StatusBadge status={ticket.status} />
      </div>

      <LifecycleRail status={ticket.status} />

      {ticket.status === 'denied' && ticket.triageNote && (
        <Banner kind="error">{ticket.triageNote}</Banner>
      )}

      <div className="td-grid">
        <div>
          <span className="td-label">Requester</span>
          <span className="td-value">{ticket.name || ticket.createdBy}</span>
        </div>
        <div>
          <span className="td-label">Department</span>
          <span className="td-value">{ticket.department}</span>
        </div>
        <div>
          <span className="td-label">Priority</span>
          <span className="td-value">{ticket.priority}</span>
        </div>
        <div>
          <span className="td-label">Topic</span>
          <span className="td-value">{ticket.topic || '—'}</span>
        </div>
        <div>
          <span className="td-label">Assigned to</span>
          <span className="td-value">{ticket.assignedTo || 'Unassigned'}</span>
        </div>
        <div>
          <span className="td-label">Submitted</span>
          <span className="td-value">{formatDate(ticket.createdAt)}</span>
        </div>
      </div>

      <div className="td-section">
        <span className="td-label">Description</span>
        <p className="td-description">{ticket.description || 'No description provided.'}</p>
      </div>

      {actions.length > 0 && (
        <div className="td-actions">
          {actions.map((a, i) => (
            <button
              key={i}
              className={`btn ${a.variant === 'danger' ? 'btn-danger' : a.variant === 'ghost' ? 'btn-ghost' : 'btn-primary'}`}
              onClick={a.onClick}
              disabled={a.disabled}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}

      <div className="td-section">
        <span className="td-label">History</span>
        <ul className="td-history">
          {(ticket.history || [])
            .slice()
            .reverse()
            .map((h, i) => (
              <li key={i}>
                <span className="td-history-dot" />
                <div>
                  <div className="td-history-line">
                    <strong>{h.by}</strong> ({h.role}) — {h.action.replace('_', ' ')}
                  </div>
                  {h.detail && <div className="td-history-detail">{h.detail}</div>}
                  <div className="td-history-time">{formatDate(h.at)}</div>
                </div>
              </li>
            ))}
        </ul>
      </div>

      {canSeeComments && (
        <div className="td-section">
          <span className="td-label">Internal comments</span>
          <p className="td-hint">Visible to Agents and Admins only — never to the requester.</p>
          <ul className="td-comments">
            {(ticket.comments || []).length === 0 && <li className="td-hint">No comments yet.</li>}
            {(ticket.comments || []).map((c) => (
              <li key={c.id} className="td-comment">
                <div className="td-comment-head">
                  <strong>{c.by}</strong>
                  <span className="td-history-time">{formatDate(c.at)}</span>
                </div>
                <div>{c.text}</div>
              </li>
            ))}
          </ul>
          {onAddComment && (
            <form className="td-comment-form" onSubmit={submitComment}>
              <textarea
                placeholder="Add an internal note…"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                rows={2}
              />
              <button className="btn btn-primary btn-sm" type="submit" disabled={posting || !commentText.trim()}>
                {posting ? 'Posting…' : 'Post comment'}
              </button>
            </form>
          )}
          {error && <Banner kind="error">{error}</Banner>}
        </div>
      )}
    </Modal>
  );
}

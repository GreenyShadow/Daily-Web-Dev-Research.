import StatusBadge from './StatusBadge.jsx';
import { formatDate } from '../lib/constants.js';
import './TicketList.css';

export default function TicketList({ tickets, onSelect, emptyLabel = 'No tickets here.', showRequester = false }) {
  if (!tickets.length) {
    return <div className="ticket-empty">{emptyLabel}</div>;
  }

  return (
    <div className="ticket-list">
      {tickets.map((tk) => (
        <button className="ticket-row" key={tk.id} onClick={() => onSelect(tk)}>
          <div className="ticket-row-main">
            <div className="ticket-row-title">{tk.title}</div>
            <div className="ticket-row-meta">
              <span className="mono">{tk.id}</span>
              <span>·</span>
              <span>{tk.department}</span>
              {tk.topic && (
                <>
                  <span>·</span>
                  <span>{tk.topic}</span>
                </>
              )}
              {showRequester && (
                <>
                  <span>·</span>
                  <span>from {tk.name || tk.createdBy}</span>
                </>
              )}
            </div>
          </div>
          <div className="ticket-row-side">
            <span className={`priority-chip priority-${(tk.priority || '').toLowerCase()}`}>{tk.priority}</span>
            {tk.assignedTo && <span className="ticket-row-assignee">→ {tk.assignedTo}</span>}
            <StatusBadge status={tk.status} />
            <span className="ticket-row-date">{formatDate(tk.createdAt)}</span>
          </div>
        </button>
      ))}
    </div>
  );
}

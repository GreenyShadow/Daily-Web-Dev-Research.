import { STATUS_META } from '../lib/constants.js';

export default function StatusBadge({ status }) {
  const meta = STATUS_META[status] || { label: status || 'Unknown', fg: 'var(--ink-soft)', bg: 'var(--line-soft)' };
  return (
    <span className="badge" style={{ color: meta.fg, background: meta.bg }}>
      {meta.label}
    </span>
  );
}

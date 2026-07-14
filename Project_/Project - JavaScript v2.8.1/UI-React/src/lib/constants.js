export const DEPARTMENTS = ['Design', 'UI', 'Security'];
export const PRIORITIES = ['Low', 'Mid', 'High', 'Urgent'];

export const SUPPORT_STAGE_STATUSES = ['accepted', 'in_progress', 'resolved', 'closed'];

export const STATUS_META = {
  pending: { label: 'Pending', fg: 'var(--st-pending-fg)', bg: 'var(--st-pending-bg)' },
  accepted: { label: 'Accepted', fg: 'var(--st-accepted-fg)', bg: 'var(--st-accepted-bg)' },
  in_progress: { label: 'In Progress', fg: 'var(--st-progress-fg)', bg: 'var(--st-progress-bg)' },
  resolved: { label: 'Resolved', fg: 'var(--st-resolved-fg)', bg: 'var(--st-resolved-bg)' },
  closed: { label: 'Closed', fg: 'var(--st-closed-fg)', bg: 'var(--st-closed-bg)' },
  denied: { label: 'Denied', fg: 'var(--st-denied-fg)', bg: 'var(--st-denied-bg)' },
};

export const LIFECYCLE_STEPS = ['pending', 'accepted', 'in_progress', 'resolved', 'closed'];

// ── Auto-Triage rules (mirrors the prototype's client-side rule engine) ────
const SPAM_KEYWORDS = [
  'test', 'testing', 'asdf', 'qwerty', 'lorem ipsum', 'sample',
  'placeholder', 'n/a', 'xxx', '1234', 'foo bar',
];

const REPUTATION_KEYWORDS = [
  'fuck', 'shit', 'bitch', 'asshole', 'bastard', 'idiot', 'moron',
  'scam', 'fraud', 'sue you', 'lawsuit', 'terrible company',
  'worst company', 'hate this company', 'going to the press',
  'report you', 'expose you',
];

function containsWord(haystack, phrase) {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`\\b${escaped}\\b`, 'i');
  return re.test(haystack);
}

// Returns a human-readable denial reason, or null if the ticket should be
// left alone for manual review.
export function autoTriageDecision(ticket) {
  const title = (ticket.title || '').trim();
  const description = (ticket.description || '').trim();
  const department = (ticket.department || '').trim();
  const combined = `${title} ${description}`;

  if (title.length < 3 || description.length < 5) {
    return 'Title or description is empty/too short to act on';
  }
  if (!DEPARTMENTS.includes(department)) {
    return `Department "${department || '(blank)'}" isn't a recognized team`;
  }
  for (const kw of SPAM_KEYWORDS) {
    if (containsWord(combined, kw)) return `Looks like placeholder/spam content ("${kw}")`;
  }
  for (const kw of REPUTATION_KEYWORDS) {
    if (containsWord(combined, kw)) return 'Contains inappropriate or reputation-damaging language';
  }
  return null;
}

// Demo-scale "expired" window (1 minute) so the expired state is visible
// during a live demo without waiting real days — matches the prototype.
export function isExpired(ticket) {
  try {
    const created = new Date(ticket.createdAt).getTime();
    return Date.now() - created > 60_000;
  } catch {
    return false;
  }
}

export function isUnprocessed(ticket) {
  return !ticket.status || ticket.status === 'pending';
}

export function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

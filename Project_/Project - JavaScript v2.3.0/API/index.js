const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const dataFile = path.join(__dirname, 'tickets.json');
const usersFile = path.join(__dirname, 'users.json');
const PORT = process.env.PORT || 3000;

// In-memory session store: token -> { username, role, createdAt }
// Debug-grade: resets on server restart, no persistence, no expiry sweep.
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const sessions = new Map();

function issueToken(user) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { username: user.username, role: user.role, createdAt: Date.now() });
  return token;
}

function getSession(token) {
  const session = sessions.get(token);
  if (!session) return null;
  if (Date.now() - session.createdAt > SESSION_TTL_MS) {
    sessions.delete(token);
    return null;
  }
  return session;
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }

  const session = getSession(token);
  if (!session) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }

  req.user = session;
  next();
}

// Restricts a route to a set of roles, e.g. requireRole('admin', 'agent')
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Not allowed for this role' });
    }
    next();
  };
}

app.use(cors());
app.use(express.json());

async function loadTickets() {
  try {
    const raw = await fs.readFile(dataFile, 'utf8');
    return JSON.parse(raw || '[]');
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

async function saveTickets(tickets) {
  await fs.writeFile(dataFile, JSON.stringify(tickets, null, 2), 'utf8');
}

async function loadUsers() {
  try {
    const raw = await fs.readFile(usersFile, 'utf8');
    return JSON.parse(raw || '[]');
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

function generateId(length = 10) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < length; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

// ── Ticket lifecycle ─────────────────────────────────────────────────────────
// pending -> accepted (admin) -> in_progress (agent claims) -> resolved -> closed
//         -> denied   (admin)
// "accepted" doubles as "in the support queue, unclaimed". Agents only ever
// see tickets that have made it past admin triage.
const SUPPORT_STAGE_STATUSES = ['accepted', 'in_progress', 'resolved', 'closed'];

function pushHistory(ticket, actor, action, detail) {
  if (!Array.isArray(ticket.history)) ticket.history = [];
  ticket.history.push({
    at: new Date().toISOString(),
    by: actor.username,
    role: actor.role,
    action,
    detail: detail || '',
  });
}

function normalizeTicket(ticket) {
  // Backfills fields on tickets created before assignment/comments/history existed.
  if (!Array.isArray(ticket.history)) ticket.history = [];
  if (!Array.isArray(ticket.comments)) ticket.comments = [];
  if (ticket.assignedTo === undefined) ticket.assignedTo = null;
  return ticket;
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Ticket API is running' });
});

// ── Auth (debug-grade: plaintext users.json, no password hashing) ──────────
// Registration has no function in this demo — only the seeded accounts
// (Admin/Demo, Member/Demo, Agent/Demo, Priya/Demo) can log in. Successful
// login issues an in-memory bearer token (see `sessions` above) required by
// all /tickets routes.
app.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Missing username or password' });
  }

  const users = await loadUsers();
  const match = users.find((u) => u.username === username && u.password === password);
  if (!match) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const token = issueToken(match);
  res.json({ token, username: match.username, role: match.role });
});

app.post('/logout', requireAuth, (req, res) => {
  const header = req.headers.authorization || '';
  const [, token] = header.split(' ');
  sessions.delete(token);
  res.status(204).end();
});

// List of support-staff usernames, so agents/admins can populate an
// assign/reassign picker without exposing the full users file.
app.get('/agents', requireAuth, requireRole('admin', 'agent'), async (req, res) => {
  const users = await loadUsers();
  res.json(users.filter((u) => u.role === 'agent').map((u) => ({ username: u.username })));
});

app.get('/tickets', requireAuth, async (req, res) => {
  const tickets = (await loadTickets()).map(normalizeTicket);

  if (req.user.role === 'admin') {
    return res.json(tickets);
  }

  if (req.user.role === 'agent') {
    // Agents only work tickets that have cleared admin triage: the open
    // queue (unassigned + accepted) plus anything assigned to any agent,
    // so the team can see each other's in-progress/resolved work too.
    const visible = tickets.filter((tk) => SUPPORT_STAGE_STATUSES.includes(tk.status));
    return res.json(visible);
  }

  const own = tickets.filter((item) => item.createdBy === req.user.username);
  res.json(own);
});

app.get('/tickets/:id', requireAuth, async (req, res) => {
  const tickets = (await loadTickets()).map(normalizeTicket);
  const ticket = tickets.find((item) => item.id === req.params.id);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

  if (req.user.role === 'agent' && !SUPPORT_STAGE_STATUSES.includes(ticket.status)) {
    return res.status(403).json({ error: 'Not allowed to view this ticket' });
  }
  if (req.user.role === 'member' && ticket.createdBy !== req.user.username) {
    return res.status(403).json({ error: 'Not allowed to view this ticket' });
  }
  res.json(ticket);
});

app.post('/tickets', requireAuth, async (req, res) => {
  const { name, department, priority, topic, title, description } = req.body;
  if (!name || !department || !priority || !title) {
    return res.status(400).json({ error: 'Missing required fields: name, department, priority, title' });
  }

  const tickets = await loadTickets();
  const ticket = {
    id: generateId(12),
    name: String(name).trim(),
    department: String(department).trim(),
    priority: String(priority).trim(),
    topic: String(topic || '').trim(),
    title: String(title).trim(),
    description: String(description || '').trim(),
    createdAt: new Date().toISOString(),
    createdBy: req.user.username,
    status: 'pending',
    assignedTo: null,
    comments: [],
    history: [{ at: new Date().toISOString(), by: req.user.username, role: req.user.role, action: 'created', detail: 'Ticket submitted' }],
  };

  tickets.push(ticket);
  await saveTickets(tickets);
  res.status(201).json(ticket);
});

app.patch('/tickets/:id', requireAuth, async (req, res) => {
  const updates = req.body;
  const tickets = await loadTickets();
  const index = tickets.findIndex((item) => item.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Ticket not found' });

  const ticket = normalizeTicket(tickets[index]);

  if (req.user.role === 'member' && ticket.createdBy !== req.user.username) {
    return res.status(403).json({ error: 'Not allowed to modify this ticket' });
  }
  if (req.user.role === 'agent') {
    if (!SUPPORT_STAGE_STATUSES.includes(ticket.status)) {
      return res.status(403).json({ error: 'Ticket has not cleared admin review yet' });
    }
    // Agents may only change status/assignment fields — not the original request.
    const agentAllowed = ['status', 'assignedTo', 'triageNote'];
    const disallowed = Object.keys(updates).some((key) => !agentAllowed.includes(key));
    if (disallowed) {
      return res.status(403).json({ error: 'Agents can only update status and assignment' });
    }
  }

  const allowed = ['status', 'priority', 'topic', 'title', 'description', 'department', 'name', 'triageNote', 'assignedTo'];
  const prevStatus = ticket.status;
  const prevAssignee = ticket.assignedTo;

  for (const key of Object.keys(updates)) {
    if (allowed.includes(key)) {
      ticket[key] = updates[key];
    }
  }

  if (ticket.status !== prevStatus) {
    pushHistory(ticket, req.user, 'status_change', `${prevStatus || '(none)'} → ${ticket.status || '(none)'}`);
  }
  if (ticket.assignedTo !== prevAssignee) {
    const detail = ticket.assignedTo ? `assigned to ${ticket.assignedTo}` : 'unassigned';
    pushHistory(ticket, req.user, 'assignment_change', detail);
  }

  tickets[index] = ticket;
  await saveTickets(tickets);
  res.json(ticket);
});

// Agent claims an unassigned, admin-approved ticket and starts work on it.
app.post('/tickets/:id/claim', requireAuth, requireRole('agent'), async (req, res) => {
  const tickets = await loadTickets();
  const index = tickets.findIndex((item) => item.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Ticket not found' });

  const ticket = normalizeTicket(tickets[index]);
  if (ticket.status !== 'accepted') {
    return res.status(409).json({ error: 'Only tickets waiting in the queue can be claimed' });
  }
  if (ticket.assignedTo) {
    return res.status(409).json({ error: `Already claimed by ${ticket.assignedTo}` });
  }

  ticket.assignedTo = req.user.username;
  ticket.status = 'in_progress';
  pushHistory(ticket, req.user, 'claimed', `Claimed by ${req.user.username}`);

  tickets[index] = ticket;
  await saveTickets(tickets);
  res.json(ticket);
});

// Agent hands a ticket back to the unassigned queue.
app.post('/tickets/:id/release', requireAuth, requireRole('agent'), async (req, res) => {
  const tickets = await loadTickets();
  const index = tickets.findIndex((item) => item.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Ticket not found' });

  const ticket = normalizeTicket(tickets[index]);
  if (ticket.assignedTo !== req.user.username) {
    return res.status(403).json({ error: 'Only the assigned agent can release this ticket' });
  }

  ticket.assignedTo = null;
  ticket.status = 'accepted';
  pushHistory(ticket, req.user, 'released', 'Released back to the queue');

  tickets[index] = ticket;
  await saveTickets(tickets);
  res.json(ticket);
});

// Reassign a claimed ticket to a teammate (admin, or the currently assigned agent).
app.post('/tickets/:id/reassign', requireAuth, requireRole('admin', 'agent'), async (req, res) => {
  const { to } = req.body || {};
  if (!to) return res.status(400).json({ error: 'Missing target agent username' });

  const tickets = await loadTickets();
  const index = tickets.findIndex((item) => item.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Ticket not found' });

  const ticket = normalizeTicket(tickets[index]);
  if (req.user.role === 'agent' && ticket.assignedTo !== req.user.username) {
    return res.status(403).json({ error: 'Only the assigned agent (or an admin) can reassign this ticket' });
  }

  const users = await loadUsers();
  const targetIsAgent = users.some((u) => u.username === to && u.role === 'agent');
  if (!targetIsAgent) return res.status(400).json({ error: `"${to}" is not a support agent` });

  const prevAssignee = ticket.assignedTo;
  ticket.assignedTo = to;
  if (ticket.status === 'accepted') ticket.status = 'in_progress';
  pushHistory(ticket, req.user, 'reassigned', `${prevAssignee || 'unassigned'} → ${to}`);

  tickets[index] = ticket;
  await saveTickets(tickets);
  res.json(ticket);
});

// Internal discussion thread on a ticket (admin + agents only — not the requester).
app.post('/tickets/:id/comments', requireAuth, requireRole('admin', 'agent'), async (req, res) => {
  const { text } = req.body || {};
  if (!text || !String(text).trim()) {
    return res.status(400).json({ error: 'Comment text is required' });
  }

  const tickets = await loadTickets();
  const index = tickets.findIndex((item) => item.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Ticket not found' });

  const ticket = normalizeTicket(tickets[index]);
  if (req.user.role === 'agent' && !SUPPORT_STAGE_STATUSES.includes(ticket.status)) {
    return res.status(403).json({ error: 'Ticket has not cleared admin review yet' });
  }

  const comment = {
    id: generateId(8),
    by: req.user.username,
    role: req.user.role,
    at: new Date().toISOString(),
    text: String(text).trim(),
  };
  ticket.comments.push(comment);
  pushHistory(ticket, req.user, 'comment', 'Added a note');

  tickets[index] = ticket;
  await saveTickets(tickets);
  res.status(201).json(ticket);
});

app.delete('/tickets/:id', requireAuth, async (req, res) => {
  const tickets = await loadTickets();
  const ticket = tickets.find((item) => item.id === req.params.id);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
  if (req.user.role !== 'admin' && ticket.createdBy !== req.user.username) {
    return res.status(403).json({ error: 'Not allowed to delete this ticket' });
  }

  const filtered = tickets.filter((item) => item.id !== req.params.id);
  await saveTickets(filtered);
  res.status(204).end();
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Ticket API listening at http://localhost:${PORT}`);
});

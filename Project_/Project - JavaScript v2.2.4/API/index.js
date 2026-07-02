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

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Ticket API is running' });
});

// ── Auth (debug-grade: plaintext users.json, no password hashing) ──────────
// Registration has no function in this demo — only the two seeded accounts
// (Admin/Demo, Member/Demo) can log in. Successful login issues an in-memory
// bearer token (see `sessions` above) required by all /tickets routes.
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

app.get('/tickets', requireAuth, async (req, res) => {
  const tickets = await loadTickets();
  if (req.user.role === 'admin') {
    return res.json(tickets);
  }
  const own = tickets.filter((item) => item.createdBy === req.user.username);
  res.json(own);
});

app.get('/tickets/:id', requireAuth, async (req, res) => {
  const tickets = await loadTickets();
  const ticket = tickets.find((item) => item.id === req.params.id);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
  if (req.user.role !== 'admin' && ticket.createdBy !== req.user.username) {
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

  const ticket = tickets[index];
  if (req.user.role !== 'admin' && ticket.createdBy !== req.user.username) {
    return res.status(403).json({ error: 'Not allowed to modify this ticket' });
  }

  const allowed = ['status', 'priority', 'topic', 'title', 'description', 'department', 'name'];
  for (const key of Object.keys(updates)) {
    if (allowed.includes(key)) {
      ticket[key] = updates[key];
    }
  }

  tickets[index] = ticket;
  await saveTickets(tickets);
  res.json(ticket);
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
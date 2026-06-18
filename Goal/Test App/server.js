const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const db = require('./db');

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.use(express.static(path.join(__dirname, 'public')));

// List requirements
app.get('/api/requirements', (req, res) => {
  db.all('SELECT * FROM requirements ORDER BY created_at DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Get single requirement
app.get('/api/requirements/:id', (req, res) => {
  const id = req.params.id;
  db.get('SELECT * FROM requirements WHERE id = ?', [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  });
});

// Create requirement
app.post('/api/requirements', (req, res) => {
  const { title, description, assignee } = req.body;
  const q = 'INSERT INTO requirements (title, description, assignee) VALUES (?, ?, ?)';
  db.run(q, [title, description || '', assignee || ''], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    const id = this.lastID;
    db.get('SELECT * FROM requirements WHERE id = ?', [id], (err2, row) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.status(201).json(row);
    });
  });
});

// Update requirement
app.put('/api/requirements/:id', (req, res) => {
  const id = req.params.id;
  const { title, description, status, assignee } = req.body;
  const q = `UPDATE requirements SET title = ?, description = ?, status = ?, assignee = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
  db.run(q, [title, description || '', status || 'Open', assignee || '', id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    db.get('SELECT * FROM requirements WHERE id = ?', [id], (err2, row) => {
      if (err2) return res.status(500).json({ error: err2.message });
      if (!row) return res.status(404).json({ error: 'Not found' });
      res.json(row);
    });
  });
});

// Delete requirement
app.delete('/api/requirements/:id', (req, res) => {
  const id = req.params.id;
  db.run('DELETE FROM requirements WHERE id = ?', [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ deleted: this.changes });
  });
});

// Comments
app.get('/api/requirements/:id/comments', (req, res) => {
  const id = req.params.id;
  db.all('SELECT * FROM comments WHERE requirement_id = ? ORDER BY created_at', [id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/requirements/:id/comments', (req, res) => {
  const id = req.params.id;
  const { author, body } = req.body;
  db.run('INSERT INTO comments (requirement_id, author, body) VALUES (?, ?, ?)', [id, author || 'anonymous', body || ''], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    const cid = this.lastID;
    db.get('SELECT * FROM comments WHERE id = ?', [cid], (err2, row) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.status(201).json(row);
    });
  });
});

// Fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));

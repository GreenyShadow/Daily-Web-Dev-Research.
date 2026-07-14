import { useEffect, useMemo, useState, useCallback } from 'react';
import Shell from '../../components/Shell.jsx';
import { PageHeader, StatCard, StatRow } from '../../components/PageHeader.jsx';
import TicketList from '../../components/TicketList.jsx';
import TicketDetailModal from '../../components/TicketDetailModal.jsx';
import Banner from '../../components/Banner.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useAuthedApi } from '../../hooks/useAuthedApi.js';
import { DEPARTMENTS, PRIORITIES, isExpired, isUnprocessed } from '../../lib/constants.js';

const TABS = [
  { id: 'submit', label: 'Submit a request', icon: '＋' },
  { id: 'tickets', label: 'My tickets', icon: '☰' },
];

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Awaiting review' },
  { id: 'accepted', label: 'In support' },
  { id: 'denied', label: 'Denied' },
  { id: 'expired', label: 'Expired' },
];

const emptyForm = { department: DEPARTMENTS[0], priority: 'Low', topic: '', title: '', description: '' };

export default function MemberPage() {
  const { session } = useAuth();
  const api = useAuthedApi();

  const [tab, setTab] = useState('submit');
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const data = await api.listTickets();
      setTickets(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const counts = useMemo(() => {
    const total = tickets.length;
    const pending = tickets.filter((t) => isUnprocessed(t)).length;
    const accepted = tickets.filter((t) => ['accepted', 'in_progress', 'resolved', 'closed'].includes(t.status)).length;
    const denied = tickets.filter((t) => t.status === 'denied').length;
    const expired = tickets.filter((t) => isExpired(t) && isUnprocessed(t)).length;
    return { total, pending, accepted, denied, expired };
  }, [tickets]);

  const filtered = useMemo(() => {
    let list = tickets;
    if (filter === 'pending') list = list.filter((t) => isUnprocessed(t) && !isExpired(t));
    else if (filter === 'accepted') list = list.filter((t) => ['accepted', 'in_progress', 'resolved', 'closed'].includes(t.status));
    else if (filter === 'denied') list = list.filter((t) => t.status === 'denied');
    else if (filter === 'expired') list = list.filter((t) => isExpired(t) && isUnprocessed(t));

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (t) => t.title.toLowerCase().includes(q) || (t.topic || '').toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q)
      );
    }
    return list.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [tickets, filter, search]);

  async function handleCreate(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      await api.createTicket({ ...form, name: session.username });
      setForm(emptyForm);
      setSuccess('Request submitted — it’s waiting for admin review.');
      await refresh();
      setTab('tickets');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function openTicket(tk) {
    setSelected(tk);
    setEditing(false);
    setEditForm({ title: tk.title, description: tk.description, department: tk.department, priority: tk.priority, topic: tk.topic });
  }

  async function handleSaveEdit() {
    try {
      const updated = await api.updateTicket(selected.id, editForm);
      setSelected(updated);
      setEditing(false);
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleCancel() {
    if (!confirm('Cancel this request? This cannot be undone.')) return;
    try {
      await api.deleteTicket(selected.id);
      setSelected(null);
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  const canEditSelected = selected && isUnprocessed(selected);

  return (
    <Shell tabs={TABS} activeTab={tab} onTabChange={setTab}>
      {error && <Banner kind="error" onDismiss={() => setError('')}>{error}</Banner>}
      {success && <Banner kind="success" onDismiss={() => setSuccess('')}>{success}</Banner>}

      {tab === 'submit' && (
        <>
          <PageHeader title="Submit a request" subtitle="Tell the support team what you need help with." />
          <form className="card" style={{ padding: 24, maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 16 }} onSubmit={handleCreate}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="field">
                <label>Department</label>
                <select value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>
                  {DEPARTMENTS.map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Priority</label>
                <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                  {PRIORITIES.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="field">
              <label>Topic (optional)</label>
              <input value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} placeholder="e.g. Login issue, Account access" />
            </div>
            <div className="field">
              <label>Title</label>
              <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Short summary of the request" />
            </div>
            <div className="field">
              <label>Description (optional)</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Add any details that will help the support team" />
            </div>
            <button className="btn btn-primary" type="submit" disabled={submitting} style={{ alignSelf: 'flex-start' }}>
              {submitting ? 'Sending…' : 'Send ticket'}
            </button>
          </form>
        </>
      )}

      {tab === 'tickets' && (
        <>
          <PageHeader title="My tickets" subtitle="Everything you've submitted, and its current status." />
          <StatRow>
            <StatCard label="Total" value={counts.total} />
            <StatCard label="Awaiting review" value={counts.pending} tone="var(--st-pending-fg)" />
            <StatCard label="In support" value={counts.accepted} tone="var(--st-accepted-fg)" />
            <StatCard label="Denied" value={counts.denied} tone="var(--st-denied-fg)" />
            <StatCard label="Expired" value={counts.expired} tone="var(--ink-soft)" />
          </StatRow>

          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            {FILTERS.map((f) => (
              <button
                key={f.id}
                className={`btn btn-sm ${filter === f.id ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
            <input
              placeholder="Search by title, topic, or description…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ marginLeft: 'auto', border: '1px solid var(--line)', borderRadius: 6, padding: '7px 10px', fontSize: 13, minWidth: 220 }}
            />
          </div>

          {loading ? (
            <div className="ticket-empty">Loading…</div>
          ) : (
            <TicketList tickets={filtered} onSelect={openTicket} emptyLabel="No tickets match this view." />
          )}
        </>
      )}

      {selected && (
        <TicketDetailModal
          ticket={selected}
          onClose={() => setSelected(null)}
          actions={
            canEditSelected
              ? [
                  { label: editing ? 'Cancel editing' : 'Edit request', onClick: () => setEditing((v) => !v), variant: 'ghost' },
                  { label: 'Cancel request', onClick: handleCancel, variant: 'danger' },
                ]
              : []
          }
        />
      )}

      {selected && editing && editForm && (
        <div className="modal-backdrop" style={{ zIndex: 110 }} onMouseDown={(e) => e.target === e.currentTarget && setEditing(false)}>
          <div className="modal-panel" style={{ maxWidth: 480 }}>
            <div className="modal-head">
              <h3>Edit request</h3>
              <button className="modal-close" onClick={() => setEditing(false)}>×</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="field">
                <label>Title</label>
                <input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
              </div>
              <div className="field">
                <label>Description</label>
                <textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="field">
                  <label>Department</label>
                  <select value={editForm.department} onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}>
                    {DEPARTMENTS.map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Priority</label>
                  <select value={editForm.priority} onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}>
                    {PRIORITIES.map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button className="btn btn-primary" onClick={handleSaveEdit}>Save changes</button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}

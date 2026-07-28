import { useEffect, useMemo, useState, useCallback } from 'react';
import Shell from '../../components/Shell.jsx';
import { PageHeader, StatCard, StatRow } from '../../components/PageHeader.jsx';
import TicketList from '../../components/TicketList.jsx';
import TicketDetailModal from '../../components/TicketDetailModal.jsx';
import Banner from '../../components/Banner.jsx';
import SortSelect from '../../components/SortSelect.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useAuthedApi } from '../../hooks/useAuthedApi.js';
import { sortByCreatedAt } from '../../lib/constants.js';

const TABS = [
  { id: 'queue', label: 'Queue', icon: '▤' },
  { id: 'mywork', label: 'My work', icon: '★' },
  { id: 'overview', label: 'Overview', icon: '◔' },
];

export default function AgentPage() {
  const { session } = useAuth();
  const api = useAuthedApi();

  const [tab, setTab] = useState('queue');
  const [tickets, setTickets] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [queueSort, setQueueSort] = useState('newest');
  const [mySort, setMySort] = useState('newest');
  const [reassignTarget, setReassignTarget] = useState('');
  const [reassigning, setReassigning] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [tk, ag] = await Promise.all([api.listTickets(), api.listAgents()]);
      setTickets(tk);
      setAgents(ag);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const queue = useMemo(
    () => sortByCreatedAt(tickets.filter((t) => t.status === 'accepted' && !t.assignedTo), queueSort),
    [tickets, queueSort]
  );
  const mine = useMemo(
    () => sortByCreatedAt(tickets.filter((t) => t.assignedTo === session.username), mySort),
    [tickets, session.username, mySort]
  );

  const applySearch = useCallback(
    (list) => {
      if (!search.trim()) return list;
      const q = search.trim().toLowerCase();
      return list.filter((t) => t.title.toLowerCase().includes(q) || (t.topic || '').toLowerCase().includes(q));
    },
    [search]
  );

  const overviewCounts = useMemo(() => {
    const inProgress = mine.filter((t) => t.status === 'in_progress').length;
    const resolved = mine.filter((t) => t.status === 'resolved').length;
    const closed = mine.filter((t) => t.status === 'closed').length;
    return { queueSize: queue.length, mine: mine.length, inProgress, resolved, closed };
  }, [queue, mine]);

  function selectFresh(id) {
    const fresh = tickets.find((t) => t.id === id);
    setSelected(fresh || null);
  }

  async function refreshAndReselect(id) {
    await refresh();
    if (id) selectFresh(id);
  }

  async function handleClaim(id) {
    try {
      await api.claimTicket(id);
      await refresh();
      setSelected(null);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRelease(id) {
    try {
      await api.releaseTicket(id);
      setSelected(null);
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleStatus(id, status) {
    try {
      await api.updateTicket(id, { status });
      await refreshAndReselect(id);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleReassign(id) {
    if (!reassignTarget) return;
    setReassigning(true);
    try {
      await api.reassignTicket(id, reassignTarget);
      setReassignTarget('');
      setSelected(null);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setReassigning(false);
    }
  }

  async function handleComment(id, text) {
    const updated = await api.addComment(id, text);
    setSelected(updated);
    await refresh();
  }

  function buildActions(ticket) {
    if (!ticket) return [];
    const actions = [];
    if (ticket.status === 'accepted' && !ticket.assignedTo) {
      actions.push({ label: 'Claim ticket', onClick: () => handleClaim(ticket.id), variant: 'primary' });
    }
    if (ticket.assignedTo === session.username) {
      if (ticket.status === 'in_progress') {
        actions.push({ label: 'Mark resolved', onClick: () => handleStatus(ticket.id, 'resolved'), variant: 'primary' });
        actions.push({ label: 'Release to queue', onClick: () => handleRelease(ticket.id), variant: 'ghost' });
      }
      if (ticket.status === 'resolved') {
        actions.push({ label: 'Close ticket', onClick: () => handleStatus(ticket.id, 'closed'), variant: 'primary' });
      }
    }
    return actions;
  }

  return (
    <Shell tabs={[...TABS.map((t) => (t.id === 'queue' ? { ...t, count: queue.length } : t.id === 'mywork' ? { ...t, count: mine.length } : t))]} activeTab={tab} onTabChange={setTab}>
      {error && <Banner kind="error" onDismiss={() => setError('')}>{error}</Banner>}

      {tab === 'queue' && (
        <>
          <PageHeader title="Support queue" subtitle="Tickets accepted by an admin, waiting to be claimed." />
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
            <input
              placeholder="Search the queue…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ border: '1px solid var(--line)', borderRadius: 6, padding: '8px 11px', fontSize: 13, width: 280 }}
            />
            <SortSelect value={queueSort} onChange={setQueueSort} />
          </div>
          {loading ? <div className="ticket-empty">Loading…</div> : <TicketList tickets={applySearch(queue)} onSelect={setSelected} emptyLabel="Queue is empty — nothing waiting to be claimed." showRequester />}
        </>
      )}

      {tab === 'mywork' && (
        <>
          <PageHeader title="My work" subtitle="Tickets currently assigned to you." />
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
            <input
              placeholder="Search your work…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ border: '1px solid var(--line)', borderRadius: 6, padding: '8px 11px', fontSize: 13, width: 280 }}
            />
            <SortSelect value={mySort} onChange={setMySort} />
          </div>
          {loading ? <div className="ticket-empty">Loading…</div> : <TicketList tickets={applySearch(mine)} onSelect={setSelected} emptyLabel="Nothing assigned to you right now." showRequester />}
        </>
      )}

      {tab === 'overview' && (
        <>
          <PageHeader title="Overview" subtitle="Quick summary of the queue and your workload." />
          <StatRow>
            <StatCard label="In queue" value={overviewCounts.queueSize} tone="var(--st-accepted-fg)" />
            <StatCard label="Assigned to me" value={overviewCounts.mine} tone="var(--primary)" />
            <StatCard label="In progress" value={overviewCounts.inProgress} tone="var(--st-progress-fg)" />
            <StatCard label="Resolved" value={overviewCounts.resolved} tone="var(--st-resolved-fg)" />
            <StatCard label="Closed" value={overviewCounts.closed} tone="var(--st-closed-fg)" />
          </StatRow>
        </>
      )}

      {selected && (
        <TicketDetailModal
          ticket={selected}
          onClose={() => setSelected(null)}
          canSeeComments
          onAddComment={(text) => handleComment(selected.id, text)}
          actions={buildActions(selected)}
          extra={
            selected.assignedTo === session.username && ['in_progress', 'resolved'].includes(selected.status) ? (
              <>
                <select
                  value={reassignTarget}
                  onChange={(e) => setReassignTarget(e.target.value)}
                  style={{ border: '1px solid var(--line)', borderRadius: 6, padding: '6px 8px', fontSize: 13 }}
                >
                  <option value="">Reassign to…</option>
                  {agents.filter((a) => a.username !== session.username).map((a) => (
                    <option key={a.username} value={a.username}>{a.username}</option>
                  ))}
                </select>
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={!reassignTarget || reassigning}
                  onClick={() => handleReassign(selected.id)}
                >
                  {reassigning ? 'Reassigning…' : 'Reassign'}
                </button>
              </>
            ) : null
          }
        />
      )}
    </Shell>
  );
}

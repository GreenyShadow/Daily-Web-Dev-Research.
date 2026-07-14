import { useMemo, useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { PageHeader, StatCard, StatRow } from '../../components/PageHeader.jsx';
import { isExpired, SUPPORT_STAGE_STATUSES } from '../../lib/constants.js';

const RANGES = [
  { id: 'today', label: 'Today' },
  { id: '7d', label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' },
  { id: 'all', label: 'All time' },
];

const DONUT_COLORS = ['#9a6300', '#1d5fa8', '#b3261e', '#56607a'];

function withinRange(iso, range) {
  if (range === 'all') return true;
  const created = new Date(iso).getTime();
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  if (range === 'today') {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return created >= start.getTime();
  }
  if (range === '7d') return now - created <= 7 * day;
  if (range === '30d') return now - created <= 30 * day;
  return true;
}

export default function ReportsTab({ tickets, users }) {
  const [range, setRange] = useState('30d');

  const scoped = useMemo(() => tickets.filter((t) => withinRange(t.createdAt, range)), [tickets, range]);

  const counts = useMemo(() => {
    const total = scoped.length;
    const accepted = scoped.filter((t) => SUPPORT_STAGE_STATUSES.includes(t.status)).length;
    const denied = scoped.filter((t) => t.status === 'denied').length;
    const expired = scoped.filter((t) => isExpired(t) && (!t.status || t.status === 'pending')).length;
    const sent = total - accepted - denied;
    return { total, sent, accepted, denied, expired };
  }, [scoped]);

  const donutData = [
    { name: 'Awaiting review', value: counts.sent - counts.expired },
    { name: 'Accepted', value: counts.accepted },
    { name: 'Denied', value: counts.denied },
    { name: 'Expired', value: counts.expired },
  ].filter((d) => d.value > 0);

  const dailyVolume = useMemo(() => {
    const buckets = new Map();
    for (const t of scoped) {
      const day = new Date(t.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      buckets.set(day, (buckets.get(day) || 0) + 1);
    }
    return Array.from(buckets.entries()).map(([day, count]) => ({ day, count }));
  }, [scoped]);

  const workload = useMemo(() => {
    const agentUsers = users.filter((u) => u.role === 'agent');
    return agentUsers.map((a) => {
      const assigned = tickets.filter((t) => t.assignedTo === a.username);
      const open = assigned.filter((t) => t.status === 'in_progress').length;
      const closed = assigned.filter((t) => ['resolved', 'closed'].includes(t.status)).length;
      return { username: a.username, open, closed, total: assigned.length };
    });
  }, [tickets, users]);

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Ticket volume, status breakdown, and agent workload."
        action={
          <select value={range} onChange={(e) => setRange(e.target.value)} style={{ border: '1px solid var(--line)', borderRadius: 6, padding: '8px 10px', fontSize: 13 }}>
            {RANGES.map((r) => (
              <option key={r.id} value={r.id}>{r.label}</option>
            ))}
          </select>
        }
      />

      <StatRow>
        <StatCard label="Total requests" value={counts.total} />
        <StatCard label="Awaiting review" value={counts.sent - counts.expired} tone="var(--st-pending-fg)" />
        <StatCard label="Accepted" value={counts.accepted} tone="var(--st-accepted-fg)" />
        <StatCard label="Denied" value={counts.denied} tone="var(--st-denied-fg)" />
        <StatCard label="Expired" value={counts.expired} tone="var(--ink-soft)" />
      </StatRow>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 16, marginBottom: 16 }}>
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 14, marginBottom: 12 }}>Status distribution</h3>
          {donutData.length === 0 ? (
            <div className="ticket-empty" style={{ padding: 24 }}>No data in this range.</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={donutData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                  {donutData.map((_, i) => (
                    <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 14, marginBottom: 12 }}>Daily volume</h3>
          {dailyVolume.length === 0 ? (
            <div className="ticket-empty" style={{ padding: 24 }}>No data in this range.</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={dailyVolume}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                <XAxis dataKey="day" fontSize={11} />
                <YAxis fontSize={11} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="card" style={{ padding: 20 }}>
        <h3 style={{ fontSize: 14, marginBottom: 12 }}>Agent workload</h3>
        {workload.length === 0 ? (
          <div className="ticket-empty" style={{ padding: 24 }}>No agents on record.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--ink-soft)', fontSize: 11.5, textTransform: 'uppercase' }}>
                <th style={{ padding: '6px 8px' }}>Agent</th>
                <th style={{ padding: '6px 8px' }}>Open</th>
                <th style={{ padding: '6px 8px' }}>Closed</th>
                <th style={{ padding: '6px 8px' }}>Total assigned</th>
              </tr>
            </thead>
            <tbody>
              {workload.map((w) => (
                <tr key={w.username} style={{ borderTop: '1px solid var(--line-soft)' }}>
                  <td style={{ padding: '8px' }}><strong>{w.username}</strong></td>
                  <td style={{ padding: '8px' }}>{w.open}</td>
                  <td style={{ padding: '8px' }}>{w.closed}</td>
                  <td style={{ padding: '8px' }}>{w.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

import { useEffect, useState, useCallback, useMemo } from 'react';
import Shell from '../../components/Shell.jsx';
import Banner from '../../components/Banner.jsx';
import { useAuthedApi } from '../../hooks/useAuthedApi.js';
import { isUnprocessed } from '../../lib/constants.js';
import TriageTab from './TriageTab.jsx';
import ReportsTab from './ReportsTab.jsx';
import UsersTab from './UsersTab.jsx';

const TABS = [
  { id: 'triage', label: 'Triage', icon: '⟡' },
  { id: 'reports', label: 'Reports', icon: '▥' },
  { id: 'users', label: 'Users', icon: '☺' },
];

export default function AdminPage() {
  const api = useAuthedApi();
  const [tab, setTab] = useState('triage');
  const [tickets, setTickets] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      const [tk, us] = await Promise.all([api.listTickets(), api.listUsers()]);
      setTickets(tk);
      setUsers(us);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const pendingCount = useMemo(() => tickets.filter(isUnprocessed).length, [tickets]);

  const tabsWithCount = TABS.map((t) => (t.id === 'triage' ? { ...t, count: pendingCount } : t));

  return (
    <Shell tabs={tabsWithCount} activeTab={tab} onTabChange={setTab}>
      {error && <Banner kind="error" onDismiss={() => setError('')}>{error}</Banner>}
      {loading ? (
        <div className="ticket-empty">Loading…</div>
      ) : (
        <>
          {tab === 'triage' && <TriageTab tickets={tickets} api={api} onChanged={refresh} />}
          {tab === 'reports' && <ReportsTab tickets={tickets} users={users} />}
          {tab === 'users' && <UsersTab users={users} api={api} onChanged={refresh} setError={setError} />}
        </>
      )}
    </Shell>
  );
}

import { useAuth } from '../context/AuthContext.jsx';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import './Shell.css';

const ROLE_META = {
  member: { label: 'Member workspace', color: 'var(--primary)' },
  agent: { label: 'Agent workspace', color: 'var(--st-progress-fg)' },
  admin: { label: 'Admin workspace', color: 'var(--amber)' },
};

export default function Shell({ tabs, activeTab, onTabChange, children }) {
  const { session, logout } = useAuth();
  const roleMeta = ROLE_META[session?.role] || ROLE_META.member;

  return (
    <div className="shell">
      <aside className="shell-sidebar">
        <div className="shell-brand">
          <span className="shell-brand-mark" style={{ background: roleMeta.color }} />
          <span className="shell-brand-name">Deskline</span>
        </div>
        <div className="shell-role" style={{ color: roleMeta.color }}>
          {roleMeta.label}
        </div>

        <nav className="shell-nav">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={cn('shell-nav-item', activeTab === tab.id && 'is-active')}
              onClick={() => onTabChange(tab.id)}
            >
              <span className="shell-nav-icon">{tab.icon}</span>
              {tab.label}
              {typeof tab.count === 'number' && tab.count > 0 && (
                <span className="shell-nav-count">{tab.count}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="shell-user">
          <div className="shell-user-avatar">{(session?.username || '?').charAt(0).toUpperCase()}</div>
          <div className="shell-user-info">
            <div className="shell-user-name">{session?.username}</div>
            <div className="shell-user-role">{session?.role}</div>
          </div>
          <Button variant="ghost" size="sm" onClick={logout}>
            Log out
          </Button>
        </div>
      </aside>
      <main className="shell-main">{children}</main>
    </div>
  );
}

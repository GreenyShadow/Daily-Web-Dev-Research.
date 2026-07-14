export function PageHeader({ title, subtitle, action }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, marginBottom: 24 }}>
      <div>
        <h1 style={{ fontSize: 24 }}>{title}</h1>
        {subtitle && <p style={{ color: 'var(--ink-soft)', fontSize: 14, marginTop: 6 }}>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({ label, value, tone }) {
  return (
    <div className="card" style={{ padding: '16px 18px', flex: 1, minWidth: 130 }}>
      <div style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: tone || 'var(--ink-soft)' }}>
        {label}
      </div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, marginTop: 6 }}>{value}</div>
    </div>
  );
}

export function StatRow({ children }) {
  return <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 26 }}>{children}</div>;
}

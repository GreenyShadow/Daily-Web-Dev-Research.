import { Card } from '@/components/ui/card';

export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({ label, value, tone }) {
  return (
    <Card className="min-w-[130px] flex-1 px-[18px] py-4">
      <div
        className="flex min-h-[29px] items-start text-[11.5px] font-bold uppercase leading-tight tracking-wide"
        style={{ color: tone || 'var(--ink-soft)' }}
      >
        {label}
      </div>
      <div className="mt-1.5 font-display text-[28px] font-bold">{value}</div>
    </Card>
  );
}

export function StatRow({ children }) {
  return <div className="mb-[26px] flex flex-wrap gap-3">{children}</div>;
}

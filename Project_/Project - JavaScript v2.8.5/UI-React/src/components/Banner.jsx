import { cn } from '@/lib/utils';

const KIND_CLASSES = {
  error: 'bg-status-denied-bg text-status-denied-fg',
  success: 'bg-status-resolved-bg text-status-resolved-fg',
  info: 'bg-accent text-accent-foreground',
};

export default function Banner({ kind = 'error', children, onDismiss }) {
  if (!children) return null;
  return (
    <div
      className={cn(
        'mb-3.5 flex items-center justify-between gap-3 rounded-lg px-3.5 py-2.5 text-[13.5px] font-medium',
        KIND_CLASSES[kind]
      )}
    >
      <span>{children}</span>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-base font-bold leading-none opacity-70 hover:opacity-100"
          aria-label="Dismiss"
        >
          ×
        </button>
      )}
    </div>
  );
}

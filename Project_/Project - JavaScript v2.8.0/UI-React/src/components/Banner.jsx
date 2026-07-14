export default function Banner({ kind = 'error', children, onDismiss }) {
  if (!children) return null;
  const styles = {
    error: { bg: 'var(--st-denied-bg)', fg: 'var(--st-denied-fg)' },
    success: { bg: 'var(--st-resolved-bg)', fg: 'var(--st-resolved-fg)' },
    info: { bg: 'var(--primary-soft)', fg: 'var(--primary-dark)' },
  }[kind];

  return (
    <div
      style={{
        background: styles.bg,
        color: styles.fg,
        borderRadius: 8,
        padding: '10px 14px',
        fontSize: 13.5,
        fontWeight: 500,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 14,
      }}
    >
      <span>{children}</span>
      {onDismiss && (
        <button
          onClick={onDismiss}
          style={{
            background: 'none',
            border: 'none',
            color: 'inherit',
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: 15,
          }}
          aria-label="Dismiss"
        >
          ×
        </button>
      )}
    </div>
  );
}

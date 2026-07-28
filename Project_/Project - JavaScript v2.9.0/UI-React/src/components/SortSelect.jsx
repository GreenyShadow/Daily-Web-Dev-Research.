import { SORT_OPTIONS } from '../lib/constants.js';

export default function SortSelect({ value, onChange }) {
  return (
    <select
      aria-label="Sort by date created"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        border: '1px solid var(--line)',
        borderRadius: 6,
        padding: '7px 10px',
        fontSize: 13,
        background: 'var(--card, #fff)',
      }}
    >
      {SORT_OPTIONS.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

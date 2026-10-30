export interface StatItem {
  label: string;
  value: string;
  tone?: 'add' | 'del';
}

/** A row of big-number tiles. */
export function Stats({ items }: { items: StatItem[] }) {
  return (
    <dl class="stats">
      {items.map((s) => (
        <div key={s.label} class={`stat${s.tone ? ` stat--${s.tone}` : ''}`}>
          <dt>{s.label}</dt>
          <dd>{s.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Keep/reject state for numbered changes, shared by the comparison sheet
 * (number badges) and the review panel (checkbox list).
 */
import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import type { Change, DiffRow } from '../../core/diff';

export interface Review {
  changes: Change[];
  /** Ids of rejected changes in the current result. */
  rejected: ReadonlySet<number>;
  toggle: (id: number) => void;
}

export const ReviewContext = createContext<Review>({ changes: [], rejected: new Set(), toggle: () => {} });

/** Distinct change ids in a row, in order. */
export function rowChanges(row: DiffRow): number[] {
  const ids: number[] = [];
  for (const seg of row.edits) if (seg.change && !ids.includes(seg.change)) ids.push(seg.change);
  return ids;
}

/** Ids to badge on this row: a change spanning several added or removed lines is badged on its first line only. */
export function rowBadges(row: DiffRow, changes: Change[]): number[] {
  return rowChanges(row).filter((id) => {
    const c = changes[id - 1];
    if (!c?.wholeLines || c.where.from === c.where.to) return true;
    return (c.where.side === 'original' ? row.leftLine : row.rightLine) === c.where.from;
  });
}

/** The change number shown in the text. Clicking it keeps or rejects that change. */
export function ChangeBadge({ id }: { id: number }) {
  const { rejected, toggle } = useContext(ReviewContext);
  const kept = !rejected.has(id);
  const label = `Change #${id}: ${kept ? 'kept' : 'rejected'}. Click to ${kept ? 'reject' : 'keep'} it.`;
  return (
    <button
      type="button"
      class={`chg${kept ? '' : ' is-rejected'}`}
      data-change={id}
      aria-pressed={kept}
      aria-label={label}
      title={label}
      onClick={() => toggle(id)}
    >
      {id}
    </button>
  );
}

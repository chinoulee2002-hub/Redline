/**
 * Turns diff rows into what the viewer draws: rows, plus "show N unchanged
 * lines" fold markers when unchanged text is hidden.
 */
import type { DiffRow } from '../../core/diff';

/** Unchanged lines kept visible on each side of a change. */
export const CONTEXT_LINES = 2;

export type SheetItem =
  | { kind: 'row'; row: DiffRow; key: number }
  | { kind: 'fold'; start: number; hidden: number; key: string };

export function layoutRows(rows: DiffRow[], hideUnchanged: boolean, expanded: ReadonlySet<number>): SheetItem[] {
  const items: SheetItem[] = [];
  const push = (from: number, to: number) => {
    for (let k = from; k < to; k++) items.push({ kind: 'row', row: rows[k], key: k });
  };
  let i = 0;
  while (i < rows.length) {
    if (rows[i].type !== 'equal' || !hideUnchanged) {
      push(i, i + 1);
      i++;
      continue;
    }
    let j = i;
    while (j < rows.length && rows[j].type === 'equal') j++;
    // No leading context at the very top, no trailing context at the very end.
    const head = i === 0 ? 0 : CONTEXT_LINES;
    const tail = j === rows.length ? 0 : CONTEXT_LINES;
    const run = j - i;
    if (run <= head + tail + 1 || expanded.has(i)) push(i, j);
    else {
      push(i, i + head);
      items.push({ kind: 'fold', start: i, hidden: run - head - tail, key: `fold-${i}` });
      push(j - tail, j);
    }
    i = j;
  }
  return items;
}

/** Index in `items` of the first row of change block `block`, or -1. */
export function indexOfBlock(items: SheetItem[], block: number): number {
  return items.findIndex((it) => it.kind === 'row' && it.row.block === block);
}

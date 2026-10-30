/**
 * Myers' O(ND) difference algorithm.
 *
 * Given two sequences A and B, finds the shortest edit script: the fewest
 * deletions from A and insertions from B that turn A into B. N is the total
 * length and D the number of edits, so near-identical inputs are fast.
 *
 * Reference: E. Myers, "An O(ND) Difference Algorithm and Its Variations" (1986).
 */

export type EditOp =
  | { type: 'equal'; a: number; b: number }
  | { type: 'delete'; a: number }
  | { type: 'insert'; b: number };

export interface EditScript {
  ops: EditOp[];
  /**
   * True when the inputs differed so much that the search gave up and reported
   * "delete all of A, insert all of B" for the middle section instead.
   */
  approximate: boolean;
}

/**
 * Edit-distance budget. Memory grows with D², so past this point we stop
 * searching and fall back to a coarse answer rather than stall the page.
 */
const DEFAULT_MAX_EDITS = 4000;

/** Diffs two sequences compared with `===`. Map elements to numbers first for speed. */
export function diffSequences<T>(a: readonly T[], b: readonly T[], maxEdits = DEFAULT_MAX_EDITS): EditScript {
  // Common prefix and suffix are matched directly; only the middle is searched.
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }

  const ops: EditOp[] = [];
  for (let i = 0; i < start; i++) ops.push({ type: 'equal', a: i, b: i });
  const middle = searchMiddle(a.slice(start, endA), b.slice(start, endB), maxEdits);
  for (const op of middle.ops) {
    if (op.type === 'equal') ops.push({ type: 'equal', a: op.a + start, b: op.b + start });
    else if (op.type === 'delete') ops.push({ type: 'delete', a: op.a + start });
    else ops.push({ type: 'insert', b: op.b + start });
  }
  for (let i = 0; i < a.length - endA; i++) ops.push({ type: 'equal', a: endA + i, b: endB + i });
  return { ops, approximate: middle.approximate };
}

function searchMiddle<T>(a: readonly T[], b: readonly T[], maxEdits: number): EditScript {
  const n = a.length;
  const m = b.length;
  const ops: EditOp[] = [];
  if (n === 0) {
    for (let j = 0; j < m; j++) ops.push({ type: 'insert', b: j });
    return { ops, approximate: false };
  }
  if (m === 0) {
    for (let i = 0; i < n; i++) ops.push({ type: 'delete', a: i });
    return { ops, approximate: false };
  }

  // v[offset + k] holds the furthest x reached on diagonal k (where k = x - y).
  const max = n + m;
  const offset = max + 1;
  const v = new Int32Array(2 * max + 3);
  // history[d] is a copy of the reachable part of v after round d, used to walk back.
  const history: Int32Array[] = [];
  let finalD = -1;

  search: for (let d = 0; d <= max; d++) {
    if (d > maxEdits) break;
    for (let k = -d; k <= d; k += 2) {
      let x =
        k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1])
          ? v[offset + k + 1] // step down: insertion
          : v[offset + k - 1] + 1; // step right: deletion
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) {
        x++;
        y++;
      }
      v[offset + k] = x;
      if (x >= n && y >= m) {
        finalD = d;
        break search;
      }
    }
    history.push(v.slice(offset - d - 1, offset + d + 2));
  }

  if (finalD < 0) {
    for (let i = 0; i < n; i++) ops.push({ type: 'delete', a: i });
    for (let j = 0; j < m; j++) ops.push({ type: 'insert', b: j });
    return { ops, approximate: true };
  }

  // Walk back from (n, m) to (0, 0), emitting ops in reverse.
  let x = n;
  let y = m;
  for (let d = finalD; d >= 1; d--) {
    // history[d - 1] was sliced from v starting at diagonal -d, so diagonal k sits at index k + d.
    const prev = history[d - 1];
    const at = (diag: number) => prev[diag + d];
    const k = x - y;
    const cameDown = k === -d || (k !== d && at(k - 1) < at(k + 1));
    const prevK = cameDown ? k + 1 : k - 1;
    const prevX = at(prevK);
    const prevY = prevX - prevK;
    const snakeStartX = cameDown ? prevX : prevX + 1;
    const snakeStartY = cameDown ? prevY + 1 : prevY;
    while (x > snakeStartX && y > snakeStartY) ops.push({ type: 'equal', a: --x, b: --y });
    if (cameDown) ops.push({ type: 'insert', b: snakeStartY - 1 });
    else ops.push({ type: 'delete', a: snakeStartX - 1 });
    x = prevX;
    y = prevY;
  }
  while (x > 0 && y > 0) ops.push({ type: 'equal', a: --x, b: --y });
  ops.reverse();
  return { ops, approximate: false };
}

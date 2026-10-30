import { describe, expect, it } from 'vitest';
import { diffSequences, type EditOp } from '../../src/core/myers';

/** Replays an edit script and returns the reconstructed B, plus the number of edits. */
function replay<T>(a: T[], b: T[], ops: EditOp[]) {
  const out: T[] = [];
  let edits = 0;
  for (const op of ops) {
    if (op.type === 'equal') {
      expect(a[op.a]).toBe(b[op.b]);
      out.push(b[op.b]);
    } else if (op.type === 'insert') {
      out.push(b[op.b]);
      edits++;
    } else edits++;
  }
  return { out, edits };
}

function lcsLength<T>(a: T[], b: T[]): number {
  const dp = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
  return dp[a.length][b.length];
}

describe('diffSequences', () => {
  it('handles empty inputs', () => {
    expect(diffSequences([], []).ops).toEqual([]);
    expect(diffSequences(['x'], []).ops).toEqual([{ type: 'delete', a: 0 }]);
    expect(diffSequences([], ['x']).ops).toEqual([{ type: 'insert', b: 0 }]);
  });

  it('finds a minimal edit script on random inputs', () => {
    let seed = 7;
    const rand = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
    for (let t = 0; t < 300; t++) {
      const a = Array.from({ length: Math.floor(rand() * 25) }, () => Math.floor(rand() * 4));
      const b = Array.from({ length: Math.floor(rand() * 25) }, () => Math.floor(rand() * 4));
      const { ops, approximate } = diffSequences(a, b);
      const { out, edits } = replay(a, b, ops);
      expect(approximate).toBe(false);
      expect(out).toEqual(b);
      expect(edits).toBe(a.length + b.length - 2 * lcsLength(a, b));
      // Indices on each side must be visited in order exactly once.
      expect(ops.filter((o) => o.type !== 'insert').map((o) => (o as { a: number }).a)).toEqual(a.map((_, i) => i));
      expect(ops.filter((o) => o.type !== 'delete').map((o) => (o as { b: number }).b)).toEqual(b.map((_, i) => i));
    }
  });

  it('falls back to a coarse script past the edit budget', () => {
    const a = Array.from({ length: 50 }, (_, i) => i);
    const b = Array.from({ length: 50 }, (_, i) => i + 100);
    const res = diffSequences(a, b, 10);
    expect(res.approximate).toBe(true);
    expect(replay(a, b, res.ops).out).toEqual(b);
  });
});

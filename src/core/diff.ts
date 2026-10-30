/**
 * Text comparison: line-level diff first, then a word- or character-level
 * diff inside each changed line so the reader sees exactly what was reworded.
 */
import { diffSequences } from './myers';
import { charTokens, countWords, diffTokens, isWhitespace, normalizeNewlines } from './tokenize';

/** How finely changes inside a line are highlighted. 'line' marks whole lines only. */
export type DiffDetail = 'word' | 'char' | 'line';

export interface DiffOptions {
  /** Treat runs of spaces/tabs as one space and ignore leading/trailing space. */
  ignoreWhitespace: boolean;
  ignoreCase: boolean;
  detail: DiffDetail;
}

export type SegmentType = 'equal' | 'delete' | 'insert';

export interface Segment {
  type: SegmentType;
  text: string;
}

export type RowType = 'equal' | 'change' | 'delete' | 'insert';

export interface DiffRow {
  type: RowType;
  /** 1-based line number in the original, or null when the row has no original line. */
  leftLine: number | null;
  /** 1-based line number in the new text, or null when the row has no new line. */
  rightLine: number | null;
  /** Original side, for side-by-side view. Empty when there is no original line. */
  left: Segment[];
  /** New side, for side-by-side view. Empty when there is no new line. */
  right: Segment[];
  /** Both sides interleaved, for single-column view of an inline change. */
  merged: Segment[];
  /** A changed line too different to show inline; render as one removed and one added line. */
  rewritten: boolean;
  /** 0 for unchanged rows; otherwise the 1-based number of the change block this row belongs to. */
  block: number;
}

export interface DiffStats {
  wordsAdded: number;
  wordsRemoved: number;
  linesChanged: number;
  linesUnchanged: number;
  originalWords: number;
  newWords: number;
  /** Number of separate places that changed (runs of consecutive changed rows). */
  blocks: number;
  /** Share of the original's words that survive in the new text, 0–100. */
  retainedPercent: number;
}

export interface DiffResult {
  rows: DiffRow[];
  stats: DiffStats;
  /** The texts were too different for an exact diff; some changes are shown coarsely. */
  approximate: boolean;
}

/**
 * Below this share of shared words, a pair of changed lines is shown as
 * "rewritten" instead of word-by-word, which would be mostly noise.
 */
const INLINE_SIMILARITY_THRESHOLD = 0.3;

export function compareTexts(original: string, revised: string, options: DiffOptions): DiffResult {
  const a = normalizeNewlines(original).split('\n');
  const b = normalizeNewlines(revised).split('\n');

  // Compare integers instead of strings: each distinct normalized line gets an id.
  const ids = new Map<string, number>();
  const idOf = (line: string) => {
    const key = normalizeLine(line, options);
    let id = ids.get(key);
    if (id === undefined) ids.set(key, (id = ids.size));
    return id;
  };
  const script = diffSequences(a.map(idOf), b.map(idOf));

  const rows: DiffRow[] = [];
  const stats: DiffStats = {
    wordsAdded: 0,
    wordsRemoved: 0,
    linesChanged: 0,
    linesUnchanged: 0,
    originalWords: countWords(original),
    newWords: countWords(revised),
    blocks: 0,
    retainedPercent: 0,
  };

  const { ops } = script;
  let i = 0;
  while (i < ops.length) {
    const op = ops[i];
    if (op.type === 'equal') {
      stats.linesUnchanged++;
      rows.push(equalRow(a[op.a], b[op.b], op.a, op.b));
      i++;
      continue;
    }

    // Collect one run of edits, then pair the n-th removed line with the n-th added one.
    const removed: number[] = [];
    const added: number[] = [];
    for (; i < ops.length; i++) {
      const edit = ops[i];
      if (edit.type === 'equal') break;
      if (edit.type === 'delete') removed.push(edit.a);
      else added.push(edit.b);
    }
    const pairs = Math.max(removed.length, added.length);
    for (let q = 0; q < pairs; q++) {
      const ai = removed[q];
      const bi = added[q];
      if (ai !== undefined && bi !== undefined) rows.push(changedPair(a[ai], b[bi], ai, bi, options, stats));
      else if (ai !== undefined) {
        stats.linesChanged++;
        stats.wordsRemoved += countWords(a[ai]);
        rows.push(wholeLineRow('delete', a[ai], ai + 1, null));
      } else {
        stats.linesChanged++;
        stats.wordsAdded += countWords(b[bi]);
        rows.push(wholeLineRow('insert', b[bi], null, bi + 1));
      }
    }
  }

  let block = 0;
  let previousChanged = false;
  for (const row of rows) {
    const changed = row.type !== 'equal';
    if (changed && !previousChanged) block++;
    if (changed) row.block = block;
    previousChanged = changed;
  }
  stats.blocks = block;
  stats.retainedPercent = stats.originalWords
    ? Math.max(0, Math.round((100 * (stats.originalWords - stats.wordsRemoved)) / stats.originalWords))
    : 0;

  return { rows, stats, approximate: script.approximate };
}

function normalizeLine(line: string, options: DiffOptions): string {
  let s = line;
  if (options.ignoreWhitespace) s = s.replace(/\s+/g, ' ').trim();
  if (options.ignoreCase) s = s.toLowerCase();
  return s;
}

function equalRow(left: string, right: string, ai: number, bi: number): DiffRow {
  return {
    type: 'equal',
    leftLine: ai + 1,
    rightLine: bi + 1,
    left: [{ type: 'equal', text: left }],
    right: [{ type: 'equal', text: right }],
    merged: [{ type: 'equal', text: right }],
    rewritten: false,
    block: 0,
  };
}

function wholeLineRow(type: 'delete' | 'insert', text: string, leftLine: number | null, rightLine: number | null): DiffRow {
  const seg: Segment[] = [{ type, text }];
  return {
    type,
    leftLine,
    rightLine,
    left: type === 'delete' ? seg : [],
    right: type === 'insert' ? seg : [],
    merged: seg,
    rewritten: false,
    block: 0,
  };
}

function changedPair(
  left: string,
  right: string,
  ai: number,
  bi: number,
  options: DiffOptions,
  stats: DiffStats,
): DiffRow {
  // Word-level diff decides how to show the pair and feeds the statistics in every detail mode.
  const words = inlineDiff(diffTokens(left), diffTokens(right), options, isWhitespace);
  const sameWords = words.deleted === 0 && words.inserted === 0;

  if (words.similarity >= INLINE_SIMILARITY_THRESHOLD && !(sameWords && left === right)) {
    stats.linesChanged++;
    stats.wordsAdded += words.inserted;
    stats.wordsRemoved += words.deleted;
    if (options.detail === 'line') return rewrittenRow(left, right, ai, bi);
    // Character mode: absorb 1–2 character islands so "colour → color" doesn't splinter.
    const shown =
      options.detail === 'char'
        ? inlineDiff(charTokens(left), charTokens(right), options, (t) => isWhitespace(t) || t.length <= 2)
        : words;
    return {
      type: 'change',
      leftLine: ai + 1,
      rightLine: bi + 1,
      left: shown.left,
      right: shown.right,
      merged: shown.merged,
      rewritten: false,
      block: 0,
    };
  }
  if (sameWords) {
    // Only ignored differences (e.g. whitespace on a blank line): treat as unchanged.
    stats.linesUnchanged++;
    return equalRow(left, right, ai, bi);
  }
  stats.linesChanged++;
  stats.wordsRemoved += countWords(left);
  stats.wordsAdded += countWords(right);
  return rewrittenRow(left, right, ai, bi);
}

function rewrittenRow(left: string, right: string, ai: number, bi: number): DiffRow {
  return {
    type: 'change',
    leftLine: ai + 1,
    rightLine: bi + 1,
    left: [{ type: 'delete', text: left }],
    right: [{ type: 'insert', text: right }],
    merged: [
      { type: 'delete', text: left },
      { type: 'insert', text: right },
    ],
    rewritten: true,
    block: 0,
  };
}

/** One step of an inline diff. Equal pieces keep both texts, which differ when case or spacing is ignored. */
interface Piece {
  type: SegmentType;
  a: string;
  b: string;
}

interface InlineDiff {
  left: Segment[];
  right: Segment[];
  merged: Segment[];
  /** Non-whitespace tokens that were kept, removed and added. */
  kept: number;
  deleted: number;
  inserted: number;
  /** kept / longer side, 0–1. */
  similarity: number;
}

function inlineDiff(
  aTokens: string[],
  bTokens: string[],
  options: DiffOptions,
  absorbIfBetweenChanges: (text: string) => boolean,
): InlineDiff {
  const key = (t: string) => {
    if (isWhitespace(t)) return options.ignoreWhitespace ? ' ' : t;
    return options.ignoreCase ? t.toLowerCase() : t;
  };
  const { ops } = diffSequences(aTokens.map(key), bTokens.map(key));

  let kept = 0;
  let deleted = 0;
  let inserted = 0;
  const pieces: Piece[] = ops.map((op) => {
    if (op.type === 'equal') {
      if (!isWhitespace(aTokens[op.a])) kept++;
      return { type: 'equal', a: aTokens[op.a], b: bTokens[op.b] };
    }
    if (op.type === 'delete') {
      if (!isWhitespace(aTokens[op.a])) deleted++;
      return { type: 'delete', a: aTokens[op.a], b: '' };
    }
    if (!isWhitespace(bTokens[op.b])) inserted++;
    return { type: 'insert', a: '', b: bTokens[op.b] };
  });

  // Group first so the absorb check sees whole unchanged runs, then regroup what it produced.
  const tidy = groupPieces(absorbShortEquals(groupPieces(pieces), absorbIfBetweenChanges));
  const left: Segment[] = [];
  const right: Segment[] = [];
  const merged: Segment[] = [];
  for (const p of tidy) {
    if (p.type !== 'insert') left.push({ type: p.type, text: p.a });
    if (p.type !== 'delete') right.push({ type: p.type, text: p.b });
    merged.push({ type: p.type, text: p.type === 'delete' ? p.a : p.b });
  }

  const wordsA = aTokens.filter((t) => !isWhitespace(t)).length;
  const wordsB = bTokens.filter((t) => !isWhitespace(t)).length;
  return { left, right, merged, kept, deleted, inserted, similarity: kept / Math.max(1, wordsA, wordsB) };
}

/**
 * An unchanged sliver between two edits ("the" in "<del>a</del> the <ins>b</ins>")
 * reads better as part of the edit. Turn such pieces into a delete plus an insert.
 */
function absorbShortEquals(pieces: Piece[], shouldAbsorb: (text: string) => boolean): Piece[] {
  const out: Piece[] = [];
  for (let i = 0; i < pieces.length; i++) {
    const p = pieces[i];
    const between = i > 0 && i < pieces.length - 1 && pieces[i - 1].type !== 'equal' && pieces[i + 1].type !== 'equal';
    if (p.type === 'equal' && between && shouldAbsorb(p.a)) {
      out.push({ type: 'delete', a: p.a, b: '' }, { type: 'insert', a: '', b: p.b });
    } else out.push(p);
  }
  return out;
}

/** Merges neighbours of the same kind and orders each edit run as "all deletions, then all insertions". */
function groupPieces(pieces: Piece[]): Piece[] {
  const out: Piece[] = [];
  let i = 0;
  while (i < pieces.length) {
    if (pieces[i].type === 'equal') {
      let a = '';
      let b = '';
      for (; i < pieces.length && pieces[i].type === 'equal'; i++) {
        a += pieces[i].a;
        b += pieces[i].b;
      }
      out.push({ type: 'equal', a, b });
      continue;
    }
    let del = '';
    let ins = '';
    for (; i < pieces.length && pieces[i].type !== 'equal'; i++) {
      del += pieces[i].a;
      ins += pieces[i].b;
    }
    if (del) out.push({ type: 'delete', a: del, b: '' });
    if (ins) out.push({ type: 'insert', a: '', b: ins });
  }
  return out;
}

/** Plain-text unified diff ("- removed", "+ added", "  unchanged"), for copying into chats or tickets. */
export function toUnifiedText(rows: DiffRow[]): string {
  const join = (segs: Segment[]) => segs.map((s) => s.text).join('');
  const lines: string[] = [];
  for (const row of rows) {
    if (row.type === 'equal') lines.push('  ' + join(row.right));
    else {
      if (row.left.length) lines.push('- ' + join(row.left));
      if (row.right.length) lines.push('+ ' + join(row.right));
    }
  }
  return lines.join('\n');
}

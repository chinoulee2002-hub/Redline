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
  /** Id of the change this text belongs to (see `DiffResult.changes`); absent on unchanged text. */
  change?: number;
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
  /**
   * The row as word-level edits tagged with change ids, whatever the display detail.
   * Used to rebuild the text from keep/reject decisions (see core/review.ts).
   */
  edits: Segment[];
}

export type ChangeKind = 'replace' | 'insert' | 'delete';

/** One numbered, separately reviewable edit. */
export interface Change {
  /** 1-based, in document order. */
  id: number;
  /**
   * Identifies the same edit across recomputes (kind, texts and occurrence),
   * so a keep/reject decision survives edits elsewhere in the text.
   */
  key: string;
  kind: ChangeKind;
  /** Original wording ('' for insertions). */
  before: string;
  /** New wording ('' for deletions). */
  after: string;
  /** Where it is: lines of the new text, or of the original for removed lines. */
  where: { side: 'original' | 'revised'; from: number; to: number };
  /** The full line the change is in, to help locate it. */
  context: string;
  /** The change is entire lines (added, removed or rewritten), not words inside a line. */
  wholeLines: boolean;
  /** The change block (see `DiffRow.block`) containing it. */
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
  /** Every edit, numbered in document order. */
  changes: Change[];
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

  const changes: Change[] = [];
  const record: RecordChange = (before, after, where, context, wholeLines = false) => {
    const kind: ChangeKind = before && after ? 'replace' : before ? 'delete' : 'insert';
    changes.push({
      id: changes.length + 1,
      key: '',
      kind,
      before,
      after,
      where,
      context,
      wholeLines,
      block: 0,
    });
    return changes.length;
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
    const paired = Math.min(removed.length, added.length);
    for (let q = 0; q < paired; q++) {
      rows.push(changedPair(a[removed[q]], b[added[q]], removed[q], added[q], options, stats, record));
    }
    // Lines left over after pairing were purely removed (or purely added): one change for the run.
    const extraRemoved = removed.slice(paired);
    const extraAdded = added.slice(paired);
    if (extraRemoved.length) {
      const text = extraRemoved.map((ai) => a[ai]).join('\n');
      const from = extraRemoved[0] + 1;
      const where = { side: 'original', from, to: from + extraRemoved.length - 1 } as const;
      const id = record(text, '', where, a[extraRemoved[0]], true);
      for (const ai of extraRemoved) {
        stats.linesChanged++;
        stats.wordsRemoved += countWords(a[ai]);
        rows.push(wholeLineRow('delete', a[ai], ai + 1, null, id));
      }
    }
    if (extraAdded.length) {
      const text = extraAdded.map((bi) => b[bi]).join('\n');
      const from = extraAdded[0] + 1;
      const where = { side: 'revised', from, to: from + extraAdded.length - 1 } as const;
      const id = record('', text, where, b[extraAdded[0]], true);
      for (const bi of extraAdded) {
        stats.linesChanged++;
        stats.wordsAdded += countWords(b[bi]);
        rows.push(wholeLineRow('insert', b[bi], null, bi + 1, id));
      }
    }
  }

  let block = 0;
  let previousChanged = false;
  for (const row of rows) {
    const changed = row.type !== 'equal';
    if (changed && !previousChanged) block++;
    if (changed) {
      row.block = block;
      for (const seg of row.edits) if (seg.change) changes[seg.change - 1].block = block;
    }
    previousChanged = changed;
  }
  assignKeys(changes);
  stats.blocks = block;
  stats.retainedPercent = stats.originalWords
    ? Math.max(0, Math.round((100 * (stats.originalWords - stats.wordsRemoved)) / stats.originalWords))
    : 0;

  return { rows, changes, stats, approximate: script.approximate };
}

type RecordChange = (
  before: string,
  after: string,
  where: Change['where'],
  context: string,
  wholeLines?: boolean,
) => number;

/** Key = kind + texts + how many identical edits came before, e.g. "replace|two|three|0". */
function assignKeys(changes: Change[]): void {
  const seen = new Map<string, number>();
  for (const c of changes) {
    const base = `${c.kind}\u0000${c.before}\u0000${c.after}`;
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    c.key = `${base}\u0000${n}`;
  }
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
    edits: [{ type: 'equal', text: right }],
  };
}

function wholeLineRow(
  type: 'delete' | 'insert',
  text: string,
  leftLine: number | null,
  rightLine: number | null,
  change: number,
): DiffRow {
  const seg: Segment[] = [{ type, text, change }];
  return {
    type,
    leftLine,
    rightLine,
    left: type === 'delete' ? seg : [],
    right: type === 'insert' ? seg : [],
    merged: seg,
    rewritten: false,
    block: 0,
    edits: seg,
  };
}

function changedPair(
  left: string,
  right: string,
  ai: number,
  bi: number,
  options: DiffOptions,
  stats: DiffStats,
  record: RecordChange,
): DiffRow {
  // Word-level diff decides how to show the pair and feeds the statistics in every detail mode.
  const words = inlineDiff(diffTokens(left), diffTokens(right), options, isWhitespace);
  const sameWords = words.deleted === 0 && words.inserted === 0;

  if (words.similarity >= INLINE_SIMILARITY_THRESHOLD && !(sameWords && left === right)) {
    stats.linesChanged++;
    stats.wordsAdded += words.inserted;
    stats.wordsRemoved += words.deleted;
    numberEdits(words.pieces, (before, after) =>
      record(before, after, { side: 'revised', from: bi + 1, to: bi + 1 }, right),
    );
    const edits = toSegments(words.pieces).merged;
    if (options.detail === 'line') return rewrittenRow(left, right, ai, bi, edits);
    const shown = toSegments(
      options.detail === 'char' ? refineByCharacters(words.pieces, options) : words.pieces,
    );
    return {
      type: 'change',
      leftLine: ai + 1,
      rightLine: bi + 1,
      ...shown,
      rewritten: false,
      block: 0,
      edits,
    };
  }
  if (sameWords && options.ignoreWhitespace) {
    // Only ignored differences (e.g. whitespace on a blank line): treat as unchanged.
    stats.linesUnchanged++;
    return equalRow(left, right, ai, bi);
  }
  stats.linesChanged++;
  stats.wordsRemoved += countWords(left);
  stats.wordsAdded += countWords(right);
  const id = record(left, right, { side: 'revised', from: bi + 1, to: bi + 1 }, right, true);
  return rewrittenRow(left, right, ai, bi, [
    { type: 'delete', text: left, change: id },
    { type: 'insert', text: right, change: id },
  ]);
}

/** Gives each edit (a delete, an insert, or a delete followed by an insert) its own change id. */
function numberEdits(pieces: Piece[], record: (before: string, after: string) => number): void {
  for (let i = 0; i < pieces.length; i++) {
    const p = pieces[i];
    if (p.type === 'equal') continue;
    const next = pieces[i + 1];
    if (p.type === 'delete' && next?.type === 'insert') {
      p.change = next.change = record(p.a, next.b);
      i++;
    } else p.change = p.type === 'delete' ? record(p.a, '') : record('', p.b);
  }
}

/** A row drawn as one removed and one added line; `edits` still carries the individual changes. */
function rewrittenRow(left: string, right: string, ai: number, bi: number, edits: Segment[]): DiffRow {
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
    edits,
  };
}

/** One step of an inline diff. Equal pieces keep both texts, which differ when case or spacing is ignored. */
interface Piece {
  type: SegmentType;
  a: string;
  b: string;
  change?: number;
}

interface InlineDiff {
  /** Grouped and tidied: equal runs, and each edit as a delete followed by an insert. */
  pieces: Piece[];
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
  const tidy = trimSharedWhitespace(
    groupPieces(absorbShortEquals(groupPieces(pieces), absorbIfBetweenChanges)),
  );
  const wordsA = aTokens.filter((t) => !isWhitespace(t)).length;
  const wordsB = bTokens.filter((t) => !isWhitespace(t)).length;
  return { pieces: tidy, kept, deleted, inserted, similarity: kept / Math.max(1, wordsA, wordsB) };
}

/** Below this share of shared letters, a reworded word is marked whole rather than letter by letter. */
const CHAR_SIMILARITY_THRESHOLD = 0.5;

/**
 * Character detail: re-diffs each word-level edit letter by letter, but only
 * where the old and new text mostly share letters ("colour" → "color").
 * Different words ("two" → "three") stay marked whole, which reads better
 * than a scatter of single-letter changes.
 */
function refineByCharacters(pieces: Piece[], options: DiffOptions): Piece[] {
  const out: Piece[] = [];
  for (let i = 0; i < pieces.length; i++) {
    const del = pieces[i];
    const ins = pieces[i + 1];
    if (del.type === 'delete' && ins?.type === 'insert') {
      const chars = inlineDiff(
        charTokens(del.a),
        charTokens(ins.b),
        options,
        (t) => isWhitespace(t) || t.length <= 2,
      );
      const shared = chars.pieces.reduce((n, p) => (p.type === 'equal' ? n + Array.from(p.a).length : n), 0);
      const longer = Math.max(Array.from(del.a).length, Array.from(ins.b).length);
      if (shared / longer >= CHAR_SIMILARITY_THRESHOLD) {
        for (const c of chars.pieces) out.push(c.type === 'equal' ? c : { ...c, change: del.change });
        i++;
        continue;
      }
    }
    out.push(del);
  }
  return groupPieces(out);
}

function toSegments(pieces: Piece[]): Pick<DiffRow, 'left' | 'right' | 'merged'> {
  const left: Segment[] = [];
  const right: Segment[] = [];
  const merged: Segment[] = [];
  for (const p of pieces) {
    const change = p.change;
    if (p.type !== 'insert') left.push({ type: p.type, text: p.a, change });
    if (p.type !== 'delete') right.push({ type: p.type, text: p.b, change });
    merged.push({ type: p.type, text: p.type === 'delete' ? p.a : p.b, change });
  }
  return { left, right, merged };
}

/**
 * An unchanged sliver between two edits ("the" in "<del>a</del> the <ins>b</ins>")
 * reads better as part of the edit. Turn such pieces into a delete plus an insert.
 */
function absorbShortEquals(pieces: Piece[], shouldAbsorb: (text: string) => boolean): Piece[] {
  const out: Piece[] = [];
  for (let i = 0; i < pieces.length; i++) {
    const p = pieces[i];
    const between =
      i > 0 && i < pieces.length - 1 && pieces[i - 1].type !== 'equal' && pieces[i + 1].type !== 'equal';
    if (p.type === 'equal' && between && shouldAbsorb(p.a)) {
      out.push({ type: 'delete', a: p.a, b: '' }, { type: 'insert', a: '', b: p.b });
    } else out.push(p);
  }
  return out;
}

/**
 * Moves whitespace that an edit's old and new text both start or end with out
 * of the edit: "from home␣" → "remotely␣" becomes "from home" → "remotely",
 * and "␣" → ", a monitor␣" becomes a plain insertion of ", a monitor".
 */
function trimSharedWhitespace(pieces: Piece[]): Piece[] {
  const out: Piece[] = [];
  for (let i = 0; i < pieces.length; i++) {
    const del = pieces[i];
    const ins = pieces[i + 1];
    if (del.type !== 'delete' || ins?.type !== 'insert') {
      out.push(del);
      continue;
    }
    const lead = commonPrefix(del.a.match(/^\s*/)![0], ins.b.match(/^\s*/)![0]);
    let a = del.a.slice(lead.length);
    let b = ins.b.slice(lead.length);
    const trail = commonSuffix(a.match(/\s*$/)![0], b.match(/\s*$/)![0]);
    a = a.slice(0, a.length - trail.length);
    b = b.slice(0, b.length - trail.length);
    if (lead) out.push({ type: 'equal', a: lead, b: lead });
    if (a) out.push({ type: 'delete', a, b: '' });
    if (b) out.push({ type: 'insert', a: '', b });
    if (trail) out.push({ type: 'equal', a: trail, b: trail });
    i++;
  }
  return groupPieces(out);
}

function commonPrefix(x: string, y: string): string {
  let n = 0;
  while (n < x.length && n < y.length && x[n] === y[n]) n++;
  return x.slice(0, n);
}

function commonSuffix(x: string, y: string): string {
  let n = 0;
  while (n < x.length && n < y.length && x[x.length - 1 - n] === y[y.length - 1 - n]) n++;
  return x.slice(x.length - n);
}

/**
 * Merges neighbours of the same kind and orders each edit run as "all deletions, then all insertions".
 * Edits belonging to different numbered changes are never merged.
 */
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
    const change = pieces[i].change;
    let del = '';
    let ins = '';
    for (; i < pieces.length && pieces[i].type !== 'equal' && pieces[i].change === change; i++) {
      del += pieces[i].a;
      ins += pieces[i].b;
    }
    if (del) out.push({ type: 'delete', a: del, b: '', change });
    if (ins) out.push({ type: 'insert', a: '', b: ins, change });
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

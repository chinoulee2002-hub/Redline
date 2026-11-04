/**
 * Reviewing a diff: the user keeps or rejects each numbered change, then
 * either takes the final text directly or hands a numbered summary to an AI.
 */
import type { Change, DiffRow } from './diff';

/**
 * Rebuilds the text with every change applied except the rejected ones,
 * which revert to the original wording. With nothing rejected this is the
 * new text; with everything rejected, the original (when no ignore options
 * were on; otherwise unchanged lines keep the new text's spacing and case).
 */
export function applyDecisions(rows: DiffRow[], rejected: ReadonlySet<number>): string {
  const isRejected = (change: number | undefined) => change !== undefined && rejected.has(change);
  const lines: string[] = [];
  for (const row of rows) {
    const id = row.edits[0]?.change;
    // Whole removed lines come back only when their removal is rejected; added lines stay only when kept.
    if (row.type === 'delete' && !isRejected(id)) continue;
    if (row.type === 'insert' && isRejected(id)) continue;
    let line = '';
    for (const seg of row.edits) {
      if (seg.type === 'equal') line += seg.text;
      else if ((seg.type === 'delete') === isRejected(seg.change)) line += seg.text;
    }
    lines.push(line);
  }
  return lines.join('\n');
}

/** "#1–#3, #5, #8–#9": consecutive ids collapse into ranges. */
export function formatIds(ids: number[]): string {
  const parts: string[] = [];
  for (let i = 0; i < ids.length; i++) {
    let j = i;
    while (j + 1 < ids.length && ids[j + 1] === ids[j] + 1) j++;
    parts.push(j > i ? `#${ids[i]}–#${ids[j]}` : `#${ids[i]}`);
    i = j;
  }
  return parts.join(', ');
}

export interface PromptOptions {
  /** Append both full texts so the prompt works on its own in a fresh AI chat. */
  attachTexts: boolean;
  original: string;
  revised: string;
}

const CONTEXT_CHARS = 140;

/** The part of `line` around `needle`, cut to about CONTEXT_CHARS with ellipses. */
function snippet(line: string, needle: string): string {
  if (line.length <= CONTEXT_CHARS) return line;
  const at = Math.max(0, needle ? line.indexOf(needle) : 0);
  const start = Math.max(0, Math.min(at - CONTEXT_CHARS / 3, line.length - CONTEXT_CHARS));
  const cut = line.slice(start, start + CONTEXT_CHARS);
  return `${start > 0 ? '…' : ''}${cut}${start + CONTEXT_CHARS < line.length ? '…' : ''}`;
}

export function describeWhere(where: Change['where']): string {
  const lines = where.from === where.to ? `line ${where.from}` : `lines ${where.from}–${where.to}`;
  return where.side === 'original' ? `${lines} of the original` : lines;
}

/** JSON string syntax: exact, with quotes and line breaks escaped, and familiar to any AI. */
const quote = (s: string) => JSON.stringify(s);

function describeChange(c: Change): string {
  switch (c.kind) {
    case 'replace':
      return `replaced ${quote(c.before)} with ${quote(c.after)}`;
    case 'insert':
      return `added ${quote(c.after)}`;
    default:
      return `removed ${quote(c.before)}`;
  }
}

/**
 * Instructions an AI can follow to produce the final text, referring to each
 * change by its id. Changes inside a line also quote the line they are in;
 * whole-line changes already carry their full text.
 */
export function buildReviewPrompt(
  changes: Change[],
  rejected: ReadonlySet<number>,
  options: PromptOptions,
): string {
  const kept = changes.filter((c) => !rejected.has(c.id)).map((c) => c.id);
  const dropped = changes.filter((c) => rejected.has(c.id)).map((c) => c.id);

  const out: string[] = [
    'I compared an original text with a revised version and numbered every change.',
    'Produce the final text:',
    '- Start from the revised text.',
    '- Changes marked KEEP stay exactly as they are in the revised text.',
    '- Changes marked REJECT must be undone: put back the original wording exactly.',
    '- Make no other edits. Reply with the final text only.',
    '',
    `Keep (${kept.length}): ${kept.length ? formatIds(kept) : 'none'}`,
    `Reject (${dropped.length}): ${dropped.length ? formatIds(dropped) : 'none'}`,
    '',
    'Changes:',
  ];
  for (const c of changes) {
    out.push(
      `#${c.id} ${rejected.has(c.id) ? 'REJECT' : 'KEEP'} · ${describeWhere(c.where)} · ${describeChange(c)}`,
    );
    if (!c.wholeLines) out.push(`    in: ${quote(snippet(c.context, c.after || c.before))}`);
  }
  if (options.attachTexts) {
    out.push('', '=== ORIGINAL TEXT ===', options.original, '=== END OF ORIGINAL TEXT ===');
    out.push('', '=== REVISED TEXT ===', options.revised, '=== END OF REVISED TEXT ===');
  }
  return out.join('\n');
}

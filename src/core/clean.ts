/**
 * Text cleaning pipeline. Each step is a small pure function; the user picks
 * which steps run, but they always run in the order of CLEAN_STEPS so the
 * result never depends on the order the boxes were ticked.
 */

export type CleanStepId =
  | 'normalizeUnicode'
  | 'stripHtml'
  | 'stripMarkdown'
  | 'removeInvisible'
  | 'fixSpaces'
  | 'straightenPunctuation'
  | 'removeEmoji'
  | 'asciiOnly'
  | 'removePunctuation'
  | 'removeDigits'
  | 'joinLines'
  | 'removeLineBreaks'
  | 'collapseSpaces'
  | 'trimLines'
  | 'collapseBlankLines'
  | 'removeEmptyLines'
  | 'dedupeLines'
  | 'sortLines';

export type CleanGroup = 'Markup' | 'Characters' | 'Spacing' | 'Lines';

export interface CleanStep {
  id: CleanStepId;
  label: string;
  hint: string;
  group: CleanGroup;
  apply: (text: string) => string;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name: string) => {
    if (name[0] === '#') {
      const code = name[1].toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
      return Number.isFinite(code) && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    }
    return ENTITIES[name.toLowerCase()] ?? whole;
  });
}

function stripHtml(text: string): string {
  return decodeEntities(
    text
      .replace(/<(script|style|head)\b[\s\S]*?<\/\1>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|tr|h[1-6]|blockquote|section|article|header|footer)>/gi, '\n')
      .replace(/<[^>]+>/g, ''),
  );
}

function stripMarkdown(text: string): string {
  return text
    .replace(/^```.*$/gm, '') // code fence lines
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1') // images → alt text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // links → link text
    .replace(/^\s{0,3}#{1,6}\s+/gm, '') // headings
    .replace(/^\s{0,3}>\s?/gm, '') // blockquotes
    .replace(/^\s*(?:[-*+]|\d+[.)])\s+/gm, '') // list markers
    .replace(/^\s*(?:[-*_]\s*){3,}$/gm, '') // horizontal rules
    .replace(/(\*\*|__)(.+?)\1/g, '$2') // bold
    .replace(/(^|[^\w*])[*_]([^*_\n]+)[*_](?=[^\w*]|$)/g, '$1$2') // italics
    .replace(/~~(.+?)~~/g, '$1') // strikethrough
    .replace(/`([^`]+)`/g, '$1'); // inline code
}

function joinLines(text: string): string {
  return text
    .split(/\n[ \t]*\n/) // paragraphs
    .map((para) =>
      para
        .replace(/(\p{L})-\n(\p{Ll})/gu, '$1$2') // re-join words hyphenated across lines (PDF)
        .replace(/[ \t]*\n[ \t]*/g, ' '),
    )
    .join('\n\n');
}

function dedupeLines(text: string): string {
  const seen = new Set<string>();
  return text
    .split('\n')
    .filter((line) => !seen.has(line) && !!seen.add(line))
    .join('\n');
}

const collator = typeof Intl !== 'undefined' ? new Intl.Collator(undefined, { numeric: true }) : null;

export const CLEAN_STEPS: CleanStep[] = [
  {
    id: 'stripHtml',
    label: 'Strip HTML tags',
    hint: 'Keep the text, drop <tags>, decode &amp;',
    group: 'Markup',
    apply: stripHtml,
  },
  {
    id: 'stripMarkdown',
    label: 'Strip Markdown',
    hint: 'Remove #, **, links, list markers',
    group: 'Markup',
    apply: stripMarkdown,
  },
  {
    id: 'normalizeUnicode',
    label: 'Normalize Unicode',
    hint: 'Make look-alike characters identical (NFC)',
    group: 'Characters',
    apply: (t) => t.normalize('NFC'),
  },
  {
    id: 'removeInvisible',
    label: 'Remove invisible characters',
    hint: 'Zero-width spaces, soft hyphens, control codes',
    group: 'Characters',
    // Zero-width chars, soft hyphen, BOM, bidi controls, and C0/C1 controls except tab and newline.
    apply: (t) => t.replace(/[​-‍⁠﻿­‪-‮⁦-⁩]|[\0-\x08\x0b-\x1f\x7f-\x9f]/g, ''),
  },
  {
    id: 'fixSpaces',
    label: 'Replace special spaces',
    hint: 'Non-breaking and other odd spaces → normal space',
    group: 'Characters',
    apply: (t) => t.replace(/[   -   　]/g, ' '),
  },
  {
    id: 'straightenPunctuation',
    label: 'Straighten quotes and dashes',
    hint: '“ ” ‘ ’ → " \' · – — → - · … → ...',
    group: 'Characters',
    apply: (t) =>
      t
        .replace(/[‘’‚‛′]/g, "'")
        .replace(/[“”„‟″]/g, '"')
        .replace(/[–—−]/g, '-')
        .replace(/…/g, '...'),
  },
  {
    id: 'removeEmoji',
    label: 'Remove emoji',
    hint: 'Including flags, skin tones and joined emoji',
    group: 'Characters',
    apply: (t) =>
      t.replace(/\p{Extended_Pictographic}|[\u{1f1e6}-\u{1f1ff}\u{1f3fb}-\u{1f3ff}️⃣]|‍(?=\p{Extended_Pictographic})/gu, ''),
  },
  {
    id: 'asciiOnly',
    label: 'Convert to plain ASCII',
    hint: 'é → e, then drop anything else non-ASCII',
    group: 'Characters',
    apply: (t) =>
      t
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/[^\x00-\x7f]/g, ''),
  },
  {
    id: 'removePunctuation',
    label: 'Remove punctuation',
    hint: 'Periods, commas, quotes, brackets…',
    group: 'Characters',
    apply: (t) => t.replace(/\p{P}/gu, ''),
  },
  {
    id: 'removeDigits',
    label: 'Remove numbers',
    hint: 'Every digit 0–9 and other numerals',
    group: 'Characters',
    apply: (t) => t.replace(/\p{N}/gu, ''),
  },
  {
    id: 'collapseSpaces',
    label: 'Collapse repeated spaces',
    hint: 'Runs of spaces and tabs → one space',
    group: 'Spacing',
    apply: (t) => t.replace(/[ \t]{2,}/g, ' '),
  },
  {
    id: 'trimLines',
    label: 'Trim each line',
    hint: 'Remove spaces at line start and end',
    group: 'Spacing',
    apply: (t) => t.replace(/^[ \t]+|[ \t]+$/gm, ''),
  },
  {
    id: 'joinLines',
    label: 'Join broken lines',
    hint: 'Unwrap lines inside paragraphs (PDF paste)',
    group: 'Lines',
    apply: joinLines,
  },
  {
    id: 'removeLineBreaks',
    label: 'Remove all line breaks',
    hint: 'Put everything on one line',
    group: 'Lines',
    apply: (t) => t.replace(/[ \t]*\n+[ \t]*/g, ' '),
  },
  {
    id: 'collapseBlankLines',
    label: 'Collapse blank lines',
    hint: 'At most one empty line in a row',
    group: 'Lines',
    apply: (t) => t.replace(/\n[ \t]*(?:\n[ \t]*)+\n/g, '\n\n'),
  },
  {
    id: 'removeEmptyLines',
    label: 'Remove empty lines',
    hint: 'Delete every blank line',
    group: 'Lines',
    apply: (t) => t.replace(/^[ \t]*\n/gm, '').replace(/\n[ \t]*$/, ''),
  },
  {
    id: 'dedupeLines',
    label: 'Remove duplicate lines',
    hint: 'Keep the first copy of each line',
    group: 'Lines',
    apply: dedupeLines,
  },
  {
    id: 'sortLines',
    label: 'Sort lines A → Z',
    hint: 'Natural order, so 2 comes before 10',
    group: 'Lines',
    apply: (t) =>
      t
        .split('\n')
        .sort(collator ? collator.compare : undefined)
        .join('\n'),
  },
];

export interface CleanPreset {
  id: string;
  label: string;
  steps: CleanStepId[];
}

export const CLEAN_PRESETS: CleanPreset[] = [
  {
    id: 'pdf',
    label: 'Pasted from PDF',
    steps: ['removeInvisible', 'fixSpaces', 'joinLines', 'collapseSpaces', 'trimLines', 'collapseBlankLines'],
  },
  {
    id: 'word',
    label: 'Pasted from Word',
    steps: ['removeInvisible', 'fixSpaces', 'straightenPunctuation', 'collapseSpaces', 'trimLines', 'collapseBlankLines'],
  },
  {
    id: 'web',
    label: 'Web page HTML',
    steps: ['stripHtml', 'removeInvisible', 'fixSpaces', 'collapseSpaces', 'trimLines', 'collapseBlankLines'],
  },
  {
    id: 'ascii',
    label: 'Plain ASCII',
    steps: ['normalizeUnicode', 'removeInvisible', 'fixSpaces', 'straightenPunctuation', 'removeEmoji', 'asciiOnly', 'collapseSpaces', 'trimLines'],
  },
];

export interface CleanResult {
  text: string;
  /** Steps that were enabled but left the text unchanged, so the UI can say "no effect". */
  noEffect: CleanStepId[];
}

export function cleanText(text: string, enabled: readonly CleanStepId[]): CleanResult {
  const on = new Set(enabled);
  const noEffect: CleanStepId[] = [];
  let out = text.replace(/\r\n?/g, '\n');
  for (const step of CLEAN_STEPS) {
    if (!on.has(step.id)) continue;
    const next = step.apply(out);
    if (next === out) noEffect.push(step.id);
    out = next;
  }
  return { text: out, noEffect };
}

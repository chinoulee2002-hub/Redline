/**
 * Case conversions. Every converter is Unicode-aware (é → É, ß → SS) and
 * keeps line breaks, so multi-line input converts line by line.
 */

export type CaseId =
  | 'upper'
  | 'lower'
  | 'title'
  | 'sentence'
  | 'camel'
  | 'pascal'
  | 'snake'
  | 'kebab'
  | 'constant'
  | 'dot'
  | 'alternating'
  | 'inverse';

export interface CaseFormat {
  id: CaseId;
  label: string;
  group: 'Everyday' | 'Programming' | 'Novelty';
  /** Shown under the label, so users recognise the format before reading the preview. */
  sample: string;
  convert: (text: string) => string;
}

/** Short words kept lowercase in titles unless first or last (a common subset of AP/Chicago rules). */
const SMALL_WORDS = new Set(
  'a an and as at but by en for if in nor of on or per so the to up via vs vs. yet'.split(' '),
);

const WORD = /[\p{L}\p{N}][\p{L}\p{M}\p{N}'’]*/gu;

function capitalize(word: string): string {
  const [first = '', ...rest] = Array.from(word);
  return first.toUpperCase() + rest.join('');
}

/** "iPhone", "NASA", "McDonald": a capital after the first letter means the casing is deliberate. */
function hasDeliberateCaps(word: string): boolean {
  return /\p{Lu}/u.test(Array.from(word).slice(1).join(''));
}

function isAllUpper(text: string): boolean {
  return /\p{Lu}/u.test(text) && !/\p{Ll}/u.test(text);
}

export function toTitleCase(text: string): string {
  // Shouting input ("HELLO WORLD") carries no deliberate caps, so start from lowercase.
  const source = isAllUpper(text) ? text.toLowerCase() : text;
  return source
    .split('\n')
    .map((line) => {
      const matches = [...line.matchAll(WORD)];
      let out = '';
      let last = 0;
      matches.forEach((m, n) => {
        const word = m[0];
        const index = m.index ?? 0;
        const before = line.slice(last, index);
        const afterBreak = /[:.!?—–]\s*$/.test(before) || /[([“"‘]$/.test(before);
        const edge = n === 0 || n === matches.length - 1 || afterBreak;
        // Hyphenated words: "well-known" becomes "Well-Known"; the hyphen is outside WORD.
        const lower = word.toLowerCase();
        let next: string;
        if (hasDeliberateCaps(word)) next = word;
        else if (!edge && SMALL_WORDS.has(lower) && !/-$/.test(before)) next = lower;
        else next = capitalize(lower);
        out += before + next;
        last = index + word.length;
      });
      return out + line.slice(last);
    })
    .join('\n');
}

/** A period after these does not end a sentence. */
const ABBREVIATION_BEFORE = /(?:^|[\s(])(?:i\.e|e\.g|etc|vs|cf|approx|mr|mrs|ms|dr|st|no)$/;

export function toSentenceCase(text: string): string {
  const lower = text.toLowerCase();
  // Capitalise at the start, after sentence punctuation, and at the start of each line.
  return (
    lower
      .replace(/(^|[.!?]\s+|\n\s*)(\p{Ll})/gu, (_, lead: string, letter: string, offset: number) => {
        const afterAbbreviation = lead[0] === '.' && ABBREVIATION_BEFORE.test(lower.slice(0, offset));
        return lead + (afterAbbreviation ? letter : letter.toUpperCase());
      })
      // Standalone "i" becomes "I", but not abbreviations such as "i.e.".
      .replace(/\bi\b(?![.-]\w)(?=[\s,.!?;:'’]|$)/g, 'I')
  );
}

/** Splits identifiers and prose alike: "XMLHttpRequest", "snake_case", "some words" → word lists. */
export function splitIdentifierWords(text: string): string[] {
  return (
    text
      .replace(/['’]/g, '')
      .match(/\p{Lu}+(?=\p{Lu}\p{Ll})|\p{Lu}?\p{Ll}+\p{M}*|\p{Lu}+\p{M}*|\p{N}+|[\p{L}\p{M}]+/gu) ?? []
  );
}

function perLine(text: string, fn: (words: string[]) => string): string {
  return text
    .split('\n')
    .map((line) => fn(splitIdentifierWords(line)))
    .join('\n');
}

const lowerAll = (words: string[]) => words.map((w) => w.toLowerCase());

export const CASE_FORMATS: CaseFormat[] = [
  {
    id: 'upper',
    label: 'UPPERCASE',
    group: 'Everyday',
    sample: 'HELLO WORLD',
    convert: (t) => t.toUpperCase(),
  },
  {
    id: 'lower',
    label: 'lowercase',
    group: 'Everyday',
    sample: 'hello world',
    convert: (t) => t.toLowerCase(),
  },
  {
    id: 'title',
    label: 'Title Case',
    group: 'Everyday',
    sample: 'The Lord of the Rings',
    convert: toTitleCase,
  },
  {
    id: 'sentence',
    label: 'Sentence case',
    group: 'Everyday',
    sample: 'Hello world. Bye now.',
    convert: toSentenceCase,
  },
  {
    id: 'camel',
    label: 'camelCase',
    group: 'Programming',
    sample: 'helloWorld',
    convert: (t) =>
      perLine(t, (w) =>
        lowerAll(w)
          .map((x, i) => (i ? capitalize(x) : x))
          .join(''),
      ),
  },
  {
    id: 'pascal',
    label: 'PascalCase',
    group: 'Programming',
    sample: 'HelloWorld',
    convert: (t) => perLine(t, (w) => lowerAll(w).map(capitalize).join('')),
  },
  {
    id: 'snake',
    label: 'snake_case',
    group: 'Programming',
    sample: 'hello_world',
    convert: (t) => perLine(t, (w) => lowerAll(w).join('_')),
  },
  {
    id: 'kebab',
    label: 'kebab-case',
    group: 'Programming',
    sample: 'hello-world',
    convert: (t) => perLine(t, (w) => lowerAll(w).join('-')),
  },
  {
    id: 'constant',
    label: 'CONSTANT_CASE',
    group: 'Programming',
    sample: 'HELLO_WORLD',
    convert: (t) => perLine(t, (w) => w.map((x) => x.toUpperCase()).join('_')),
  },
  {
    id: 'dot',
    label: 'dot.case',
    group: 'Programming',
    sample: 'hello.world',
    convert: (t) => perLine(t, (w) => lowerAll(w).join('.')),
  },
  {
    id: 'alternating',
    label: 'aLtErNaTiNg',
    group: 'Novelty',
    sample: 'hElLo wOrLd',
    convert: (t) => {
      let n = 0;
      return Array.from(t)
        .map((c) => (c.toLowerCase() === c.toUpperCase() ? c : n++ % 2 ? c.toUpperCase() : c.toLowerCase()))
        .join('');
    },
  },
  {
    id: 'inverse',
    label: 'iNVERSE',
    group: 'Novelty',
    sample: 'hELLO wORLD',
    convert: (t) =>
      Array.from(t)
        .map((c) => (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase()))
        .join(''),
  },
];

export function convertCase(text: string, id: CaseId): string {
  const format = CASE_FORMATS.find((f) => f.id === id);
  if (!format) throw new Error(`Unknown case format: ${id}`);
  return format.convert(text);
}

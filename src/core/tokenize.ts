/**
 * Shared text-splitting helpers. Pure functions, no DOM access.
 */

/** True for any Unicode whitespace code unit that `\s` matches in JavaScript regexes. */
function isSpace(code: number): boolean {
  return (
    code === 32 ||
    (code >= 9 && code <= 13) ||
    code === 0xa0 ||
    code === 0x1680 ||
    (code >= 0x2000 && code <= 0x200a) ||
    code === 0x2028 ||
    code === 0x2029 ||
    code === 0x202f ||
    code === 0x205f ||
    code === 0x3000 ||
    code === 0xfeff
  );
}

/**
 * Counts runs of non-whitespace characters. Loops over the string instead of
 * using a regex so it allocates nothing; cheap enough to run on every keystroke.
 */
export function countWords(text: string): number {
  let count = 0;
  let inWord = false;
  for (let i = 0; i < text.length; i++) {
    const space = isSpace(text.charCodeAt(i));
    if (!space && !inWord) count++;
    inWord = !space;
  }
  return count;
}

export function countLines(text: string): number {
  if (text === '') return 0;
  let lines = 1;
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) lines++;
  return lines;
}

/** Number of user-visible characters (code points, so an emoji counts once). */
export function countChars(text: string): number {
  let count = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    // Skip the low half of a surrogate pair.
    if (code < 0xdc00 || code > 0xdfff) count++;
  }
  return count;
}

export function normalizeNewlines(text: string): string {
  return text.replace(/\r\n?/g, '\n');
}

export function isWhitespace(token: string): boolean {
  return /^\s+$/.test(token);
}

/**
 * Splits a line into diff tokens: whitespace runs, words (letters/digits, with
 * inner apostrophes or hyphens such as "don't" or "well-known"), and single
 * punctuation marks. Joining the tokens gives back the original line exactly.
 */
const DIFF_TOKEN = /\s+|[\p{L}\p{N}_]+(?:['’-][\p{L}\p{N}_]+)*|[^\s\p{L}\p{N}_]/gu;

export function diffTokens(line: string): string[] {
  return line.match(DIFF_TOKEN) ?? [];
}

/** Splits a line into code points, so emoji and accented letters stay whole. */
export function charTokens(line: string): string[] {
  return Array.from(line);
}

export interface WordSegment {
  /** The segment text. */
  text: string;
  /** True for words, false for spaces and punctuation between them. */
  isWord: boolean;
}

const FALLBACK_SEGMENT = /[\p{L}\p{M}\p{N}]+(?:['’][\p{L}\p{M}\p{N}]+)*|[^\p{L}\p{M}\p{N}]+/gu;

/**
 * Splits text into words and the gaps between them using `Intl.Segmenter`,
 * which knows word boundaries for most languages (including ones written
 * without spaces, such as Japanese). Falls back to a regex where unsupported.
 */
export function segmentWords(text: string, locale?: string): WordSegment[] {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const segmenter = new Intl.Segmenter(locale, { granularity: 'word' });
    const out: WordSegment[] = [];
    for (const s of segmenter.segment(text)) out.push({ text: s.segment, isWord: !!s.isWordLike });
    return out;
  }
  return (text.match(FALLBACK_SEGMENT) ?? []).map((t) => ({ text: t, isWord: /[\p{L}\p{N}]/u.test(t) }));
}

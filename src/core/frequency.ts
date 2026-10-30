/**
 * Word and phrase frequency analysis.
 */
import { ENGLISH_STOPWORDS } from './stopwords';
import { segmentWords } from './tokenize';

export interface FrequencyOptions {
  ignoreCase: boolean;
  excludeStopwords: boolean;
  /** Extra words to exclude, on top of the built-in list. Compared case-insensitively. */
  customStopwords: string[];
  includeNumbers: boolean;
  /** Words shorter than this (in characters) are skipped. */
  minLength: number;
  /** 1 counts single words, 2 two-word phrases, 3 three-word phrases. */
  phraseLength: 1 | 2 | 3;
}

export interface FrequencyEntry {
  term: string;
  count: number;
  /** Share of all counted terms, 0–1. */
  share: number;
}

export interface FrequencyTotals {
  words: number;
  uniqueWords: number;
  /** uniqueWords / words: how varied the vocabulary is, 0–1. */
  diversity: number;
  averageWordLength: number;
  sentences: number;
  /** At 238 words per minute, the average adult silent-reading speed. */
  readingMinutes: number;
}

export interface FrequencyResult {
  totals: FrequencyTotals;
  /** Sorted by count (highest first), then alphabetically. */
  entries: FrequencyEntry[];
  /** Number of terms (words or phrases) counted after filtering. */
  counted: number;
}

const READING_WPM = 238;

export function analyzeFrequency(text: string, options: FrequencyOptions): FrequencyResult {
  const custom = new Set(options.customStopwords.map((w) => w.trim().toLowerCase()).filter(Boolean));
  const isStop = (lower: string) =>
    (options.excludeStopwords && ENGLISH_STOPWORDS.has(lower)) || custom.has(lower);
  const fold = (w: string) => (options.ignoreCase ? w.toLowerCase() : w);

  // Pass 1: words, plus a marker wherever a phrase must not continue (sentence breaks).
  const words: string[] = [];
  const breakBefore: boolean[] = [];
  let pendingBreak = true;
  let sentences = 0;
  let lengthSum = 0;
  const unique = new Set<string>();
  for (const seg of segmentWords(text)) {
    if (!seg.isWord) {
      if (/[.!?;:\n]/.test(seg.text)) pendingBreak = true;
      if (/[.!?]/.test(seg.text)) sentences++;
      continue;
    }
    const word = seg.text.replace(/’/g, "'");
    words.push(word);
    breakBefore.push(pendingBreak);
    pendingBreak = false;
    lengthSum += Array.from(word).length;
    unique.add(fold(word));
  }
  // A final sentence without closing punctuation still counts.
  if (words.length && !/[.!?]\s*$/.test(text)) sentences++;

  // Pass 2: count terms that pass the filters.
  const passes = (word: string) => {
    if (Array.from(word).length < options.minLength) return false;
    if (!options.includeNumbers && /^[\p{N}.,]+$/u.test(word)) return false;
    return !isStop(word.toLowerCase());
  };
  const counts = new Map<string, number>();
  let counted = 0;
  const n = options.phraseLength;
  for (let i = 0; i + n <= words.length; i++) {
    // A phrase may not span a sentence break.
    let crosses = false;
    for (let k = 1; k < n; k++) if (breakBefore[i + k]) crosses = true;
    if (crosses) continue;
    // Single words must pass the filters; phrases only need to start and end on a meaningful word,
    // which keeps phrases such as "terms of service".
    if (!passes(words[i]) || !passes(words[i + n - 1])) continue;
    const term = fold(words.slice(i, i + n).join(' '));
    counts.set(term, (counts.get(term) ?? 0) + 1);
    counted++;
  }

  const entries: FrequencyEntry[] = [];
  for (const [term, count] of counts) entries.push({ term, count, share: counted ? count / counted : 0 });
  entries.sort((x, y) => y.count - x.count || x.term.localeCompare(y.term));

  return {
    totals: {
      words: words.length,
      uniqueWords: unique.size,
      diversity: words.length ? unique.size / words.length : 0,
      averageWordLength: words.length ? lengthSum / words.length : 0,
      sentences,
      readingMinutes: words.length / READING_WPM,
    },
    entries,
    counted,
  };
}

/** CSV with a header row; quotes every term so commas and quotes inside phrases survive. */
export function frequencyToCsv(entries: FrequencyEntry[]): string {
  const rows = entries.map(
    (e, i) => `${i + 1},"${e.term.replace(/"/g, '""')}",${e.count},${(e.share * 100).toFixed(2)}`,
  );
  return ['rank,term,count,percent', ...rows].join('\n');
}

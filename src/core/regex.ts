/**
 * Regular-expression evaluation for the playground.
 *
 * Runs inside a worker in the app (see workers/): a pathological pattern can
 * take exponential time, and only a worker can be stopped mid-match.
 */

/** Flags the playground exposes. 'd' (match indices) is always added internally. */
export const REGEX_FLAGS = ['g', 'i', 'm', 's', 'u', 'y'] as const;
export type RegexFlag = (typeof REGEX_FLAGS)[number];

export interface RegexRequest {
  pattern: string;
  flags: string;
  text: string;
  /** When set, the result includes the text with matches replaced. */
  replacement: string | null;
  /** Stop collecting after this many matches; the count keeps going up to a hard limit. */
  maxMatches: number;
}

export interface RegexGroup {
  /** Group number (1-based) or name. */
  name: string;
  value: string | undefined;
  start: number | undefined;
  end: number | undefined;
}

export interface RegexMatch {
  index: number;
  end: number;
  text: string;
  groups: RegexGroup[];
}

export type RegexResult =
  | {
      ok: true;
      matches: RegexMatch[];
      /** Matches found; may be more than `matches.length`. */
      total: number;
      /** Counting stopped at the hard limit, so `total` is a lower bound. */
      totalCapped: boolean;
      groupNames: string[];
      replaced: string | null;
      elapsedMs: number;
    }
  | { ok: false; error: string };

/** Beyond this, counting stops: a million matches is never something a person reads. */
const HARD_MATCH_LIMIT = 1_000_000;

export function runRegex(req: RegexRequest): RegexResult {
  const started = now();
  let re: RegExp;
  try {
    re = new RegExp(req.pattern, dedupeFlags(req.flags + 'd'));
  } catch (e) {
    return { ok: false, error: (e as Error).message.replace(/^Invalid regular expression: /, '') };
  }

  const groupNames = groupLabels(re);
  const matches: RegexMatch[] = [];
  let total = 0;
  if (req.pattern !== '') {
    if (!re.global) {
      const m = re.exec(req.text);
      if (m) {
        total = 1;
        matches.push(toMatch(m, groupNames));
      }
    } else {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(req.text)) !== null) {
        total++;
        if (matches.length < req.maxMatches) matches.push(toMatch(m, groupNames));
        // An empty match would loop forever at the same position.
        if (m[0] === '') re.lastIndex = advance(req.text, re.lastIndex, re.unicode);
        if (total >= HARD_MATCH_LIMIT) break;
      }
    }
  }

  let replaced: string | null = null;
  if (req.replacement !== null && req.pattern !== '') {
    re.lastIndex = 0;
    replaced = req.text.replace(re, req.replacement);
  }

  return {
    ok: true,
    matches,
    total,
    totalCapped: total >= HARD_MATCH_LIMIT,
    groupNames,
    replaced,
    elapsedMs: now() - started,
  };
}

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function dedupeFlags(flags: string): string {
  return [...new Set(flags)].join('');
}

/** Moves past an empty match, stepping over a whole surrogate pair in Unicode mode. */
function advance(text: string, index: number, unicode: boolean): number {
  if (unicode && index < text.length) {
    const code = text.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) return index + 2;
  }
  return index + 1;
}

/** Labels for capture groups in order: the name when the group has one, otherwise its number. */
function groupLabels(re: RegExp): string[] {
  // Matching an empty string against `pattern|` always succeeds and reveals the group count.
  const probe = new RegExp(`${re.source}|`, re.flags.replace(/[gy]/g, '')).exec('');
  const count = probe ? probe.length - 1 : 0;
  const labels = Array.from({ length: count }, (_, i) => String(i + 1));
  const names = scanGroupNames(re.source);
  // The scan is a best effort; only trust it when it agrees with the engine on the count.
  if (names.length === count) names.forEach((name, i) => name && (labels[i] = name));
  return labels;
}

/** Walks the pattern source and lists capturing groups in order (null for unnamed ones). */
function scanGroupNames(source: string): (string | null)[] {
  const names: (string | null)[] = [];
  let inClass = false;
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (c === '\\') {
      i++;
      continue;
    }
    if (inClass) {
      if (c === ']') inClass = false;
      continue;
    }
    if (c === '[') inClass = true;
    else if (c === '(') {
      if (source[i + 1] !== '?') names.push(null);
      else if (source[i + 2] === '<' && source[i + 3] !== '=' && source[i + 3] !== '!') {
        names.push(source.slice(i + 3, source.indexOf('>', i)));
      }
    }
  }
  return names;
}

function toMatch(m: RegExpExecArray, labels: string[]): RegexMatch {
  const groups: RegexGroup[] = [];
  for (let g = 1; g < m.length; g++) {
    const span = m.indices?.[g];
    groups.push({ name: labels[g - 1] ?? String(g), value: m[g], start: span?.[0], end: span?.[1] });
  }
  return { index: m.index, end: m.index + m[0].length, text: m[0], groups };
}

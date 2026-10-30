import { batch, signal } from '@preact/signals';
import { persistedSignal } from '../../lib/storage';
import { TaskRunner } from '../../workers/runner';
import type { SentText } from '../types';

const EXAMPLE_PATTERN = '(?<user>[\\w.+-]+)@(?<domain>[\\w-]+(?:\\.[\\w-]+)+)';
const EXAMPLE_TEXT = `Contact list (updated Monday)

Ana Pereira <ana.pereira@example.com> — design lead
Ben Okafor: ben+newsletter@mail.example.org
Support desk: help@example.co.uk, or call +1 555 0100
Invalid entries: ana@, @example.com, ben@localhost`;

/** A pattern that runs longer than this is stopped: it is almost certainly backtracking catastrophically. */
export const REGEX_TIMEOUT_MS = 300;
/** Matches drawn in the editor and listed; counting continues past it. */
export const MAX_SHOWN_MATCHES = 5000;

export const pattern = persistedSignal('regex.pattern', EXAMPLE_PATTERN);
export const flags = persistedSignal('regex.flags', 'g');
export const text = persistedSignal('regex.text', EXAMPLE_TEXT);
export const replaceOn = persistedSignal('regex.replaceOn', false);
export const replacement = persistedSignal('regex.replacement', '$<user> at $<domain>');
/** Index of the match selected in the list, or -1. */
export const selectedMatch = signal(-1);

export const regexRunner = new TaskRunner(REGEX_TIMEOUT_MS);

export function toggleFlag(flag: string): void {
  let next = flags.value.includes(flag) ? flags.value.replace(flag, '') : flags.value + flag;
  // 'u' and 'v' cannot be combined; the UI only offers 'u', but saved state might hold either.
  if (flag === 'u') next = next.replace('v', '');
  flags.value = [...next].sort().join('');
}

export function loadExample(): void {
  batch(() => {
    pattern.value = EXAMPLE_PATTERN;
    flags.value = 'g';
    text.value = EXAMPLE_TEXT;
  });
}

export function receive(input: SentText): void {
  batch(() => {
    text.value = input.text;
    if (input.pattern !== undefined) pattern.value = input.pattern;
    if (input.flags !== undefined) flags.value = input.flags;
  });
}

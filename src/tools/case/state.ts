import type { CaseId } from '../../core/case';
import { persistedSignal } from '../../lib/storage';
import { TaskRunner } from '../../workers/runner';
import type { SentText } from '../types';

const EXAMPLE = `the quick brown fox jumps over the lazy dog. it's a well-known pangram used by type designers.
a guide to the iPhone and NASA's moon missions
user account id
XMLHttpRequest handler`;

export const input = persistedSignal('case.input', EXAMPLE);
export const format = persistedSignal<CaseId>('case.format', 'title');
export const caseRunner = new TaskRunner();

export function loadExample(): void {
  input.value = EXAMPLE;
}

export function receive({ text }: SentText): void {
  input.value = text;
}

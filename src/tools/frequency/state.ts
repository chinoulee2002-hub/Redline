import type { FrequencyOptions } from '../../core/frequency';
import { persistedSignal } from '../../lib/storage';
import { TaskRunner } from '../../workers/runner';
import type { SentText } from '../types';

const EXAMPLE = `Good writing is clear writing. Clear writing starts with clear thinking: if you know what you want to say, the words follow. Most unclear writing comes from writers who have not yet decided what they think.

Short sentences help. So do familiar words. Long words and long sentences make readers work harder, and tired readers stop reading. Every word should earn its place. Cut the words that do no work, and the words that remain will be stronger.

Read your writing aloud. Your ear will catch what your eye misses: the clumsy rhythm, the repeated word, the sentence that never ends. Then rewrite. Good writing is rewriting.`;

export interface FrequencySettings extends Omit<FrequencyOptions, 'customStopwords'> {
  /** Raw text of the "also skip" field, split on commas and spaces when analysing. */
  customStopwords: string;
}

export const input = persistedSignal('frequency.input', EXAMPLE);
export const settings = persistedSignal<FrequencySettings>('frequency.settings', {
  ignoreCase: true,
  excludeStopwords: true,
  customStopwords: '',
  includeNumbers: false,
  minLength: 1,
  phraseLength: 1,
});
export const frequencyRunner = new TaskRunner();

export function updateSettings(patch: Partial<FrequencySettings>): void {
  settings.value = { ...settings.value, ...patch };
}

export function toOptions(s: FrequencySettings): FrequencyOptions {
  return { ...s, customStopwords: s.customStopwords.split(/[\s,]+/).filter(Boolean) };
}

export function loadExample(): void {
  input.value = EXAMPLE;
}

export function receive({ text }: SentText): void {
  input.value = text;
}

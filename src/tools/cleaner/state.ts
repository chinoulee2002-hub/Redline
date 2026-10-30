import { CLEAN_PRESETS, type CleanStepId } from '../../core/clean';
import { persistedSignal } from '../../lib/storage';
import { TaskRunner } from '../../workers/runner';
import type { SentText } from '../types';

// Contains the usual copy-paste debris: hard line wraps, a hyphenated break, double spaces,
// non-breaking and zero-width spaces, smart quotes and stacked blank lines.
const EXAMPLE = `  Quarterly   report — draft\u00a0v2  



The team shipped the new on-
boarding flow in March.   Sign-ups grew
by 18% compared with the previous quarter,
and churn fell for the third month in a row.\u200b


“We expect the trend to continue,” said the head of growth. 🚀



Next steps:   finalize pricing,   update the help centre.
Next steps:   finalize pricing,   update the help centre.`;

export const input = persistedSignal('cleaner.input', EXAMPLE);
export const steps = persistedSignal<CleanStepId[]>('cleaner.steps', CLEAN_PRESETS[0].steps);
export const cleanRunner = new TaskRunner();

export function toggleStep(id: CleanStepId, on: boolean): void {
  steps.value = on ? [...steps.value, id] : steps.value.filter((s) => s !== id);
}

export function loadExample(): void {
  input.value = EXAMPLE;
}

export function receive({ text }: SentText): void {
  input.value = text;
}

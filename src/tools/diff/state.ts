import { batch, signal } from '@preact/signals';
import type { DiffDetail } from '../../core/diff';
import { persistedSignal } from '../../lib/storage';
import { TaskRunner } from '../../workers/runner';
import type { SentText } from '../types';
import { EXAMPLE_ORIGINAL, EXAMPLE_REVISED } from './example';

export type DiffView = 'side' | 'single';
/** What the review box shows: instructions for an AI, or the final text with decisions applied. */
export type Handoff = 'prompt' | 'final';

export interface DiffSettings {
  ignoreWhitespace: boolean;
  ignoreCase: boolean;
  detail: DiffDetail;
  view: DiffView;
  hideUnchanged: boolean;
  handoff: Handoff;
  /** Append both full texts to the AI instructions. */
  attachTexts: boolean;
}

export const original = persistedSignal('diff.original', EXAMPLE_ORIGINAL);
export const revised = persistedSignal('diff.revised', EXAMPLE_REVISED);
export const originalName = signal('');
export const revisedName = signal('');

export const settings = persistedSignal<DiffSettings>('diff.settings', {
  ignoreWhitespace: true,
  ignoreCase: false,
  detail: 'word',
  view: 'side',
  hideUnchanged: true,
  handoff: 'prompt',
  attachTexts: true,
});

/**
 * Keys (see `Change.key`) of the changes the user rejected. Everything else is kept.
 * Keys rather than ids, so decisions survive edits elsewhere in the text.
 */
export const rejectedKeys = persistedSignal<string[]>('diff.rejected', []);

export function setRejected(keys: string[], reject: boolean): void {
  const set = new Set(rejectedKeys.value);
  for (const key of keys) {
    if (reject) set.add(key);
    else set.delete(key);
  }
  rejectedKeys.value = [...set];
}

export function updateSettings(patch: Partial<DiffSettings>): void {
  settings.value = { ...settings.value, ...patch };
}

export const diffRunner = new TaskRunner();

export function swapSides(): void {
  batch(() => {
    [original.value, revised.value] = [revised.value, original.value];
    [originalName.value, revisedName.value] = [revisedName.value, originalName.value];
  });
}

export function loadExample(): void {
  batch(() => {
    original.value = EXAMPLE_ORIGINAL;
    revised.value = EXAMPLE_REVISED;
    originalName.value = 'Example: policy v1';
    revisedName.value = 'Example: policy v2';
  });
}

/** With an `original` (e.g. from the Cleaner), compare before and after; otherwise fill the new side. */
export function receive(input: SentText): void {
  batch(() => {
    if (input.original !== undefined) {
      original.value = input.original;
      originalName.value = 'Before';
      revisedName.value = 'After';
    } else revisedName.value = 'Sent from another tool';
    revised.value = input.text;
  });
}

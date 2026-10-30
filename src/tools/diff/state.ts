import { batch, signal } from '@preact/signals';
import type { DiffDetail } from '../../core/diff';
import { persistedSignal } from '../../lib/storage';
import { TaskRunner } from '../../workers/runner';
import type { SentText } from '../types';
import { EXAMPLE_ORIGINAL, EXAMPLE_REVISED } from './example';

export type DiffView = 'side' | 'single';

export interface DiffSettings {
  ignoreWhitespace: boolean;
  ignoreCase: boolean;
  detail: DiffDetail;
  view: DiffView;
  hideUnchanged: boolean;
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
});

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

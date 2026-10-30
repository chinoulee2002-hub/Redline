import { effect } from '@preact/signals';
import { persistedSignal } from './storage';

export type ThemePreference = 'system' | 'light' | 'dark';

export const theme = persistedSignal<ThemePreference>('theme', 'system', 0);

// index.html applies the saved theme before first paint; this keeps it in sync afterwards.
effect(() => {
  const root = document.documentElement;
  if (theme.value === 'system') delete root.dataset.theme;
  else root.dataset.theme = theme.value;
});

const ORDER: ThemePreference[] = ['system', 'light', 'dark'];

export function cycleTheme(): void {
  theme.value = ORDER[(ORDER.indexOf(theme.value) + 1) % ORDER.length];
}

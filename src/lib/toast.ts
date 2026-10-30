import { signal } from '@preact/signals';

export interface Toast {
  id: number;
  message: string;
  tone: 'info' | 'error';
}

export const toasts = signal<Toast[]>([]);
let nextId = 1;

/** Shows a short message at the bottom of the screen for a few seconds. */
export function showToast(message: string, tone: Toast['tone'] = 'info'): void {
  const toast = { id: nextId++, message, tone };
  toasts.value = [...toasts.value.slice(-2), toast];
  setTimeout(() => {
    toasts.value = toasts.value.filter((t) => t.id !== toast.id);
  }, 2600);
}

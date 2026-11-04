/**
 * Browser storage that never throws. Storage can be missing or blocked
 * (private windows, strict privacy settings, sandboxed previews), so every
 * access is guarded and the app simply starts fresh when it fails.
 */
import { effect, signal, type Signal } from '@preact/signals';

const PREFIX = 'redline:v1:';
/** Larger texts are not saved: storage quotas are small (about 5 MB) and writes would stutter. */
const MAX_STORED_CHARS = 200_000;

export function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw === null) return fallback;
    const value: unknown = JSON.parse(raw);
    if (isPlainObject(fallback)) {
      if (!isPlainObject(value)) return fallback;
      // Take each saved setting only if it has the default's type, so settings added in later
      // versions get their default and damaged values can't crash the app.
      const merged: Record<string, unknown> = { ...fallback };
      for (const k of Object.keys(fallback))
        if (k in value && sameShape(value[k], fallback[k])) merged[k] = value[k];
      return merged as T;
    }
    return sameShape(value, fallback) ? (value as T) : fallback;
  } catch {
    return fallback;
  }
}

/** Same JSON type: arrays only match arrays, objects only objects, and so on. */
function sameShape(value: unknown, like: unknown): boolean {
  if (Array.isArray(like)) return Array.isArray(value);
  if (like === null || value === null) return like === value;
  return typeof value === typeof like && Array.isArray(value) === false;
}

/** Deletes saved values whose key starts with `prefix` (all of Redline's when empty). */
export function clearStored(prefix = ''): void {
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith(PREFIX + prefix)) localStorage.removeItem(k);
  } catch {
    /* Storage unavailable: nothing to clear. */
  }
}

export function writeStored(key: string, value: unknown): void {
  try {
    const raw = JSON.stringify(value);
    if (raw.length > MAX_STORED_CHARS) localStorage.removeItem(PREFIX + key);
    else localStorage.setItem(PREFIX + key, raw);
  } catch {
    /* Storage unavailable or full: keep working without it. */
  }
}

/** Writes waiting for their debounce delay, flushed if the page is closed first. */
const pendingWrites = new Map<string, unknown>();

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    for (const [key, value] of pendingWrites) writeStored(key, value);
    pendingWrites.clear();
  });
}

/** A signal whose value is restored on load and saved shortly after each change. */
export function persistedSignal<T>(key: string, initial: T, delayMs = 300): Signal<T> {
  const s = signal<T>(readStored(key, initial));
  let timer: ReturnType<typeof setTimeout> | undefined;
  let first = true;
  effect(() => {
    const value = s.value;
    if (first) {
      first = false;
      return;
    }
    pendingWrites.set(key, value);
    clearTimeout(timer);
    timer = setTimeout(() => {
      pendingWrites.delete(key);
      writeStored(key, value);
    }, delayMs);
  });
  return s;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

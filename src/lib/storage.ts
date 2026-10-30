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
    const value = JSON.parse(raw) as T;
    // Merge saved objects over defaults so settings added in later versions get their default.
    if (isPlainObject(fallback) && isPlainObject(value)) return { ...fallback, ...value };
    return typeof value === typeof fallback ? value : fallback;
  } catch {
    return fallback;
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

/**
 * Hash routing: "#regex" shows the regex tool. Hashes work from file:// and need no server.
 * Plain names (not "#/regex") also survive hosts such as claude.ai that keep only "#name";
 * older "#/regex" links still work.
 */
import { signal } from '@preact/signals';

function readHash(): string {
  return location.hash.replace(/^#\/?/, '').split(/[/?]/)[0] ?? '';
}

export const route = signal(readHash());

window.addEventListener('hashchange', () => {
  route.value = readHash();
});

export function navigate(id: string): void {
  if (readHash() !== id) location.hash = id;
}

/** Hash routing: "#/regex" shows the regex tool. Hashes work from file:// and need no server. */
import { signal } from '@preact/signals';

function readHash(): string {
  return location.hash.replace(/^#\/?/, '').split(/[/?]/)[0] ?? '';
}

export const route = signal(readHash());

window.addEventListener('hashchange', () => {
  route.value = readHash();
});

export function navigate(id: string): void {
  if (readHash() !== id) location.hash = '/' + id;
}

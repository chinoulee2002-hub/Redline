const numberFormat = new Intl.NumberFormat();

export function formatNumber(n: number): string {
  return numberFormat.format(n);
}

/** "1 word", "2 words". */
export function plural(n: number, one: string, many = one + 's'): string {
  return `${formatNumber(n)} ${n === 1 ? one : many}`;
}

export function formatPercent(share: number, digits = 1): string {
  return `${(share * 100).toFixed(digits)}%`;
}

export function formatMinutes(minutes: number): string {
  if (minutes < 1) return `${Math.max(1, Math.round(minutes * 60))} sec`;
  return `${Math.round(minutes)} min`;
}

/** Shortcut label for the current platform: "⌘K" on Apple devices, "Ctrl K" elsewhere. */
export const MOD_KEY = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl ';

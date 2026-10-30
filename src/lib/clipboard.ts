import { showToast } from './toast';

/** Copies text and confirms with a toast. Falls back to execCommand where the async API is blocked. */
export async function copyText(text: string, what = 'Copied'): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
    document.body.append(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    if (!ok) {
      showToast('Copy was blocked by the browser. Select the text and copy it manually.', 'error');
      return;
    }
  }
  showToast(what === 'Copied' ? 'Copied to clipboard' : what);
}

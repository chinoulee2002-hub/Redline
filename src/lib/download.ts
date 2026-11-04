/**
 * Saving text as a file. In a normal browser this is a temporary download
 * link. Inside a claude.ai artifact, where pages may not start downloads
 * themselves, the file goes through the host's "downloads" capability,
 * which asks the viewer to confirm.
 */
import { showToast } from './toast';

interface HostSaver {
  save(request: { filename: string; data: string }): Promise<unknown>;
}
interface ClaudeHost {
  use(name: 'downloads'): Promise<HostSaver | null>;
}

/** Asked once at startup, so a click never waits on the host. Resolves null outside claude.ai. */
const hostSaver: Promise<HostSaver | null> = (() => {
  const claude = (window as { claude?: ClaudeHost }).claude;
  if (!claude?.use) return Promise.resolve(null);
  return claude.use('downloads').catch(() => null);
})();

export async function downloadText(filename: string, text: string, type = 'text/plain'): Promise<void> {
  const host = await hostSaver;
  if (host) {
    try {
      await host.save({ filename, data: text });
    } catch (e) {
      // The viewer said no: nothing to report. Anything else means saving is off in this view.
      if ((e as { code?: string }).code !== 'declined') {
        showToast('Saving files isn’t available here. Use Copy instead.', 'error');
      }
    }
    return;
  }
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

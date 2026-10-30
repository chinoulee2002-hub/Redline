import { toasts } from '../lib/toast';
import { Icon } from './Icon';

export function Toasts() {
  return (
    <div class="toasts" role="status" aria-live="polite">
      {toasts.value.map((t) => (
        <div key={t.id} class={`toast toast--${t.tone}`}>
          <Icon name={t.tone === 'error' ? 'alert' : 'check'} />
          {t.message}
        </div>
      ))}
    </div>
  );
}

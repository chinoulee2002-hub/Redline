import { useEffect, useRef, useState } from 'preact/hooks';
import { getTools, sendTo } from '../tools/workspace';
import type { SentText } from '../tools/types';
import { Button } from './Button';
import { Icon } from './Icon';

/** "Send to" button with a menu of the other tools that accept text. */
export function SendToMenu({ from, payload, disabled }: { from: string; payload: () => SentText; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const targets = getTools().filter((t) => t.id !== from && t.receive);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    root.current?.querySelector<HTMLButtonElement>('.menu button')?.focus();
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  return (
    <div class="menu-anchor" ref={root}>
      <Button
        size="sm"
        variant="ghost"
        icon="send"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        Send to
      </Button>
      {open && (
        <div class="menu" role="menu">
          {targets.map((t) => (
            <button
              key={t.id}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                sendTo(t.id, payload());
              }}
            >
              <Icon name={t.icon} />
              {t.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

import { getTools, sendTo } from '../tools/workspace';
import type { SentText } from '../tools/types';
import { Button } from './Button';
import { Icon } from './Icon';
import { usePopover } from './usePopover';

/** "Send to" button with a menu of the other tools that accept text. */
export function SendToMenu({
  from,
  payload,
  disabled,
}: {
  from: string;
  payload: () => SentText;
  disabled?: boolean;
}) {
  const { open, setOpen, root } = usePopover<HTMLDivElement>();
  const targets = getTools().filter((t) => t.id !== from && t.receive);

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

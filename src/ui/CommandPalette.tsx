/** Ctrl/⌘+K: a search box for jumping to any tool or running a common action. */
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { navigate } from '../lib/router';
import { theme } from '../lib/theme';
import { findTool, getTools } from '../tools/workspace';
import { Icon, type IconName } from './Icon';

interface Command {
  id: string;
  label: string;
  hint?: string;
  icon: IconName;
  run: () => void;
}

function buildCommands(activeId: string): Command[] {
  const commands: Command[] = getTools().map((t) => ({
    id: `go:${t.id}`,
    label: t.name,
    hint: t.tagline,
    icon: t.icon,
    run: () => navigate(t.id),
  }));
  const active = findTool(activeId);
  if (active?.loadExample) {
    commands.push({ id: 'example', label: `Load example in ${active.name}`, icon: 'sparkles', run: active.loadExample });
  }
  commands.push(
    { id: 'theme:light', label: 'Use light theme', icon: 'sun', run: () => (theme.value = 'light') },
    { id: 'theme:dark', label: 'Use dark theme', icon: 'moon', run: () => (theme.value = 'dark') },
    { id: 'theme:system', label: 'Match system theme', icon: 'monitor', run: () => (theme.value = 'system') },
  );
  return commands;
}

export function CommandPalette({ activeId, onClose }: { activeId: string; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const all = useMemo(() => buildCommands(activeId), [activeId]);
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter((c) => `${c.label} ${c.hint ?? ''}`.toLowerCase().includes(q));
  }, [all, query]);

  useEffect(() => input.current?.focus(), []);
  useEffect(() => setSelected(0), [query]);

  const run = (c: Command | undefined) => {
    if (!c) return;
    onClose();
    c.run();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') setSelected((s) => Math.min(matches.length - 1, s + 1));
    else if (e.key === 'ArrowUp') setSelected((s) => Math.max(0, s - 1));
    else if (e.key === 'Enter') run(matches[selected]);
    else if (e.key === 'Escape') onClose();
    else return;
    e.preventDefault();
  };

  return (
    <div class="palette-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div class="palette" role="dialog" aria-modal="true" aria-label="Command palette">
        <div class="palette__search">
          <Icon name="search" size={18} />
          <input
            ref={input}
            value={query}
            placeholder="Search tools and actions…"
            aria-label="Search tools and actions"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            aria-activedescendant={matches[selected] ? `cmd-${matches[selected].id}` : undefined}
            onInput={(e) => setQuery(e.currentTarget.value)}
            onKeyDown={onKeyDown}
          />
          <kbd>Esc</kbd>
        </div>
        <ul class="palette__list" id="palette-list" role="listbox">
          {matches.map((c, i) => (
            <li
              key={c.id}
              id={`cmd-${c.id}`}
              role="option"
              aria-selected={i === selected}
              class="palette__item"
              onPointerMove={() => setSelected(i)}
              onClick={() => run(c)}
            >
              <Icon name={c.icon} size={18} />
              {c.label}
              {c.hint && <small>{c.hint}</small>}
            </li>
          ))}
          {matches.length === 0 && <li class="palette__empty">No matching tools or actions</li>}
        </ul>
      </div>
    </div>
  );
}

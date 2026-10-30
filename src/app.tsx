import { useEffect, useState } from 'preact/hooks';
import { route, navigate } from './lib/router';
import { findTool, getTools } from './tools/workspace';
import { CommandPalette } from './ui/CommandPalette';
import { Sidebar } from './ui/Sidebar';
import { Toasts } from './ui/Toasts';

export function App() {
  const tools = getTools();
  const active = findTool(route.value) ?? tools[0];
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    document.title = `${active.name} · Redline`;
  }, [active]);

  // Global shortcuts: Ctrl/⌘+K opens the palette, Alt+1…9 switches tools.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((open) => !open);
      } else if (e.altKey && !e.metaKey && !e.ctrlKey && /^Digit[1-9]$/.test(e.code)) {
        const tool = tools[Number(e.code.slice(5)) - 1];
        if (tool) {
          e.preventDefault();
          navigate(tool.id);
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [tools]);

  const Tool = active.component;
  return (
    <div class="app">
      <Sidebar active={active.id} onOpenPalette={() => setPaletteOpen(true)} />
      <main class="main" id="main">
        <Tool key={active.id} />
      </main>
      {paletteOpen && <CommandPalette activeId={active.id} onClose={() => setPaletteOpen(false)} />}
      <Toasts />
    </div>
  );
}

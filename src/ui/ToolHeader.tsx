import type { ComponentChildren } from 'preact';
import { findTool } from '../tools/workspace';
import { cycleTheme, theme } from '../lib/theme';
import { Button } from './Button';

/** Title, tagline and "Load example" for the tool with this id. */
export function ToolHeader({ id, children }: { id: string; children?: ComponentChildren }) {
  const tool = findTool(id);
  if (!tool) return null;
  return (
    <header class="tool-header">
      <div>
        <h1>{tool.name}</h1>
        <p>{tool.tagline}</p>
      </div>
      <div class="tool-header__actions">
        {children}
        {/* The sidebar's theme switch is hidden on phones, so offer it here. */}
        <Button
          class="mobile-only"
          variant="ghost"
          iconOnly
          icon={theme.value === 'dark' ? 'moon' : theme.value === 'light' ? 'sun' : 'monitor'}
          label={`Theme: ${theme.value}. Tap to switch`}
          onClick={cycleTheme}
        />
        {tool.loadExample && (
          <Button icon="sparkles" variant="ghost" onClick={tool.loadExample}>
            Load example
          </Button>
        )}
      </div>
    </header>
  );
}

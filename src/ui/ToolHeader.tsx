import type { ComponentChildren } from 'preact';
import { findTool } from '../tools/workspace';
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
        {tool.loadExample && (
          <Button icon="sparkles" variant="ghost" onClick={tool.loadExample}>
            Load example
          </Button>
        )}
      </div>
    </header>
  );
}

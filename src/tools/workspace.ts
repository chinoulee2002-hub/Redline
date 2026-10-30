/**
 * The runtime list of tools and cross-tool actions. Tools are registered once
 * at startup (see registry.ts) so shared UI can list them without importing
 * every tool, which would create an import cycle.
 */
import { navigate } from '../lib/router';
import { showToast } from '../lib/toast';
import type { SentText, ToolDefinition } from './types';

let tools: readonly ToolDefinition[] = [];

export function registerTools(list: readonly ToolDefinition[]): void {
  tools = list;
}

export function getTools(): readonly ToolDefinition[] {
  return tools;
}

export function findTool(id: string): ToolDefinition | undefined {
  return tools.find((t) => t.id === id);
}

export function sendTo(toolId: string, input: SentText): void {
  const tool = findTool(toolId);
  if (!tool?.receive) return;
  tool.receive(input);
  navigate(tool.id);
  showToast(`Sent to ${tool.name}`);
}

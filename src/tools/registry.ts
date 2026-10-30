/**
 * The tools in the app, in sidebar order.
 * Adding a tool: create tools/<name>/ with a component and state, then add one entry here.
 */
import type { ToolDefinition } from './types';
import { DiffTool } from './diff/DiffTool';
import * as diff from './diff/state';

export const TOOLS: ToolDefinition[] = [
  {
    id: 'diff',
    name: 'Diff Checker',
    tagline: 'Compare two texts and see every word that was added, removed or reworded.',
    icon: 'diff',
    component: DiffTool,
    receive: diff.receive,
    loadExample: diff.loadExample,
  },
];

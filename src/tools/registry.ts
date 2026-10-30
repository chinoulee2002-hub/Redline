/**
 * The tools in the app, in sidebar order.
 * Adding a tool: create tools/<name>/ with a component and a state module, then add one entry here.
 */
import type { ToolDefinition } from './types';
import { CaseTool } from './case/CaseTool';
import * as caseState from './case/state';
import { CleanerTool } from './cleaner/CleanerTool';
import * as cleaner from './cleaner/state';
import { DiffTool } from './diff/DiffTool';
import * as diff from './diff/state';
import { FrequencyTool } from './frequency/FrequencyTool';
import * as frequency from './frequency/state';
import { RegexTool } from './regex/RegexTool';
import * as regex from './regex/state';

export const TOOLS: ToolDefinition[] = [
  {
    id: 'diff',
    name: 'Diff Checker',
    shortName: 'Diff',
    tagline: 'Compare two texts and see every word that was added, removed or reworded.',
    icon: 'diff',
    component: DiffTool,
    receive: diff.receive,
    loadExample: diff.loadExample,
  },
  {
    id: 'case',
    name: 'Case Converter',
    shortName: 'Case',
    tagline: 'Switch text between UPPER, lower, Title, Sentence, camelCase, snake_case and more.',
    icon: 'case',
    component: CaseTool,
    receive: caseState.receive,
    loadExample: caseState.loadExample,
  },
  {
    id: 'regex',
    name: 'Regex Playground',
    shortName: 'Regex',
    tagline: 'Test regular expressions against sample text with live highlighting and replace.',
    icon: 'regex',
    component: RegexTool,
    receive: regex.receive,
    loadExample: regex.loadExample,
  },
  {
    id: 'frequency',
    name: 'Word Frequency',
    shortName: 'Words',
    tagline: 'Count and rank the words and phrases a text uses most.',
    icon: 'frequency',
    component: FrequencyTool,
    receive: frequency.receive,
    loadExample: frequency.loadExample,
  },
  {
    id: 'cleaner',
    name: 'Text Cleaner',
    shortName: 'Clean',
    tagline: 'Strip stray spaces, line breaks, symbols and formatting from pasted text.',
    icon: 'cleaner',
    component: CleanerTool,
    receive: cleaner.receive,
    loadExample: cleaner.loadExample,
  },
];

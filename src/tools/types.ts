import type { ComponentType } from 'preact';
import type { IconName } from '../ui/Icon';

/** Text handed from one tool to another ("Send to"). */
export interface SentText {
  text: string;
  /** The text before the sending tool changed it, when that is meaningful (e.g. Cleaner input). */
  original?: string;
  /** A regex to load alongside the text (used when sending a word to the Regex Playground). */
  pattern?: string;
  /** Flags for `pattern`, e.g. "gi". */
  flags?: string;
}

export interface ToolDefinition {
  /** URL slug: "#/diff". */
  id: string;
  name: string;
  /** One word for the phone tab bar, where space is tight. */
  shortName: string;
  /** One line, shown in the header and the command palette. */
  tagline: string;
  icon: IconName;
  component: ComponentType;
  /** Accepts text sent from another tool. Tools without it are not offered as targets. */
  receive?: (input: SentText) => void;
  loadExample?: () => void;
}

# Redline

Five text tools in one fast, private web app:

| Tool | What it does |
|---|---|
| **Diff Checker** | Compares two texts and highlights added, removed and reworded words or characters. Every change is numbered: tick the ones to keep, then copy either numbered instructions for an AI ("keep #1, reject #2…") or the final text with your choices applied. Side-by-side or single-column view, change map, J/K navigation, HTML report export. Opens `.txt`, `.md`, `.html`, `.docx` and more. |
| **Case Converter** | Converts to UPPER, lower, Title, Sentence, camelCase, PascalCase, snake_case, kebab-case, CONSTANT_CASE, dot.case and novelty cases. Unicode-aware. |
| **Regex Playground** | Highlights matches live, lists capture groups (numbered and named), previews replacements, and includes a cheat sheet. Runaway patterns are stopped after 300 ms. |
| **Word Frequency** | Ranks words or 2–3 word phrases, with stopword filtering, totals, reading time and CSV export. |
| **Text Cleaner** | Applies a fixed-order pipeline of cleaning steps (spacing, line breaks, HTML/Markdown, invisible characters, emoji, ASCII…), with presets for PDF, Word and web pastes. |

Tools hand text to each other with **Send to**. For example, Cleaner → Diff shows exactly what the cleaning changed.

Everything runs in the browser. No text leaves the device.

## Using it

Open `Redline.html`. It is one self-contained file (about 140 KB, 44 KB gzipped) that works offline, from disk or from any static host. Fonts come from Google Fonts when online and fall back to system fonts otherwise.

Keyboard: `Ctrl/⌘ K` opens the command palette, `Alt 1–5` switches tools, and in the Diff Checker `J`/`K` step through changes.

## Development

Requires Node 20+.

```sh
npm install
npm run dev        # dev server with instant reload
npm run check      # typecheck + lint + unit tests
npm run test:e2e   # build, then drive the built file in Chromium
npm run release    # build and copy the single file to ./Redline.html
```

`Redline.html` in the repo root is a build output. Edit `src/`, then run `npm run release`.

## Stack

- **TypeScript**: types document what every function takes and returns.
- **Preact + @preact/signals**: the React component model in about 4 KB. Signals are values that re-render only the components that read them.
- **Vite + vite-plugin-singlefile**: the build tool. The plugin inlines every script, style and worker into one HTML file.
- **Web Workers**: background threads for heavy work, so typing never stalls.
- **Plain CSS with custom properties**: no CSS framework.
- **No runtime libraries** beyond Preact. `.docx` files are unzipped with the browser's built-in `DecompressionStream` (`lib/zip.ts`).
- **Vitest** for unit tests, **Playwright** for browser tests, **ESLint + Prettier** for style.

## Architecture

```
src/
  core/        Pure text logic. No DOM, no framework. Every module is unit-tested.
  workers/     Runs core/ functions off the main thread.
  lib/         Small browser helpers: storage, routing, clipboard, files, hooks.
  ui/          Shared components: panes, buttons, controls, sidebar, palette, toasts.
  tools/       One folder per tool: <Name>Tool.tsx (UI), state.ts (signals), CSS.
    registry.ts  The list of tools, in sidebar order.
    workspace.ts Cross-tool actions (Send to) and tool lookup.
  styles/      Design tokens (colors, radii, fonts) and global styles.
```

Two rules keep this navigable:

1. `core/` never touches the page. If it's an algorithm, it lives there and has tests.
2. `tools/` never contains algorithms. Components arrange controls and display results.

### Data flow

```
user types ─▶ signal (tools/<x>/state.ts) ─▶ component reads it
                                              │
                                   useTask(runner, 'diff', input, deps, debounceMs)
                                              │
                                 TaskRunner ─▶ Web Worker ─▶ core/diff.ts
                                              │
                         result ◀─────────────┘ (stale results are dropped)
```

- **State** lives in signals in each tool's `state.ts`. `persistedSignal` restores values on load and saves them after changes, skipping texts over 200 KB.
- **`useTask`** (`lib/useTask.ts`) debounces input, meaning it waits for typing to pause, then sends the task and keeps the last good result on screen while the next one computes.
- **`TaskRunner`** (`workers/runner.ts`) keeps one worker per tool. It runs at most one task at a time and keeps only the newest waiting request. With a timeout, it terminates the worker and starts a fresh one. If workers are blocked, tasks run on the main thread instead.
- **`workers/handlers.ts`** is the single list of background tasks. Input and output types flow from it to every caller.

### Reviewing changes

`compareTexts` (`core/diff.ts`) numbers every edit as a `Change`: one reworded phrase inside a line, one rewritten line, or one run of added or removed lines. Ids come from the word-level diff, so they don't change with the Words/Characters/Lines display setting. Every displayed segment and every row's `edits` carry their change id.

`core/review.ts` turns decisions into output:

- `applyDecisions(rows, rejected)` rebuilds the text, reverting rejected changes.
- `buildReviewPrompt(changes, rejected, options)` writes the AI instructions.

Decisions are stored by `Change.key` (kind, texts and occurrence number) rather than by id, so they survive edits elsewhere in the text and page reloads.

### Performance notes

The suite is tuned for about 1 MB of text per input:

- Read signals as low in the tree as possible. For example, `DiffResults` reads the inputs, so typing re-renders only the results and the pane, not the whole tool.
- Pane footers count words, characters and lines in one pass. Above 100 KB the counts update after typing pauses.
- The diff viewer draws 500 rows at a time, with a "Show more" button. Unchanged runs fold to two lines of context.
- The regex highlight layer is built as one escaped HTML string, and only when new matches arrive.
- The regex grid does not stretch its panes to equal height. Stretching forced the large highlight layer to be re-laid out on every keystroke.

## Adding a tool

1. Write the logic in `src/core/<name>.ts` with tests in `tests/unit/<name>.test.ts`.
2. If it can be slow on large text, add a handler in `src/workers/handlers.ts`.
3. Create `src/tools/<name>/`:
   - `state.ts`: signals for inputs and settings (use `persistedSignal`), a `TaskRunner`, and `receive()` / `loadExample()`.
   - `<Name>Tool.tsx`: `<ToolHeader id="<name>" />`, then `TextPane` / `OutputPane` and controls from `ui/`.
   - `<name>.css`: tool-specific styles, using only the tokens in `styles/tokens.css`.
4. Add an entry to `TOOLS` in `src/tools/registry.ts` (add an icon path in `ui/Icon.tsx` if needed).

The sidebar, command palette, Send to menus and Alt-number shortcuts pick the new tool up automatically.

## Testing

- `tests/unit/`: core logic, including a randomized check that the diff is minimal against a reference LCS (longest common subsequence) implementation.
- `tests/e2e/smoke.test.mjs`: opens the built file from `file://` in Chromium and exercises every tool: live diffing, `.docx` import, regex timeouts, Send to, the palette, and the fallback when Web Workers are unavailable. The tests fail on any console error.
- `tests/e2e/a11y.test.mjs`: runs the axe-core accessibility audit (WCAG 2.1 A and AA) on every tool, in light and dark themes, and fails on serious or critical issues such as low colour contrast.

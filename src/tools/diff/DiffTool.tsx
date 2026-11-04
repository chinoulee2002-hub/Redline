import { Button } from '../../ui/Button';
import { Segmented, Toggle } from '../../ui/Controls';
import { TextPane } from '../../ui/Pane';
import { ToolHeader } from '../../ui/ToolHeader';
import { useTask } from '../../lib/useTask';
import type { DiffDetail } from '../../core/diff';
import { DiffViewer } from './DiffViewer';
import {
  diffRunner,
  original,
  originalName,
  revised,
  revisedName,
  settings,
  swapSides,
  updateSettings,
} from './state';
import './diff.css';

const DETAIL_OPTIONS: { value: DiffDetail; label: string; title: string }[] = [
  { value: 'word', label: 'Words', title: 'Highlight changed words' },
  { value: 'char', label: 'Characters', title: 'Highlight changed letters' },
  { value: 'line', label: 'Lines', title: 'Mark whole lines only' },
];

export function DiffTool() {
  return (
    <div class="tool">
      <ToolHeader id="diff" />
      <div class="grid-2">
        <TextPane
          title="Original"
          ariaLabel="Original text"
          badge="1"
          value={original}
          fileName={originalName}
          font="doc"
          allowFiles
          placeholder="Paste the original text, or drop a file (.txt, .md, .docx, .html…)"
        />
        <TextPane
          title="Changed"
          ariaLabel="Changed text"
          badge="2"
          value={revised}
          fileName={revisedName}
          font="doc"
          allowFiles
          placeholder="Paste the new version to compare against the original"
        />
      </div>
      <DiffOptions />
      <DiffResults />
    </div>
  );
}

function DiffOptions() {
  const s = settings.value;
  return (
    <div class="optionbar">
      <Toggle checked={s.ignoreWhitespace} onChange={(v) => updateSettings({ ignoreWhitespace: v })}>
        Ignore extra spaces
      </Toggle>
      <Toggle checked={s.ignoreCase} onChange={(v) => updateSettings({ ignoreCase: v })}>
        Ignore capitals
      </Toggle>
      <span class="optionbar__label">Detail</span>
      <Segmented
        label="Highlight detail"
        options={DETAIL_OPTIONS}
        value={s.detail}
        onChange={(detail) => updateSettings({ detail })}
      />
      <span class="optionbar__spacer" />
      <Button icon="swap" variant="ghost" onClick={swapSides}>
        Swap sides
      </Button>
    </div>
  );
}

/** Reads the inputs here, not in DiffTool, so typing re-renders only this subtree and the pane. */
function DiffResults() {
  const a = original.value;
  const b = revised.value;
  const { ignoreWhitespace, ignoreCase, detail } = settings.value;
  const ready = a.trim() !== '' && b.trim() !== '';
  const size = a.length + b.length;
  const {
    result,
    input: compared,
    pending,
    error,
  } = useTask(
    diffRunner,
    'diff',
    ready ? { original: a, revised: b, options: { ignoreWhitespace, ignoreCase, detail } } : null,
    [a, b, ignoreWhitespace, ignoreCase, detail, ready],
    size > 100_000 ? 300 : 120,
  );

  if (!ready) {
    return (
      <div class="empty card">
        <b>Add text to both sides</b>
        <span>Changes appear here as you type: removed words in red, added words in green.</span>
      </div>
    );
  }
  if (error && !result) return <div class="empty card">Comparison failed: {error.message}</div>;
  if (!result) return <div class="card skeleton" aria-busy="true" />;
  return (
    <DiffViewer
      result={result}
      pending={pending}
      names={{ original: originalName.value || 'Original', revised: revisedName.value || 'Changed' }}
      // The settled input object is stable between renders, unlike a fresh { original, revised }.
      texts={compared ?? { original: a, revised: b }}
    />
  );
}

import { CLEAN_PRESETS, CLEAN_STEPS, type CleanGroup, type CleanStepId } from '../../core/clean';
import { countChars, countLines } from '../../core/tokenize';
import { formatNumber } from '../../lib/format';
import { useTask } from '../../lib/useTask';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { OutputPane, TextPane } from '../../ui/Pane';
import { ToolHeader } from '../../ui/ToolHeader';
import { cleanRunner, input, steps, toggleStep } from './state';
import './cleaner.css';

const GROUP_ORDER: CleanGroup[] = ['Markup', 'Characters', 'Spacing', 'Lines'];

export function CleanerTool() {
  const text = input.value;
  const enabled = steps.value;
  const { result, pending } = useTask(
    cleanRunner,
    'clean',
    { text, steps: enabled },
    [text, enabled],
    text.length > 50_000 ? 200 : 0,
  );
  const output = result?.text ?? '';
  const noEffect = new Set(result?.noEffect ?? []);

  return (
    <div class="tool">
      <ToolHeader id="cleaner" />
      <Presets enabled={enabled} />
      <div class="cleaner">
        <StepList enabled={enabled} noEffect={text ? noEffect : new Set()} />
        <div class="cleaner__editors">
          <TextPane
            title="Messy text"
            value={input}
            placeholder="Paste text to clean up"
            allowFiles
            minHeight={260}
          />
          <OutputPane
            title="Clean text"
            text={output}
            fileName="cleaned.txt"
            sendFrom="cleaner"
            original={text}
            onReuse={() => (input.value = output)}
            pending={pending}
            minHeight={260}
            extraFooter={text && result ? <Savings before={text} after={output} /> : null}
          />
        </div>
      </div>
    </div>
  );
}

function Presets({ enabled }: { enabled: CleanStepId[] }) {
  const on = new Set(enabled);
  const matches = (ids: CleanStepId[]) => ids.length === on.size && ids.every((id) => on.has(id));
  return (
    <div class="optionbar">
      <span class="optionbar__label">Presets</span>
      {CLEAN_PRESETS.map((p) => (
        <button
          key={p.id}
          type="button"
          class={`chip chip--preset${matches(p.steps) ? ' is-on' : ''}`}
          aria-pressed={matches(p.steps)}
          onClick={() => (steps.value = [...p.steps])}
        >
          {p.label}
        </button>
      ))}
      <span class="optionbar__spacer" />
      <Button variant="ghost" icon="x" disabled={!enabled.length} onClick={() => (steps.value = [])}>
        Turn all off
      </Button>
    </div>
  );
}

function StepList({ enabled, noEffect }: { enabled: CleanStepId[]; noEffect: Set<CleanStepId> }) {
  const on = new Set(enabled);
  return (
    <aside class="card steps" aria-label="Cleaning steps">
      <p class="steps__intro">Steps run top to bottom.</p>
      {GROUP_ORDER.map((group) => (
        <fieldset key={group} class="steps__group">
          <legend class="section-label">{group}</legend>
          {CLEAN_STEPS.filter((s) => s.group === group).map((s) => (
            <label key={s.id} class={`step${on.has(s.id) ? ' is-on' : ''}`}>
              <input
                type="checkbox"
                checked={on.has(s.id)}
                onChange={(e) => toggleStep(s.id, e.currentTarget.checked)}
              />
              <span class="step__box" aria-hidden="true">
                <Icon name="check" size={12} />
              </span>
              <span class="step__text">
                <span class="step__label">
                  {s.label}
                  {on.has(s.id) && noEffect.has(s.id) && <span class="tag">no effect</span>}
                </span>
                <small>{s.hint}</small>
              </span>
            </label>
          ))}
        </fieldset>
      ))}
    </aside>
  );
}

function Savings({ before, after }: { before: string; after: string }) {
  const chars = countChars(before) - countChars(after);
  const lines = countLines(before) - countLines(after);
  if (!chars && !lines) return <>No changes</>;
  const part = (n: number, unit: string) =>
    n > 0 ? `−${formatNumber(n)} ${unit}` : n < 0 ? `+${formatNumber(-n)} ${unit}` : '';
  return (
    <span class="savings">{[part(chars, 'chars'), part(lines, 'lines')].filter(Boolean).join(' · ')}</span>
  );
}

import { useMemo } from 'preact/hooks';
import { CASE_FORMATS, type CaseFormat } from '../../core/case';
import { copyText } from '../../lib/clipboard';
import { useTask } from '../../lib/useTask';
import { Button } from '../../ui/Button';
import { OutputPane, TextPane } from '../../ui/Pane';
import { ToolHeader } from '../../ui/ToolHeader';
import { caseRunner, format, input } from './state';
import './case.css';

/** Cards preview only the start of the text, so they stay instant on huge inputs. */
const PREVIEW_CHARS = 240;
const GROUPS = ['Everyday', 'Programming', 'Novelty'] as const;

export function CaseTool() {
  const text = input.value;
  const selected = CASE_FORMATS.find((f) => f.id === format.value) ?? CASE_FORMATS[0];
  const { result, pending } = useTask(
    caseRunner,
    'convertCase',
    { text, format: selected.id },
    [text, selected.id],
    text.length > 50_000 ? 150 : 0,
  );

  return (
    <div class="tool">
      <ToolHeader id="case" />
      <div class="grid-2">
        <TextPane
          title="Input"
          value={input}
          placeholder="Type or paste text to convert"
          allowFiles
          minHeight={200}
        />
        <OutputPane
          title={selected.label}
          text={text ? (result ?? '') : ''}
          font={selected.group === 'Programming' ? 'mono' : 'ui'}
          fileName={`${selected.id}-case.txt`}
          sendFrom="case"
          original={text}
          onReuse={() => (input.value = result ?? text)}
          pending={pending}
          minHeight={200}
        />
      </div>
      <FormatCards text={text} selected={selected} />
    </div>
  );
}

function FormatCards({ text, selected }: { text: string; selected: CaseFormat }) {
  const head = text.slice(0, PREVIEW_CHARS);
  const previews = useMemo(
    () => new Map(CASE_FORMATS.map((f) => [f.id, f.convert(head || f.sample)])),
    [head],
  );

  return (
    <div class="case-groups">
      {GROUPS.map((group) => (
        <section key={group} class="case-group">
          <h2 class="section-label">{group}</h2>
          <div class="case-grid" role="radiogroup" aria-label={`${group} formats`}>
            {CASE_FORMATS.filter((f) => f.group === group).map((f) => (
              <div key={f.id} class={`case-card${f.id === selected.id ? ' is-on' : ''}`}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={f.id === selected.id}
                  class="case-card__main"
                  onClick={() => (format.value = f.id)}
                >
                  <span class="case-card__label">{f.label}</span>
                  <span class={`case-card__preview${f.group === 'Programming' ? ' is-mono' : ''}`}>
                    {previews.get(f.id)}
                  </span>
                </button>
                <Button
                  size="sm"
                  variant="ghost"
                  icon="copy"
                  iconOnly
                  label={`Copy as ${f.label}`}
                  class="case-card__copy"
                  disabled={!text}
                  onClick={() => void copyText(f.convert(text), `Copied as ${f.label}`)}
                />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

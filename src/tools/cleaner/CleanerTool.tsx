import { CLEAN_PRESETS, CLEAN_STEPS, type CleanGroup, type CleanStepId } from '../../core/clean';
import { countChars, countLines } from '../../core/tokenize';
import { formatNumber } from '../../lib/format';
import { useTask } from '../../lib/useTask';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { OutputPane, TextPane } from '../../ui/Pane';
import { ToolHeader } from '../../ui/ToolHeader';
import { usePopover } from '../../ui/usePopover';
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
  const on = new Set(enabled);
  const noEffect = new Set<CleanStepId>(text ? (result?.noEffect ?? []) : []);

  return (
    <div class="tool">
      <ToolHeader id="cleaner" />
      <div class="card cleaner-bar">
        <div class="cleaner-bar__row">
          <Presets on={on} />
          <span class="optionbar__spacer" />
          <div class="cleaner-bar__groups" role="group" aria-label="Cleaning steps by type">
            {GROUP_ORDER.map((g, i) => (
              // Menus on the right half open leftwards so they stay on screen.
              <GroupMenu
                key={g}
                group={g}
                on={on}
                noEffect={noEffect}
                alignRight={i >= GROUP_ORDER.length / 2}
              />
            ))}
          </div>
        </div>
        <ActiveSteps on={on} noEffect={noEffect} />
      </div>
      <div class="grid-2 cleaner__editors">
        <TextPane title="Messy text" value={input} placeholder="Paste text to clean up" allowFiles />
        <OutputPane
          title="Clean text"
          text={output}
          fileName="cleaned.txt"
          sendFrom="cleaner"
          original={text}
          onReuse={() => (input.value = output)}
          pending={pending}
          extraFooter={text && result ? <Savings before={text} after={output} /> : null}
        />
      </div>
    </div>
  );
}

function Presets({ on }: { on: Set<CleanStepId> }) {
  const matches = (ids: CleanStepId[]) => ids.length === on.size && ids.every((id) => on.has(id));
  return (
    <div class="cleaner-bar__presets" role="group" aria-label="Presets">
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
    </div>
  );
}

/** A toolbar button for one group of steps, opening a checklist of them. */
function GroupMenu({
  group,
  on,
  noEffect,
  alignRight,
}: {
  group: CleanGroup;
  on: Set<CleanStepId>;
  noEffect: Set<CleanStepId>;
  alignRight: boolean;
}) {
  const { open, setOpen, root } = usePopover<HTMLDivElement>();
  const groupSteps = CLEAN_STEPS.filter((s) => s.group === group);
  const count = groupSteps.filter((s) => on.has(s.id)).length;
  return (
    <div class="menu-anchor" ref={root}>
      <button
        type="button"
        class={`chip chip--menu${count ? ' is-on' : ''}`}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {group}
        {count > 0 && <span class="chip__count">{count}</span>}
        <Icon name="chevronDown" size={14} />
      </button>
      {open && (
        <div
          class={`menu step-menu${alignRight ? ' step-menu--right' : ''}`}
          role="group"
          aria-label={`${group} steps`}
        >
          {groupSteps.map((s) => (
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
        </div>
      )}
    </div>
  );
}

/** The steps that are on, numbered in the order they run; × turns one off. */
function ActiveSteps({ on, noEffect }: { on: Set<CleanStepId>; noEffect: Set<CleanStepId> }) {
  const running = CLEAN_STEPS.filter((s) => on.has(s.id));
  if (!running.length) {
    return (
      <p class="cleaner-bar__row active-steps active-steps--none">
        No steps are on, so the text passes through unchanged. Pick a preset or open a group above.
      </p>
    );
  }
  return (
    <div class="cleaner-bar__row active-steps">
      <span class="optionbar__label" id="runs-in-order">
        Runs in order
      </span>
      <ol class="active-steps__list" aria-labelledby="runs-in-order">
        {running.map((s) => {
          const idle = noEffect.has(s.id);
          return (
            <li
              key={s.id}
              class={`step-chip${idle ? ' is-idle' : ''}`}
              title={idle ? 'Changed nothing in this text' : s.hint}
            >
              {s.label}
              <button
                type="button"
                aria-label={`Turn off ${s.label}`}
                onClick={() => toggleStep(s.id, false)}
              >
                <Icon name="x" size={12} />
              </button>
            </li>
          );
        })}
      </ol>
      <Button size="sm" variant="ghost" icon="x" onClick={() => (steps.value = [])}>
        Turn all off
      </Button>
    </div>
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

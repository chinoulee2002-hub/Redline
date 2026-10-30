import { useEffect, useRef } from 'preact/hooks';
import { REGEX_FLAGS } from '../../core/regex';
import { formatNumber, plural } from '../../lib/format';
import { useTask } from '../../lib/useTask';
import { Toggle } from '../../ui/Controls';
import { Icon } from '../../ui/Icon';
import { OutputPane, PaneFrame, TextCounts } from '../../ui/Pane';
import { ToolHeader } from '../../ui/ToolHeader';
import { Cheatsheet } from './Cheatsheet';
import { HighlightEditor } from './HighlightEditor';
import { MatchList } from './MatchList';
import {
  flags,
  MAX_SHOWN_MATCHES,
  pattern,
  REGEX_TIMEOUT_MS,
  regexRunner,
  replacement,
  replaceOn,
  selectedMatch,
  text,
  toggleFlag,
} from './state';
import './regex.css';

const FLAG_INFO: Record<string, { name: string; help: string }> = {
  g: { name: 'global', help: 'Find every match, not just the first' },
  i: { name: 'ignore case', help: 'A matches a' },
  m: { name: 'multiline', help: '^ and $ match at each line' },
  s: { name: 'dot all', help: '. also matches newlines' },
  u: { name: 'unicode', help: 'Full Unicode; enables \\p{…}' },
  y: { name: 'sticky', help: 'Match only where the last match ended' },
};

export function RegexTool() {
  const p = pattern.value;
  const f = flags.value;
  const t = text.value;
  const r = replaceOn.value ? replacement.value : null;
  const {
    result,
    input: searched,
    pending,
    error,
  } = useTask(
    regexRunner,
    'regex',
    { pattern: p, flags: f, text: t, replacement: r, maxMatches: MAX_SHOWN_MATCHES },
    [p, f, t, r],
    // Big texts wait for a pause in typing: redrawing thousands of highlights is the costly part.
    t.length > 200_000 ? 400 : t.length > 50_000 ? 150 : 30,
  );
  // After a timeout or failure the last good result is stale: don't draw its highlights.
  const ok = !error && result?.ok ? result : null;
  const syntaxError = !error && result && !result.ok ? result.error : null;

  const patternInput = useRef<HTMLInputElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    selectedMatch.value = -1;
  }, [result]);

  const insertToken = (token: string) => {
    const el = patternInput.current;
    const start = el?.selectionStart ?? p.length;
    const end = el?.selectionEnd ?? p.length;
    pattern.value = p.slice(0, start) + token + p.slice(end);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const selectMatch = (i: number) => {
    const m = ok?.matches[i];
    selectedMatch.value = i;
    const el = textarea.current;
    if (!m || !el) return;
    el.focus();
    el.setSelectionRange(m.index, m.end);
    // Scroll the match into view: place the caret's line near the middle of the box.
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 22;
    const line = t.slice(0, m.index).split('\n').length - 1;
    el.scrollTop = Math.max(0, line * lineHeight - el.clientHeight / 2);
  };

  return (
    <div class="tool">
      <ToolHeader id="regex" />

      <div class={`card pattern-bar${syntaxError || error ? ' has-error' : ''}`}>
        <label class="pattern-row">
          <span class="slash" aria-hidden="true">
            /
          </span>
          <input
            ref={patternInput}
            class="pattern-input"
            value={p}
            placeholder="Type a regular expression, e.g. \b\w+ing\b"
            aria-label="Regular expression"
            spellcheck={false}
            autocomplete="off"
            onInput={(e) => (pattern.value = e.currentTarget.value)}
          />
          <span class="slash" aria-hidden="true">
            /
          </span>
          <span class="pattern-flags" aria-hidden="true">
            {f}
          </span>
        </label>
        <div class="flag-row">
          <div class="flags" role="group" aria-label="Flags">
            {REGEX_FLAGS.map((flag) => (
              <button
                key={flag}
                type="button"
                class={`flag${f.includes(flag) ? ' is-on' : ''}`}
                aria-pressed={f.includes(flag)}
                title={FLAG_INFO[flag].help}
                onClick={() => toggleFlag(flag)}
              >
                <code>{flag}</code>
                {FLAG_INFO[flag].name}
              </button>
            ))}
          </div>
          <Toggle checked={replaceOn.value} onChange={(v) => (replaceOn.value = v)}>
            Replace
          </Toggle>
        </div>
        <Status
          ok={ok}
          syntaxError={syntaxError}
          errorKind={error?.kind}
          errorMessage={error?.message}
          empty={!p}
        />
      </div>

      {replaceOn.value && (
        <label class="card replace-bar">
          <span class="replace-bar__label">Replace with</span>
          <input
            class="pattern-input"
            value={replacement.value}
            spellcheck={false}
            aria-label="Replacement"
            placeholder="Replacement text"
            onInput={(e) => (replacement.value = e.currentTarget.value)}
          />
          <span class="replace-bar__hint">
            <code>$&amp;</code> whole match · <code>$1</code> group 1 · <code>$&lt;name&gt;</code> named group
          </span>
        </label>
      )}

      <div class="regex-grid">
        <PaneFrame
          title="Test text"
          class={pending ? 'is-pending' : undefined}
          footer={
            <>
              <span />
              <TextCounts text={t} />
            </>
          }
        >
          <HighlightEditor
            value={text}
            matchedText={searched?.text ?? ''}
            matches={ok?.matches ?? []}
            current={selectedMatch.value}
            textareaRef={textarea}
          />
        </PaneFrame>
        <PaneFrame
          title={ok ? `Matches · ${formatNumber(ok.total)}${ok.totalCapped ? '+' : ''}` : 'Matches'}
          class="matches-pane"
        >
          {ok ? (
            <MatchList
              matches={ok.matches}
              total={ok.total}
              text={searched?.text ?? t}
              current={selectedMatch.value}
              onSelect={selectMatch}
            />
          ) : (
            <p class="matches__none">{p ? 'Fix the pattern to see matches' : 'Type a pattern above'}</p>
          )}
        </PaneFrame>
      </div>

      {replaceOn.value && (
        <OutputPane
          title="Result after replacing"
          text={ok?.replaced ?? ''}
          font="mono"
          fileName="replaced.txt"
          sendFrom="regex"
          original={t}
          onReuse={() => ok?.replaced != null && (text.value = ok.replaced)}
          minHeight={160}
        />
      )}

      <details class="card cheats-card">
        <summary>
          <Icon name="chevronRight" />
          Cheat sheet and common patterns
        </summary>
        <Cheatsheet
          onInsert={insertToken}
          onPreset={(np, nf) => {
            pattern.value = np;
            flags.value = nf;
          }}
        />
      </details>
    </div>
  );
}

function Status({
  ok,
  syntaxError,
  errorKind,
  errorMessage,
  empty,
}: {
  ok: { total: number; totalCapped: boolean; elapsedMs: number; matches: unknown[] } | null;
  syntaxError: string | null;
  errorKind?: string;
  errorMessage?: string;
  empty: boolean;
}) {
  if (errorKind === 'timeout') {
    return (
      <p class="pattern-status is-error" role="alert">
        <Icon name="alert" />
        Stopped after {REGEX_TIMEOUT_MS} ms. The pattern is likely backtracking catastrophically, often from
        nested quantifiers such as <code>(a+)+</code>.
      </p>
    );
  }
  if (errorMessage)
    return (
      <p class="pattern-status is-error" role="alert">
        {errorMessage}
      </p>
    );
  if (syntaxError) {
    return (
      <p class="pattern-status is-error" role="alert">
        <Icon name="alert" />
        {syntaxError}
      </p>
    );
  }
  if (empty || !ok) return <p class="pattern-status">&nbsp;</p>;
  return (
    <p class="pattern-status">
      <span class={ok.total ? 'pattern-status__count' : ''}>
        {ok.total ? plural(ok.total, 'match', 'matches') : 'No matches'}
        {ok.totalCapped ? ' (stopped counting)' : ''}
      </span>
      {ok.total > ok.matches.length && (
        <span> · highlighting the first {formatNumber(ok.matches.length)}</span>
      )}
      <span class="pattern-status__time"> · {ok.elapsedMs < 1 ? '<1' : ok.elapsedMs.toFixed(0)} ms</span>
    </p>
  );
}

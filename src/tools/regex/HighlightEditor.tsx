/**
 * A textarea with match highlights drawn behind it. The textarea's own text
 * stays visible and editable on top; an identically styled layer underneath
 * renders the same text invisibly with coloured <mark>s where matches are.
 *
 * The layer is rebuilt only when new matches arrive, not on every keystroke,
 * so typing in a large text doesn't lay the whole text out twice per key.
 */
import type { Signal } from '@preact/signals';
import { useMemo, useRef } from 'preact/hooks';
import type { RegexMatch } from '../../core/regex';

export function HighlightEditor({
  value,
  matchedText,
  matches,
  current,
  textareaRef,
}: {
  value: Signal<string>;
  /** The text `matches` were found in; briefly older than `value` while a new search runs. */
  matchedText: string;
  matches: RegexMatch[];
  current: number;
  textareaRef: { current: HTMLTextAreaElement | null };
}) {
  const backdrop = useRef<HTMLDivElement>(null);
  const text = value.value;

  const highlights = useMemo(
    () => renderHighlights(matchedText, matches, current),
    [matchedText, matches, current],
  );

  return (
    <div class="hl">
      <div
        class="hl__backdrop editor editor--mono"
        ref={backdrop}
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: highlights }}
      />
      <textarea
        ref={textareaRef}
        class="hl__input editor editor--mono"
        value={text}
        spellcheck={false}
        aria-label="Test text"
        placeholder="Paste text to test the pattern against"
        onInput={(e) => (value.value = e.currentTarget.value)}
        onScroll={(e) => {
          if (backdrop.current) {
            backdrop.current.scrollTop = e.currentTarget.scrollTop;
            backdrop.current.scrollLeft = e.currentTarget.scrollLeft;
          }
        }}
      />
    </div>
  );
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>]/g, (c) => (c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;'));

/**
 * Builds the layer as one HTML string. With thousands of matches this is far
 * cheaper than creating and diffing a virtual node per match. All text is escaped.
 */
function renderHighlights(text: string, matches: RegexMatch[], current: number): string {
  // The layer's text is transparent, so with no matches there is nothing to draw.
  if (!matches.length) return '';
  let html = '';
  let last = 0;
  matches.forEach((m, i) => {
    if (m.index < last) return; // defensive: never overlap
    const cls = `m ${i % 2 ? 'm--b' : 'm--a'}${i === current ? ' m--current' : ''}${m.end === m.index ? ' m--empty' : ''}`;
    html += `${escapeHtml(text.slice(last, m.index))}<mark class="${cls}">${escapeHtml(text.slice(m.index, m.end))}</mark>`;
    last = m.end;
  });
  // A trailing newline needs a character after it, or the layer ends one line short.
  return html + escapeHtml(text.slice(last)) + '\u200b';
}

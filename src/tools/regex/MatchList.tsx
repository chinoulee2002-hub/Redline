import { useMemo } from 'preact/hooks';
import type { RegexMatch } from '../../core/regex';
import { formatNumber } from '../../lib/format';

/** Shows invisible characters so matches of spaces, tabs and newlines can be read. */
function visible(s: string): string {
  return s.replace(/\n/g, '⏎').replace(/\t/g, '⇥').replace(/ /g, '·');
}

/** "Ln 3, Col 14" for each match, in one sweep over the text (matches are in index order). */
function positions(text: string, matches: RegexMatch[]): string[] {
  const out: string[] = [];
  let line = 1;
  let lineStart = 0;
  let i = 0;
  for (const m of matches) {
    for (; i < m.index; i++) {
      if (text.charCodeAt(i) === 10) {
        line++;
        lineStart = i + 1;
      }
    }
    out.push(`Ln ${line}, Col ${m.index - lineStart + 1}`);
  }
  return out;
}

/** Only the first rows are drawn; the editor still highlights every shown match. */
const LIST_LIMIT = 300;

export function MatchList({
  matches,
  total,
  text,
  current,
  onSelect,
}: {
  matches: RegexMatch[];
  total: number;
  text: string;
  current: number;
  onSelect: (index: number) => void;
}) {
  const shown = matches.slice(0, LIST_LIMIT);
  const where = useMemo(() => positions(text, shown), [text, matches]); // eslint-disable-line react-hooks/exhaustive-deps -- `shown` derives from `matches`
  if (!matches.length) return <p class="matches__none">No matches</p>;
  return (
    <ol class="matches">
      {shown.map((m, i) => (
        <li key={i}>
          <button type="button" class={`match${i === current ? ' is-on' : ''}`} onClick={() => onSelect(i)}>
            <span class="match__head">
              <span class="match__n">{i + 1}</span>
              <code class="match__text">{m.text === '' ? <em>empty</em> : visible(m.text)}</code>
              <span class="match__pos">{where[i]}</span>
            </span>
            {m.groups.length > 0 && (
              <span class="match__groups">
                {m.groups.map((g) => (
                  <span key={g.name} class="group">
                    <span class="group__name">{g.name}</span>
                    <code>{g.value === undefined ? <em>unmatched</em> : visible(g.value)}</code>
                  </span>
                ))}
              </span>
            )}
          </button>
        </li>
      ))}
      {total > LIST_LIMIT && <li class="matches__more">…and {formatNumber(total - LIST_LIMIT)} more</li>}
    </ol>
  );
}

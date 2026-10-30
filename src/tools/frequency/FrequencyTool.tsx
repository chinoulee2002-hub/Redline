import { useEffect, useMemo, useState } from 'preact/hooks';
import { frequencyToCsv, type FrequencyEntry, type FrequencyResult } from '../../core/frequency';
import { downloadText } from '../../lib/download';
import { formatMinutes, formatNumber, formatPercent, plural } from '../../lib/format';
import { useTask } from '../../lib/useTask';
import { Button } from '../../ui/Button';
import { NumberField, Segmented, Toggle } from '../../ui/Controls';
import { Icon } from '../../ui/Icon';
import { TextPane } from '../../ui/Pane';
import { Stats } from '../../ui/Stats';
import { ToolHeader } from '../../ui/ToolHeader';
import { sendTo } from '../workspace';
import { frequencyRunner, input, settings, toOptions, updateSettings } from './state';
import './frequency.css';

const PAGE = 100;

const PHRASE_OPTIONS: { value: 1 | 2 | 3; label: string }[] = [
  { value: 1, label: 'Words' },
  { value: 2, label: '2-word phrases' },
  { value: 3, label: '3-word phrases' },
];

export function FrequencyTool() {
  return (
    <div class="tool">
      <ToolHeader id="frequency" />
      <FrequencyOptionsBar />
      <div class="freq">
        <TextPane title="Text" value={input} placeholder="Paste text to analyse" allowFiles minHeight={420} />
        <FrequencyResults />
      </div>
    </div>
  );
}

function FrequencyOptionsBar() {
  const s = settings.value;
  return (
    <div class="optionbar">
      <Segmented
        label="Count"
        options={PHRASE_OPTIONS}
        value={s.phraseLength}
        onChange={(phraseLength) => updateSettings({ phraseLength })}
      />
      <Toggle checked={s.ignoreCase} onChange={(ignoreCase) => updateSettings({ ignoreCase })}>
        Ignore capitals
      </Toggle>
      <Toggle
        checked={s.excludeStopwords}
        onChange={(excludeStopwords) => updateSettings({ excludeStopwords })}
        title="Skip words like “the”, “and”, “of”"
      >
        Skip common words
      </Toggle>
      <Toggle checked={s.includeNumbers} onChange={(includeNumbers) => updateSettings({ includeNumbers })}>
        Include numbers
      </Toggle>
      <NumberField
        label="Min length"
        value={s.minLength}
        min={1}
        max={20}
        onChange={(minLength) => updateSettings({ minLength })}
      />
      <input
        class="field freq__skip"
        value={s.customStopwords}
        placeholder="Also skip: e.g. company, team"
        aria-label="Extra words to skip, separated by commas"
        onInput={(e) => updateSettings({ customStopwords: e.currentTarget.value })}
      />
    </div>
  );
}

function FrequencyResults() {
  const text = input.value;
  const s = settings.value;
  const { result, pending } = useTask(
    frequencyRunner,
    'frequency',
    text.trim() ? { text, options: toOptions(s) } : null,
    [text, s],
    text.length > 50_000 ? 250 : 60,
  );

  if (!text.trim()) {
    return (
      <div class="card empty">
        <b>Nothing to count yet</b>
        <span>Paste text on the left to see its most frequent words and phrases.</span>
      </div>
    );
  }
  if (!result) return <div class="card skeleton" aria-busy="true" />;
  return <ResultsCard result={result} pending={pending} text={text} />;
}

function ResultsCard({ result, pending, text }: { result: FrequencyResult; pending: boolean; text: string }) {
  const t = result.totals;
  const [filter, setFilter] = useState('');
  const [sort, setSort] = useState<'count' | 'alpha'>('count');
  const [limit, setLimit] = useState(PAGE);
  useEffect(() => setLimit(PAGE), [result, filter, sort]);

  const rows = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const list = q ? result.entries.filter((e) => e.term.toLowerCase().includes(q)) : result.entries;
    return sort === 'alpha' ? [...list].sort((a, b) => a.term.localeCompare(b.term)) : list;
  }, [result, filter, sort]);
  const max = result.entries[0]?.count ?? 1;
  // Rank always reflects frequency, even when sorted A–Z or filtered.
  const rank = useMemo(() => new Map(result.entries.map((e, i) => [e.term, i + 1])), [result]);

  return (
    <div class={`freq__results${pending ? ' is-pending' : ''}`}>
      <div class="card freq__totals">
        <Stats
          items={[
            { label: 'Words', value: formatNumber(t.words) },
            { label: 'Unique words', value: formatNumber(t.uniqueWords) },
            { label: 'Variety', value: formatPercent(t.diversity, 0) },
            { label: 'Avg. word length', value: t.averageWordLength.toFixed(1) },
            { label: 'Sentences', value: formatNumber(t.sentences) },
            { label: 'Reading time', value: formatMinutes(t.readingMinutes) },
          ]}
        />
      </div>
      <div class="card freq__table-card">
        <div class="freq__table-bar">
          <div class="search-field">
            <Icon name="search" />
            <input
              class="field"
              value={filter}
              placeholder={`Filter ${plural(result.entries.length, 'term')}`}
              aria-label="Filter terms"
              onInput={(e) => setFilter(e.currentTarget.value)}
            />
          </div>
          <Button
            size="sm"
            variant="ghost"
            icon="download"
            disabled={!result.entries.length}
            onClick={() => downloadText('word-frequency.csv', frequencyToCsv(result.entries), 'text/csv')}
          >
            CSV
          </Button>
        </div>
        {rows.length ? (
          <table class="freq__table">
            <thead>
              <tr>
                <th class="num">#</th>
                <th>
                  <SortButton active={sort === 'alpha'} onClick={() => setSort('alpha')}>
                    {settings.value.phraseLength === 1 ? 'Word' : 'Phrase'}
                  </SortButton>
                </th>
                <th class="num">
                  <SortButton active={sort === 'count'} onClick={() => setSort('count')}>
                    Count
                  </SortButton>
                </th>
                <th class="freq__share-col">Share</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, limit).map((e) => (
                <Row key={e.term} entry={e} rank={rank.get(e.term) ?? 0} max={max} text={text} />
              ))}
            </tbody>
          </table>
        ) : (
          <p class="freq__none">
            {filter ? 'No terms match the filter.' : 'No words left after the filters above.'}
          </p>
        )}
        {rows.length > limit && (
          <button type="button" class="fold fold--more" onClick={() => setLimit(limit + PAGE)}>
            Show {Math.min(PAGE, rows.length - limit)} more of {formatNumber(rows.length - limit)}
          </button>
        )}
      </div>
    </div>
  );
}

function SortButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button type="button" class={`sort${active ? ' is-on' : ''}`} aria-pressed={active} onClick={onClick}>
      {children}
      <Icon name="arrowDown" size={12} />
    </button>
  );
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function Row({ entry, rank, max, text }: { entry: FrequencyEntry; rank: number; max: number; text: string }) {
  const pattern = `\\b${entry.term.split(' ').map(escapeRegex).join('\\s+')}\\b`;
  return (
    <tr>
      <td class="num muted">{rank}</td>
      <td class="freq__term">{entry.term}</td>
      <td class="num">{formatNumber(entry.count)}</td>
      <td class="freq__share-col">
        <div class="share">
          <div class="bar">
            <span style={{ width: `${(entry.count / max) * 100}%` }} />
          </div>
          <span class="bar__label">{formatPercent(entry.share)}</span>
        </div>
      </td>
      <td class="freq__act">
        <Button
          size="sm"
          variant="ghost"
          icon="regex"
          iconOnly
          label={`Highlight “${entry.term}” in the Regex Playground`}
          onClick={() => sendTo('regex', { text, pattern, flags: settings.value.ignoreCase ? 'gi' : 'g' })}
        />
      </td>
    </tr>
  );
}

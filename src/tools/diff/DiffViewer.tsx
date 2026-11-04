import { Fragment, type ComponentChildren } from 'preact';
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { toUnifiedText, type DiffResult, type DiffRow, type Segment } from '../../core/diff';
import { copyText } from '../../lib/clipboard';
import { downloadText } from '../../lib/download';
import { formatNumber, plural } from '../../lib/format';
import { Button } from '../../ui/Button';
import { Segmented, Toggle } from '../../ui/Controls';
import { Stats } from '../../ui/Stats';
import { indexOfBlock, layoutRows, type SheetItem } from './layout';
import { buildReport } from './report';
import { ChangeBadge, ReviewContext, rowBadges, rowChanges, type Review } from './review';
import { ReviewPanel } from './ReviewPanel';
import { rejectedKeys, setRejected, settings, updateSettings, type DiffView } from './state';

/** Items drawn at once. Larger results get a "Show more" button, which keeps typing smooth. */
const PAGE = 500;

const VIEW_OPTIONS: { value: DiffView; label: string }[] = [
  { value: 'side', label: 'Side by side' },
  { value: 'single', label: 'Single column' },
];

interface Props {
  result: DiffResult;
  pending: boolean;
  names: { original: string; revised: string };
  /** The two texts `result` was computed from (which can lag behind the inputs while typing). */
  texts: { original: string; revised: string };
}

export function DiffViewer({ result, pending, names, texts }: Props) {
  const { view, hideUnchanged } = settings.value;
  const total = result.stats.blocks;
  const [current, setCurrent] = useState(0);
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(new Set());
  const [limit, setLimit] = useState(PAGE);
  const scrollTo = useRef(0);
  // Mirrors `current` without waiting for a render, so fast repeated key presses each move one step.
  const position = useRef(0);
  position.current = current;

  // Decisions are stored by change key; the sheet and panel work with this result's ids.
  const keys = rejectedKeys.value;
  const rejected = useMemo(() => {
    const set = new Set(keys);
    return new Set(result.changes.filter((c) => set.has(c.key)).map((c) => c.id));
  }, [keys, result]);
  const toggle = useCallback(
    (id: number) => {
      const change = result.changes[id - 1];
      if (change) setRejected([change.key], !rejected.has(id));
    },
    [result, rejected],
  );
  const review = useMemo<Review>(
    () => ({ changes: result.changes, rejected, toggle }),
    [result, rejected, toggle],
  );

  // A new result can shift every line: drop expanded folds and keep the cursor only if still valid.
  useEffect(() => {
    setExpanded(new Set());
    setLimit(PAGE);
    setCurrent((c) => (c <= total ? c : 0));
  }, [result, total]);

  const items = useMemo(
    () => layoutRows(result.rows, hideUnchanged, expanded),
    [result, hideUnchanged, expanded],
  );

  const goTo = (block: number) => {
    if (!total) return;
    const n = ((block - 1 + total) % total) + 1;
    const index = indexOfBlock(items, n);
    if (index >= limit) setLimit(index + PAGE);
    setCurrent(n);
    position.current = n;
    scrollTo.current = n;
  };
  const next = () => goTo(position.current + 1);
  const previous = () => goTo(position.current ? position.current - 1 : total);

  // Scroll after render so rows added by a larger limit exist in the page.
  useEffect(() => {
    if (!scrollTo.current) return;
    const el = document.querySelector(`.sheet [data-block="${scrollTo.current}"]`);
    scrollTo.current = 0;
    el?.scrollIntoView({
      block: 'center',
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
  });

  // Keyboard: j / n for next change, k / p for previous, unless typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || target.closest('input, textarea, [contenteditable]')) return;
      if (e.key === 'j' || e.key === 'n') next();
      else if (e.key === 'k' || e.key === 'p') previous();
      else return;
      e.preventDefault();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  return (
    <ReviewContext.Provider value={review}>
      <div class={`results${pending ? ' is-pending' : ''}`}>
        <Summary result={result} onJump={goTo} />
        {total > 0 && (
          <>
            {/* The wrapper bounds the sticky toolbar: it stops sticking once the sheet scrolls past. */}
            <div class="sheet-wrap">
              <div class="toolbar">
                <Segmented
                  label="Layout"
                  options={VIEW_OPTIONS}
                  value={view}
                  onChange={(v) => updateSettings({ view: v })}
                />
                <Toggle checked={hideUnchanged} onChange={(v) => updateSettings({ hideUnchanged: v })}>
                  Hide unchanged
                </Toggle>
                <span class="toolbar__spacer" />
                <div class="nav" role="group" aria-label="Changes">
                  <Button
                    size="sm"
                    icon="chevronUp"
                    iconOnly
                    label="Previous change (k)"
                    onClick={previous}
                  />
                  <span class="nav__pos" aria-live="polite">
                    {current ? `${current} of ${total}` : plural(total, 'change')}
                  </span>
                  <Button size="sm" icon="chevronDown" iconOnly label="Next change (j)" onClick={next} />
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  icon="copy"
                  onClick={() => void copyText(toUnifiedText(result.rows), 'Diff copied as text')}
                >
                  Copy diff
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  icon="download"
                  onClick={() =>
                    downloadText('redline-comparison.html', buildReport(result, names), 'text/html')
                  }
                >
                  Report
                </Button>
              </div>
              <Sheet
                items={items}
                limit={limit}
                view={view}
                current={current}
                onExpand={(start) => setExpanded(new Set(expanded).add(start))}
                onMore={() => setLimit(limit + PAGE)}
              />
            </div>
            <ReviewPanel result={result} texts={texts} onJump={goTo} />
          </>
        )}
      </div>
    </ReviewContext.Provider>
  );
}

function Summary({ result, onJump }: { result: DiffResult; onJump: (block: number) => void }) {
  const s = result.stats;
  if (s.blocks === 0) {
    return (
      <div class="card summary summary--same">
        <b>No differences</b>
        <span>
          Every line matches
          {settings.value.ignoreWhitespace || settings.value.ignoreCase
            ? ' (with the ignore options above)'
            : ''}
          .
        </span>
      </div>
    );
  }
  return (
    <div class="card summary">
      <p class="summary__verdict">
        {plural(s.blocks, 'place')} changed. About {s.retainedPercent}% of the original wording is still
        there.
      </p>
      {result.approximate && (
        <p class="note">
          These texts differ a lot, so some changes are shown as whole blocks rather than line by line.
        </p>
      )}
      <Stats
        items={[
          { label: 'Words added', value: `+${formatNumber(s.wordsAdded)}`, tone: 'add' },
          { label: 'Words removed', value: `−${formatNumber(s.wordsRemoved)}`, tone: 'del' },
          { label: 'Lines changed', value: formatNumber(s.linesChanged) },
          { label: 'Lines unchanged', value: formatNumber(s.linesUnchanged) },
          {
            label: 'Words, before → after',
            value: `${formatNumber(s.originalWords)} → ${formatNumber(s.newWords)}`,
          },
        ]}
      />
      <ChangeMap rows={result.rows} onJump={onJump} />
    </div>
  );
}

/** A strip showing where changes fall in the document; each mark jumps to its change. */
function ChangeMap({ rows, onJump }: { rows: DiffRow[]; onJump: (block: number) => void }) {
  const marks = useMemo(() => {
    const out: { kind: string; weight: number; block: number }[] = [];
    let i = 0;
    while (i < rows.length) {
      let j = i;
      const changed = rows[i].type !== 'equal';
      const kinds = new Set<string>();
      while (j < rows.length && (rows[j].type !== 'equal') === changed) kinds.add(rows[j++].type);
      const kind = !changed ? 'equal' : kinds.size === 1 && !rows[i].rewritten ? rows[i].type : 'change';
      out.push({ kind, weight: j - i, block: rows[i].block });
      i = j;
    }
    return out;
  }, [rows]);

  return (
    <div>
      <div class="map" aria-label="Where the changes are">
        {marks.map((m, k) =>
          m.kind === 'equal' ? (
            <span key={k} class="map__mark map__mark--equal" style={{ flexGrow: m.weight }} />
          ) : (
            <button
              key={k}
              type="button"
              class={`map__mark map__mark--${m.kind}`}
              style={{ flexGrow: m.weight }}
              aria-label={`Go to change ${m.block}`}
              title={`Change ${m.block}`}
              onClick={() => onJump(m.block)}
            />
          ),
        )}
      </div>
      <div class="map-key">
        <span>
          <i class="map__mark--change" />
          Reworded
        </span>
        <span>
          <i class="map__mark--delete" />
          Removed
        </span>
        <span>
          <i class="map__mark--insert" />
          Added
        </span>
        <span class="map-key__hint">Click a mark, or press J / K, to step through changes</span>
      </div>
    </div>
  );
}

function Sheet({
  items,
  limit,
  view,
  current,
  onExpand,
  onMore,
}: {
  items: SheetItem[];
  limit: number;
  view: DiffView;
  current: number;
  onExpand: (start: number) => void;
  onMore: () => void;
}) {
  const shown = items.slice(0, limit);
  return (
    <div class={`card sheet sheet--${view}`}>
      {view === 'side' && (
        <div class="sheet__head" aria-hidden="true">
          <span />
          <span>Original</span>
          <span />
          <span>Changed</span>
        </div>
      )}
      {shown.map((item) =>
        item.kind === 'fold' ? (
          <button key={item.key} type="button" class="fold" onClick={() => onExpand(item.start)}>
            Show {plural(item.hidden, 'unchanged line')}
          </button>
        ) : view === 'side' ? (
          <SideRow key={item.key} row={item.row} current={item.row.block === current && current > 0} />
        ) : (
          <SingleRow key={item.key} row={item.row} current={item.row.block === current && current > 0} />
        ),
      )}
      {items.length > limit && (
        <button type="button" class="fold fold--more" onClick={onMore}>
          Show more ({formatNumber(items.length - limit)} rows left)
        </button>
      )}
    </div>
  );
}

/**
 * Draws a cell's text. Inline edits become <del>/<ins>, each change preceded by
 * its number badge (where `badgeIf` allows). Whole-line cells draw plain text
 * after the badges listed in `badges`.
 */
function Segments({
  segs,
  whole,
  badges = [],
  badgeIf = () => true,
}: {
  segs: Segment[];
  whole: boolean;
  badges?: number[];
  badgeIf?: (id: number) => boolean;
}) {
  const { rejected } = useContext(ReviewContext);
  if (whole) {
    return (
      <>
        {badges.map((id) => (
          <ChangeBadge key={id} id={id} />
        ))}
        {segs.map((s) => s.text).join('')}
      </>
    );
  }
  const badged = new Set<number>();
  return (
    <>
      {segs.map((s, i) => {
        if (s.type === 'equal') return s.text;
        const id = s.change;
        const badge =
          id && !badged.has(id) && badgeIf(id) ? (badged.add(id), (<ChangeBadge id={id} />)) : null;
        const cls = id && rejected.has(id) ? 'is-rejected' : undefined;
        return (
          <Fragment key={i}>
            {badge}
            {s.type === 'delete' ? <del class={cls}>{s.text}</del> : <ins class={cls}>{s.text}</ins>}
          </Fragment>
        );
      })}
    </>
  );
}

/** True when every change in the row is rejected, so whole-line rows can show that. */
function useRowRejected(ids: number[]): boolean {
  const { rejected } = useContext(ReviewContext);
  return ids.length > 0 && ids.every((id) => rejected.has(id));
}

function rowClass(row: DiffRow, current: boolean, rejected: boolean): string {
  return `row row--${row.type}${row.rewritten ? ' row--rewritten' : ''}${current ? ' is-current' : ''}${
    rejected ? ' is-rejected' : ''
  }`;
}

function SideRow({ row, current }: { row: DiffRow; current: boolean }) {
  const whole = row.type !== 'change' || row.rewritten;
  const ids = rowChanges(row);
  const badges = rowBadges(row, useContext(ReviewContext).changes);
  const rejected = useRowRejected(ids);
  // Inline rows badge each change on the new side; pure deletions only exist on the original side.
  const onRight = new Set(row.right.map((s) => s.change).filter(Boolean));
  return (
    <div class={rowClass(row, current, whole && rejected)} data-block={row.block || undefined}>
      <span class="ln">{row.leftLine ?? ''}</span>
      <div class={`cell cell--left${row.left.length ? '' : ' cell--empty'}`}>
        <Segments
          segs={row.left}
          whole={whole}
          badges={row.type === 'delete' ? badges : []}
          badgeIf={(id) => !onRight.has(id)}
        />
      </div>
      <span class="ln ln--right">{row.rightLine ?? ''}</span>
      <div class={`cell cell--right${row.right.length ? '' : ' cell--empty'}`}>
        <Segments segs={row.right} whole={whole} badges={row.type === 'delete' ? [] : badges} />
      </div>
    </div>
  );
}

function SingleLine({
  kind,
  mark,
  line,
  children,
  block,
  current,
  rejected = false,
}: {
  kind: string;
  mark: string;
  line: number | null;
  children: ComponentChildren;
  block?: number;
  current: boolean;
  rejected?: boolean;
}) {
  return (
    <div
      class={`line line--${kind}${current ? ' is-current' : ''}${rejected ? ' is-rejected' : ''}`}
      data-block={block || undefined}
    >
      <span class="ln">{line ?? ''}</span>
      <span class="line__mark" aria-hidden="true">
        {mark}
      </span>
      <div class="cell">{children}</div>
    </div>
  );
}

function SingleRow({ row, current }: { row: DiffRow; current: boolean }) {
  const ids = rowChanges(row);
  const badges = rowBadges(row, useContext(ReviewContext).changes);
  const rejected = useRowRejected(ids);
  const whole = (segs: Segment[], shown: number[] = badges) => <Segments segs={segs} whole badges={shown} />;
  switch (row.type) {
    case 'equal':
      return (
        <SingleLine kind="equal" mark="" line={row.rightLine} current={false}>
          {whole(row.right, [])}
        </SingleLine>
      );
    case 'delete':
      return (
        <SingleLine
          kind="delete"
          mark="−"
          line={row.leftLine}
          block={row.block}
          current={current}
          rejected={rejected}
        >
          {whole(row.left)}
        </SingleLine>
      );
    case 'insert':
      return (
        <SingleLine
          kind="insert"
          mark="+"
          line={row.rightLine}
          block={row.block}
          current={current}
          rejected={rejected}
        >
          {whole(row.right)}
        </SingleLine>
      );
    default:
      if (row.rewritten) {
        return (
          <>
            <SingleLine
              kind="delete"
              mark="−"
              line={row.leftLine}
              block={row.block}
              current={current}
              rejected={rejected}
            >
              {whole(row.left)}
            </SingleLine>
            <SingleLine kind="insert" mark="+" line={row.rightLine} current={current} rejected={rejected}>
              {whole(row.right, [])}
            </SingleLine>
          </>
        );
      }
      return (
        <SingleLine kind="change" mark="~" line={row.rightLine} block={row.block} current={current}>
          <Segments segs={row.merged} whole={false} />
        </SingleLine>
      );
  }
}

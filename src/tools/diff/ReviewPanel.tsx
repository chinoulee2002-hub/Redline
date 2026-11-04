/**
 * Below the comparison: a checklist of numbered changes, and a box with either
 * instructions for an AI ("keep #1, reject #2…") or the final text itself.
 */
import { useContext, useMemo, useState } from 'preact/hooks';
import type { Change, ChangeKind, DiffResult } from '../../core/diff';
import { applyDecisions, buildReviewPrompt, describeWhere } from '../../core/review';
import { copyText } from '../../lib/clipboard';
import { formatNumber } from '../../lib/format';
import { Button } from '../../ui/Button';
import { Segmented, Toggle } from '../../ui/Controls';
import { Icon } from '../../ui/Icon';
import { PaneFrame, TextCounts } from '../../ui/Pane';
import { SendToMenu } from '../../ui/SendToMenu';
import { ReviewContext } from './review';
import { setRejected, settings, updateSettings, type Handoff } from './state';

/** Changes listed at once; the rest appear on request. */
const PAGE = 200;
/** Longer before/after texts are shortened in the list (the AI instructions keep them whole). */
const CLIP = 160;

const KIND_LABEL: Record<ChangeKind, string> = { replace: 'Reworded', insert: 'Added', delete: 'Removed' };

const HANDOFF_OPTIONS: { value: Handoff; label: string; title: string }[] = [
  { value: 'prompt', label: 'For AI', title: 'Instructions that refer to each change by number' },
  { value: 'final', label: 'Final text', title: 'The text with your decisions applied' },
];

const clip = (s: string) => (s.length > CLIP ? s.slice(0, CLIP) + '…' : s);

interface Props {
  result: DiffResult;
  texts: { original: string; revised: string };
  onJump: (block: number) => void;
}

export function ReviewPanel({ result, texts, onJump }: Props) {
  const { rejected } = useContext(ReviewContext);
  const { changes } = result;
  const keys = changes.map((c) => c.key);
  const rejectedCount = rejected.size;

  return (
    <section class="review" aria-label="Review changes">
      <div class="card review__list">
        <header class="review__head">
          <div>
            <h2>Review changes</h2>
            <p class="note">
              Ticked changes are kept. Untick the ones to undo, or click a number in the text.
            </p>
          </div>
          <div class="review__bulk">
            <span class="review__count">
              <b>{formatNumber(changes.length - rejectedCount)}</b> kept ·{' '}
              <b>{formatNumber(rejectedCount)}</b> rejected
            </span>
            <Button
              size="sm"
              variant="ghost"
              icon="check"
              disabled={!rejectedCount}
              onClick={() => setRejected(keys, false)}
            >
              Keep all
            </Button>
            <Button
              size="sm"
              variant="ghost"
              icon="x"
              disabled={rejectedCount === changes.length}
              onClick={() => setRejected(keys, true)}
            >
              Reject all
            </Button>
          </div>
        </header>
        <ChangeList changes={changes} onJump={onJump} />
      </div>
      <Handoff result={result} texts={texts} />
    </section>
  );
}

function ChangeList({ changes, onJump }: { changes: Change[]; onJump: (block: number) => void }) {
  const [limit, setLimit] = useState(PAGE);
  return (
    <>
      <ol class="review__items">
        {changes.slice(0, limit).map((c) => (
          <ChangeItem key={c.key} change={c} onJump={onJump} />
        ))}
      </ol>
      {changes.length > limit && (
        <button type="button" class="fold fold--more" onClick={() => setLimit(limit + PAGE)}>
          Show {formatNumber(Math.min(PAGE, changes.length - limit))} more of{' '}
          {formatNumber(changes.length - limit)}
        </button>
      )}
    </>
  );
}

function ChangeItem({ change: c, onJump }: { change: Change; onJump: (block: number) => void }) {
  const { rejected, toggle } = useContext(ReviewContext);
  const kept = !rejected.has(c.id);
  return (
    <li class={`review-item${kept ? '' : ' is-rejected'}`}>
      <label
        class="review-item__check"
        title={kept ? 'Kept: untick to undo this change' : 'Rejected: tick to keep it'}
      >
        <input
          type="checkbox"
          checked={kept}
          onChange={() => toggle(c.id)}
          aria-label={`Keep change #${c.id}`}
        />
        <span class="tick" aria-hidden="true">
          <Icon name="check" size={12} />
        </span>
        <span class="review-item__id">#{c.id}</span>
      </label>
      <button
        type="button"
        class="review-item__body"
        onClick={() => onJump(c.block)}
        title="Show in the comparison"
      >
        <span class="review-item__meta">
          <span class={`kind kind--${c.kind}`}>{KIND_LABEL[c.kind]}</span>
          <span>{describeWhere(c.where)}</span>
        </span>
        <span class="review-item__text">
          {c.before && <del>{clip(c.before)}</del>}
          {c.kind === 'replace' && <span class="review-item__arrow"> → </span>}
          {c.after && <ins>{clip(c.after)}</ins>}
        </span>
      </button>
    </li>
  );
}

function Handoff({ result, texts }: { result: DiffResult; texts: Props['texts'] }) {
  const { rejected } = useContext(ReviewContext);
  const { handoff, attachTexts } = settings.value;
  const output = useMemo(
    () =>
      handoff === 'final'
        ? applyDecisions(result.rows, rejected)
        : buildReviewPrompt(result.changes, rejected, { attachTexts, ...texts }),
    [handoff, attachTexts, result, rejected, texts],
  );

  return (
    <PaneFrame
      title={handoff === 'final' ? 'Final text' : 'Instructions for AI'}
      class="review__out"
      actions={
        <>
          <Segmented
            label="Show"
            options={HANDOFF_OPTIONS}
            value={handoff}
            onChange={(v) => updateSettings({ handoff: v })}
          />
          {handoff === 'final' && <SendToMenu from="diff" payload={() => ({ text: output })} />}
          <Button
            size="sm"
            variant="primary"
            icon="copy"
            onClick={() =>
              void copyText(
                output,
                handoff === 'final' ? 'Final text copied' : 'Copied. Paste it into your AI chat',
              )
            }
          >
            Copy
          </Button>
        </>
      }
      footer={
        <>
          {handoff === 'prompt' ? (
            <Toggle checked={attachTexts} onChange={(v) => updateSettings({ attachTexts: v })}>
              Include both full texts
            </Toggle>
          ) : (
            <span class="pane__file">Your decisions applied. No AI needed.</span>
          )}
          <TextCounts text={output} />
        </>
      }
    >
      <textarea
        class="editor editor--mono editor--output review__text"
        value={output}
        readOnly
        aria-label="Review output"
        spellcheck={false}
      />
    </PaneFrame>
  );
}

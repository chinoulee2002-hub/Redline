import { describe, expect, it } from 'vitest';
import { compareTexts, type DiffDetail, type DiffOptions } from '../../src/core/diff';
import { applyDecisions, buildReviewPrompt, formatIds } from '../../src/core/review';

const opts: DiffOptions = { ignoreWhitespace: false, ignoreCase: false, detail: 'word' };

const ORIGINAL = 'Work from home two days.\nKeep this line.\nOld closing line.';
const REVISED = 'Work remotely three days.\nKeep this line.\nNew line here.\nOld closing line.';

describe('numbered changes', () => {
  it('numbers each edit in document order', () => {
    const { changes } = compareTexts(ORIGINAL, REVISED, opts);
    expect(changes.map((c) => [c.id, c.kind, c.before, c.after])).toEqual([
      [1, 'replace', 'from home two', 'remotely three'],
      [2, 'insert', '', 'New line here.'],
    ]);
    expect(changes[0]).toMatchObject({
      where: { side: 'revised', from: 1, to: 1 },
      wholeLines: false,
      block: 1,
    });
    expect(changes[1]).toMatchObject({
      where: { side: 'revised', from: 3, to: 3 },
      wholeLines: true,
      block: 2,
    });
  });

  it('keeps shared spaces outside the edit', () => {
    const { changes } = compareTexts(
      'Work from home up to two days. A laptop and a monitor.',
      'Work remotely up to two days. A laptop, a monitor and a headset.',
      opts,
    );
    expect(changes.map((c) => [c.kind, c.before, c.after])).toEqual([
      ['replace', 'from home', 'remotely'],
      ['insert', '', ', a monitor'],
      ['replace', 'monitor', 'headset'],
    ]);
  });

  it('keeps the same ids whatever the display detail', () => {
    const ids = (detail: DiffDetail) =>
      compareTexts(ORIGINAL, REVISED, { ...opts, detail }).changes.map((c) => c.key);
    expect(ids('char')).toEqual(ids('word'));
    expect(ids('line')).toEqual(ids('word'));
  });

  it('gives a change the same key after unrelated edits', () => {
    const before = compareTexts(ORIGINAL, REVISED, opts).changes[0].key;
    const after = compareTexts('Intro.\n' + ORIGINAL, 'Intro, edited.\n' + REVISED, opts).changes;
    expect(after.map((c) => c.key)).toContain(before);
  });

  it('tags displayed segments with their change id', () => {
    const { rows } = compareTexts('the colour is red', 'the color is blue', { ...opts, detail: 'char' });
    // "colour"→"color" only removes a letter, so only "red"→"blue" (change 2) inserts on the right.
    const ids = rows[0].right.filter((s) => s.type === 'insert').map((s) => s.change);
    expect(ids).toEqual([2]);
    expect(rows[0].left.filter((s) => s.type === 'delete').map((s) => s.change)).toEqual([1, 2]);
  });
});

describe('applyDecisions', () => {
  it('rebuilds the new text, the original, or a mix', () => {
    const r = compareTexts(ORIGINAL, REVISED, opts);
    expect(applyDecisions(r.rows, new Set())).toBe(REVISED);
    expect(applyDecisions(r.rows, new Set([1, 2]))).toBe(ORIGINAL);
    expect(applyDecisions(r.rows, new Set([2]))).toBe(
      'Work remotely three days.\nKeep this line.\nOld closing line.',
    );
    expect(applyDecisions(r.rows, new Set([1]))).toBe(
      'Work from home two days.\nKeep this line.\nNew line here.\nOld closing line.',
    );
  });

  it('round-trips random texts in every detail mode', () => {
    let seed = 11;
    const rand = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
    const words = ['alpha', 'beta', 'gamma', 'delta', 'colour', 'color', 'x', ',', '.', '  '];
    const line = () =>
      Array.from({ length: Math.floor(rand() * 6) }, () => words[Math.floor(rand() * words.length)]).join(
        ' ',
      );
    const text = () => Array.from({ length: 1 + Math.floor(rand() * 6) }, line).join('\n');
    for (let t = 0; t < 200; t++) {
      const a = text();
      const b = rand() < 0.5 ? text() : a.replace(/beta/g, 'BETA').replace(/gamma\n/, 'new line\ngamma\n');
      for (const detail of ['word', 'char', 'line'] as const) {
        const r = compareTexts(a, b, { ...opts, detail });
        expect(applyDecisions(r.rows, new Set())).toBe(b);
        expect(applyDecisions(r.rows, new Set(r.changes.map((c) => c.id)))).toBe(a);
      }
    }
  });
});

describe('buildReviewPrompt', () => {
  it('lists each change with its decision and the summary lines', () => {
    const r = compareTexts(ORIGINAL, REVISED, opts);
    const prompt = buildReviewPrompt(r.changes, new Set([2]), {
      attachTexts: false,
      original: '',
      revised: '',
    });
    expect(prompt).toContain('Keep (1): #1');
    expect(prompt).toContain('Reject (1): #2');
    expect(prompt).toContain('#1 KEEP · line 1 · replaced "from home two" with "remotely three"');
    expect(prompt).toContain('    in: "Work remotely three days."');
    expect(prompt).toContain('#2 REJECT · line 3 · added "New line here."');
    expect(prompt).not.toContain('ORIGINAL TEXT');
  });

  it('attaches both texts when asked', () => {
    const r = compareTexts(ORIGINAL, REVISED, opts);
    const prompt = buildReviewPrompt(r.changes, new Set(), {
      attachTexts: true,
      original: ORIGINAL,
      revised: REVISED,
    });
    expect(prompt).toContain(`=== ORIGINAL TEXT ===\n${ORIGINAL}\n=== END OF ORIGINAL TEXT ===`);
    expect(prompt).toContain(`=== REVISED TEXT ===\n${REVISED}\n=== END OF REVISED TEXT ===`);
  });

  it('collapses consecutive ids into ranges', () => {
    expect(formatIds([1, 2, 3, 5, 7, 8])).toBe('#1–#3, #5, #7–#8');
    expect(formatIds([4])).toBe('#4');
  });
});

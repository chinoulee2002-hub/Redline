import { describe, expect, it } from 'vitest';
import { compareTexts, toUnifiedText, type DiffOptions, type Segment } from '../../src/core/diff';

const opts: DiffOptions = { ignoreWhitespace: true, ignoreCase: false, detail: 'word' };
const text = (segs: Segment[]) => segs.map((s) => s.text).join('');

describe('compareTexts', () => {
  it('reports identical texts as unchanged', () => {
    const r = compareTexts('a\nb', 'a\nb', opts);
    expect(r.stats.blocks).toBe(0);
    expect(r.rows.every((row) => row.type === 'equal')).toBe(true);
  });

  it('shows a reworded line word by word', () => {
    const r = compareTexts('work from home two days', 'work remotely three days', opts);
    const row = r.rows[0];
    expect(row.type).toBe('change');
    expect(row.rewritten).toBe(false);
    expect(text(row.left)).toBe('work from home two days');
    expect(text(row.right)).toBe('work remotely three days');
    expect(row.right.filter((s) => s.type === 'insert').map((s) => s.text)).toEqual(['remotely three']);
    expect(r.stats.wordsAdded).toBe(2);
    expect(r.stats.wordsRemoved).toBe(3);
  });

  it('marks very different lines as rewritten', () => {
    const r = compareTexts('alpha beta gamma delta', 'one two three four', opts);
    expect(r.rows[0].rewritten).toBe(true);
  });

  it('numbers change blocks and keeps line numbers', () => {
    const r = compareTexts('a\nb\nc\nd', 'a\nB\nc\nd\ne', opts);
    expect(r.stats.blocks).toBe(2);
    const inserted = r.rows.find((row) => row.type === 'insert')!;
    expect(inserted.rightLine).toBe(5);
    expect(inserted.block).toBe(2);
  });

  it('respects ignore case and whitespace', () => {
    expect(compareTexts('Hello   World', 'hello world', { ...opts, ignoreCase: true }).stats.blocks).toBe(0);
    expect(compareTexts('a  b', 'a b', { ...opts, ignoreWhitespace: false }).stats.blocks).toBe(1);
  });

  it('character detail highlights inside words', () => {
    const r = compareTexts('the colour is red', 'the color is red', { ...opts, detail: 'char' });
    const del = r.rows[0].left.filter((s) => s.type === 'delete').map((s) => s.text);
    expect(del).toEqual(['u']);
  });

  it('renders a unified text diff', () => {
    const r = compareTexts('a\nb', 'a\nc', opts);
    expect(toUnifiedText(r.rows)).toBe('  a\n- b\n+ c');
  });
});

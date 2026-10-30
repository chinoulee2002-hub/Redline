import { describe, expect, it } from 'vitest';
import { runRegex, type RegexRequest } from '../../src/core/regex';

const base: RegexRequest = { pattern: '', flags: 'g', text: '', replacement: null, maxMatches: 100 };

describe('runRegex', () => {
  it('finds all matches with groups', () => {
    const r = runRegex({ ...base, pattern: '(\\d+)-(?<unit>[a-z]+)', text: '10-kg and 5-m' });
    if (!r.ok) throw new Error(r.error);
    expect(r.total).toBe(2);
    expect(r.groupNames).toEqual(['1', 'unit']);
    expect(r.matches[1]).toMatchObject({ index: 10, end: 13, text: '5-m' });
    expect(r.matches[1].groups[1]).toMatchObject({ name: 'unit', value: 'm', start: 12, end: 13 });
  });

  it('respects the absence of the g flag', () => {
    const r = runRegex({ ...base, flags: '', pattern: 'a', text: 'aaa' });
    expect(r.ok && r.total).toBe(1);
  });

  it('survives empty matches', () => {
    const r = runRegex({ ...base, pattern: 'x*', text: 'abc' });
    expect(r.ok && r.total).toBe(4);
  });

  it('reports syntax errors', () => {
    const r = runRegex({ ...base, pattern: '(' });
    expect(r.ok).toBe(false);
  });

  it('replaces with group references', () => {
    const r = runRegex({ ...base, pattern: '(\\w+)@(\\w+)', text: 'me@host', replacement: '$2 at $1' });
    expect(r.ok && r.replaced).toBe('host at me');
  });

  it('ignores parentheses in classes and escapes when naming groups', () => {
    const r = runRegex({ ...base, pattern: '[(]\\((?<x>a)', text: '((a' });
    expect(r.ok && r.groupNames).toEqual(['x']);
  });
});

import { describe, expect, it } from 'vitest';
import { analyzeFrequency, frequencyToCsv, type FrequencyOptions } from '../../src/core/frequency';

const opts: FrequencyOptions = {
  ignoreCase: true,
  excludeStopwords: true,
  customStopwords: [],
  includeNumbers: false,
  minLength: 1,
  phraseLength: 1,
};

describe('analyzeFrequency', () => {
  const text = 'The cat sat. The cat ran! A dog sat on the mat in 2024.';

  it('counts words with stopwords removed', () => {
    const r = analyzeFrequency(text, opts);
    expect(r.entries.slice(0, 2)).toEqual([
      { term: 'cat', count: 2, share: 2 / 7 },
      { term: 'sat', count: 2, share: 2 / 7 },
    ]);
    expect(r.entries.find((e) => e.term === 'the')).toBeUndefined();
    expect(r.entries.find((e) => e.term === '2024')).toBeUndefined();
    expect(r.totals.words).toBe(14);
    expect(r.totals.sentences).toBe(3);
  });

  it('counts phrases without crossing sentences', () => {
    const r = analyzeFrequency(text, { ...opts, phraseLength: 2, excludeStopwords: false });
    expect(r.entries[0]).toMatchObject({ term: 'the cat', count: 2 });
    expect(r.entries.find((e) => e.term === 'sat the')).toBeUndefined();
  });

  it('keeps phrases whose inner words are stopwords', () => {
    const r = analyzeFrequency('terms of service and terms of service', { ...opts, phraseLength: 3 });
    expect(r.entries[0]).toMatchObject({ term: 'terms of service', count: 2 });
  });

  it('applies custom stopwords and minimum length', () => {
    const r = analyzeFrequency(text, { ...opts, customStopwords: ['cat'], minLength: 4 });
    expect(r.entries).toEqual([]);
  });

  it('exports CSV', () => {
    expect(frequencyToCsv([{ term: 'a "b"', count: 2, share: 0.5 }])).toBe(
      'rank,term,count,percent\n1,"a ""b""",2,50.00',
    );
  });
});

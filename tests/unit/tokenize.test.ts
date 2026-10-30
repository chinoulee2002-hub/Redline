import { describe, expect, it } from 'vitest';
import { countText, diffTokens } from '../../src/core/tokenize';

describe('countText', () => {
  it('counts words, code points and lines in one pass', () => {
    expect(countText('')).toEqual({ words: 0, chars: 0, lines: 0 });
    // h é l l o _ _ w ö r l d _ 👋 ⏎ n e x t = 19 code points
    expect(countText('héllo  wörld 👋\nnext')).toEqual({ words: 4, chars: 19, lines: 2 });
  });
});

describe('diffTokens', () => {
  it('splits into words, spaces and punctuation that rejoin losslessly', () => {
    const line = "It's a well-known fact, isn't it?";
    expect(diffTokens(line).join('')).toBe(line);
    expect(diffTokens(line)).toContain('well-known');
    expect(diffTokens(line)).toContain("It's");
  });
});

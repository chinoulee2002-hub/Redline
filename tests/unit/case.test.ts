import { describe, expect, it } from 'vitest';
import { convertCase, splitIdentifierWords } from '../../src/core/case';

describe('case conversion', () => {
  it('splits identifiers', () => {
    expect(splitIdentifierWords('XMLHttpRequest')).toEqual(['XML', 'Http', 'Request']);
    expect(splitIdentifierWords('user_id-value 42x')).toEqual(['user', 'id', 'value', '42', 'x']);
  });

  it('converts to programming cases', () => {
    const s = 'Hello wonderful World';
    expect(convertCase(s, 'camel')).toBe('helloWonderfulWorld');
    expect(convertCase(s, 'pascal')).toBe('HelloWonderfulWorld');
    expect(convertCase(s, 'snake')).toBe('hello_wonderful_world');
    expect(convertCase(s, 'kebab')).toBe('hello-wonderful-world');
    expect(convertCase(s, 'constant')).toBe('HELLO_WONDERFUL_WORLD');
    expect(convertCase(s, 'dot')).toBe('hello.wonderful.world');
    expect(convertCase('one two\nthree four', 'snake')).toBe('one_two\nthree_four');
  });

  it('title-cases with small words and deliberate caps', () => {
    expect(convertCase('the lord of the rings', 'title')).toBe('The Lord of the Rings');
    expect(convertCase('a guide to the iPhone and NASA', 'title')).toBe('A Guide to the iPhone and NASA');
    expect(convertCase('THE END OF IT', 'title')).toBe('The End of It');
    expect(convertCase('well-known facts: an intro', 'title')).toBe('Well-Known Facts: An Intro');
  });

  it('sentence-cases', () => {
    expect(convertCase('HELLO THERE. i AM HERE! ok?\nnew line', 'sentence')).toBe(
      'Hello there. I am here! Ok?\nNew line',
    );
  });

  it('handles Unicode', () => {
    expect(convertCase('straße café', 'upper')).toBe('STRASSE CAFÉ');
    expect(convertCase('élan vital', 'pascal')).toBe('ÉlanVital');
  });

  it('alternates and inverts', () => {
    expect(convertCase('hello world', 'alternating')).toBe('hElLo WoRlD');
    expect(convertCase('Hello', 'inverse')).toBe('hELLO');
  });
});

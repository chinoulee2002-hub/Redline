import { describe, expect, it } from 'vitest';
import { cleanText, type CleanStepId } from '../../src/core/clean';

const run = (text: string, ...steps: CleanStepId[]) => cleanText(text, steps).text;

describe('cleanText', () => {
  it('collapses and trims spacing', () => {
    expect(run('  a   b  \n\n\n\n c ', 'collapseSpaces', 'trimLines', 'collapseBlankLines')).toBe('a b\n\nc');
  });

  it('joins broken PDF lines and re-joins hyphenated words', () => {
    expect(run('This is a para-\ngraph that\nwraps.\n\nNext one.', 'joinLines')).toBe(
      'This is a paragraph that wraps.\n\nNext one.',
    );
  });

  it('strips HTML and decodes entities', () => {
    expect(run('<p>Tom &amp; Jerry</p><script>x()</script><br>&#169;', 'stripHtml')).toBe('Tom & Jerry\n\n©');
  });

  it('strips Markdown', () => {
    expect(run('# Title\n- **bold** and *it* [link](http://x)\n`code`', 'stripMarkdown')).toBe(
      'Title\nbold and it link\ncode',
    );
  });

  it('removes invisible characters, emoji and non-ASCII', () => {
    expect(run('a​b­c', 'removeInvisible')).toBe('abc');
    expect(run('hi 👋🏽 🇫🇷 👨‍👩‍👧!', 'removeEmoji')).toBe('hi   !');
    expect(run('café “ok”', 'straightenPunctuation', 'asciiOnly')).toBe('cafe "ok"');
  });

  it('dedupes and sorts lines naturally', () => {
    expect(run('b\na\nb\nitem 10\nitem 2', 'dedupeLines', 'sortLines')).toBe('a\nb\nitem 2\nitem 10');
  });

  it('runs steps in fixed order and reports steps with no effect', () => {
    const res = cleanText('a  b', ['trimLines', 'collapseSpaces']);
    expect(res.text).toBe('a b');
    expect(res.noEffect).toEqual(['trimLines']);
  });
});

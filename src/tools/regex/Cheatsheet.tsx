/** Clickable reference: tokens insert at the cursor in the pattern field, presets replace it. */

const TOKENS: [token: string, meaning: string][] = [
  ['.', 'Any character except newline'],
  ['\\d', 'Digit 0–9'],
  ['\\w', 'Letter, digit or _'],
  ['\\s', 'Whitespace'],
  ['\\D \\W \\S', 'Not digit / word / space'],
  ['\\b', 'Word boundary'],
  ['^', 'Start of line (with m)'],
  ['$', 'End of line (with m)'],
  ['[abc]', 'Any of a, b or c'],
  ['[^abc]', 'Anything but a, b, c'],
  ['[a-z]', 'Range a to z'],
  ['a*', 'Zero or more'],
  ['a+', 'One or more'],
  ['a?', 'Optional'],
  ['a{2,4}', 'Between 2 and 4'],
  ['a+?', 'As few as possible (lazy)'],
  ['(abc)', 'Capture group'],
  ['(?<name>abc)', 'Named group'],
  ['(?:abc)', 'Group without capturing'],
  ['a|b', 'a or b'],
  ['(?=abc)', 'Followed by'],
  ['(?!abc)', 'Not followed by'],
  ['(?<=abc)', 'Preceded by'],
  ['\\p{L}', 'Any letter, any language (u)'],
];

const PRESETS: [label: string, pattern: string, flags: string][] = [
  ['Email address', '[\\w.+-]+@[\\w-]+(?:\\.[\\w-]+)+', 'g'],
  ['URL', 'https?:\\/\\/[^\\s/$.?#][^\\s]*', 'gi'],
  ['Date (YYYY-MM-DD)', '\\b(\\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\\d|3[01])\\b', 'g'],
  ['Number', '-?\\b\\d{1,3}(?:,\\d{3})*(?:\\.\\d+)?\\b', 'g'],
  ['Hex colour', '#(?:[0-9a-fA-F]{3}){1,2}\\b', 'g'],
  ['Repeated word', '\\b(\\w+)\\s+\\1\\b', 'gi'],
  ['Extra spaces', ' {2,}', 'g'],
  ['Trailing whitespace', '[ \\t]+$', 'gm'],
];

export function Cheatsheet({
  onInsert,
  onPreset,
}: {
  onInsert: (token: string) => void;
  onPreset: (pattern: string, flags: string) => void;
}) {
  return (
    <div class="cheats">
      <section>
        <h2 class="section-label">Common patterns</h2>
        <div class="cheats__presets">
          {PRESETS.map(([label, p, f]) => (
            <button
              key={label}
              type="button"
              class="chip chip--preset"
              onClick={() => onPreset(p, f)}
              title={`/${p}/${f}`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>
      <section>
        <h2 class="section-label">Reference: click to insert</h2>
        <div class="cheats__grid">
          {TOKENS.map(([token, meaning]) => (
            <button key={token} type="button" class="cheat" onClick={() => onInsert(token.split(' ')[0])}>
              <code>{token}</code>
              <span>{meaning}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

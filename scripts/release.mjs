// Writes the two shipped forms of the single-file build:
// - Redline.html: a complete page to open from disk or any web host.
// - dist/artifact.html: the same page without the <html>/<head>/<body> wrapper, for claude.ai
//   artifacts, which add their own (with the charset and viewport tags).
import { copyFileSync, readFileSync, statSync, writeFileSync } from 'node:fs';

copyFileSync('dist/index.html', 'Redline.html');
console.log(`Redline.html written (${(statSync('Redline.html').size / 1024).toFixed(1)} KB)`);

writeFileSync('dist/artifact.html', unwrap(readFileSync('dist/index.html', 'utf8')));
console.log(`dist/artifact.html written (${(statSync('dist/artifact.html').size / 1024).toFixed(1)} KB)`);

/**
 * Removes only the page's own wrapper tags. The inlined scripts contain the same tags as text
 * (the HTML report template), so tags are located by position, never by a global replace.
 */
function unwrap(html) {
  const app = html.indexOf('<div id="app">');
  const bodyOpen = html.lastIndexOf('<body>', app);
  const headClose = html.lastIndexOf('</head>', bodyOpen);
  const bodyClose = html.lastIndexOf('</body>');
  if (app < 0 || bodyOpen < 0 || headClose < 0 || bodyClose < app) throw new Error('Unexpected build layout');

  let head = html.slice(0, headClose);
  const firstCode = head.search(/<script|<style/);
  const preamble = head
    .slice(0, firstCode)
    .replace(/<!doctype html>\s*/i, '')
    .replace(/<html\b[^>]*>\s*/i, '')
    .replace(/<head>\s*/i, '')
    .replace(/<meta charset[^>]*>\s*/i, '')
    .replace(/<meta\s+name="viewport"[^>]*>\s*/i, '');
  head = preamble + head.slice(firstCode);
  return `${head}\n${html.slice(bodyOpen + '<body>'.length, bodyClose)}\n`;
}

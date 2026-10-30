/**
 * Accessibility audit: runs axe-core (WCAG 2.1 A and AA rules) on every tool,
 * in light and dark themes, against the built single file.
 */
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const require = createRequire(import.meta.url);
const AXE = require.resolve('axe-core/axe.min.js');
const APP = pathToFileURL(fileURLToPath(new URL('../../dist/index.html', import.meta.url))).href;
const TOOLS = ['diff', 'case', 'regex', 'frequency', 'cleaner'];

let browser;
before(async () => {
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
});

for (const scheme of ['light', 'dark']) {
  for (const tool of TOOLS) {
    test(`${tool} has no serious accessibility violations (${scheme})`, async () => {
      const page = await browser.newPage({ colorScheme: scheme, viewport: { width: 1400, height: 1000 } });
      await page.goto(`${APP}#/${tool}`);
      await page.waitForTimeout(600);
      await page.addScriptTag({ path: AXE });
      const violations = await page.evaluate(async () => {
        const res = await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] });
        return res.violations
          .filter((v) => v.impact === 'serious' || v.impact === 'critical')
          .map(
            (v) =>
              `${v.id}: ${v.help}\n    ${v.nodes
                .slice(0, 4)
                .map((n) => n.target.join(' '))
                .join('\n    ')}`,
          );
      });
      await page.close();
      assert.deepEqual(violations, [], violations.join('\n'));
    });
  }
}

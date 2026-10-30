/**
 * End-to-end smoke tests against the built single file (dist/index.html), opened from file://
 * exactly as a user would. Run with `npm run test:e2e` (builds first).
 */
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { makeDocx } from '../helpers/zip.mjs';

const APP = pathToFileURL(fileURLToPath(new URL('../../dist/index.html', import.meta.url))).href;

let browser;
before(async () => {
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
});

/** A fresh page (empty storage) that fails the test on any console error. */
async function open(hash, { noWorkers = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
  if (noWorkers) await context.addInitScript(() => delete window.Worker);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(`${APP}#/${hash}`);
  page.assertNoErrors = () => assert.deepEqual(errors, []);
  return page;
}

describe('Redline', () => {
  test('lists all five tools in the sidebar', async () => {
    const page = await open('diff');
    const names = await page.locator('.nav-link__name').allTextContents();
    assert.deepEqual(names, [
      'Diff Checker',
      'Case Converter',
      'Regex Playground',
      'Word Frequency',
      'Text Cleaner',
    ]);
    page.assertNoErrors();
  });

  test('diff compares the example and updates as you type', async () => {
    const page = await open('diff');
    await page.getByText('3 places changed').waitFor();
    await page.getByLabel('Changed text').fill('Remote Work Policy');
    await page.getByLabel('Original text').fill('Remote Work Rules');
    await page.getByText('1 place changed').waitFor();
    assert.equal(await page.locator('.sheet ins').first().textContent(), 'Policy');
    page.assertNoErrors();
  });

  test('diff imports a Word document', async () => {
    const page = await open('diff');
    await page
      .locator('input[type=file]')
      .first()
      .setInputFiles({
        name: 'contract.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        buffer: makeDocx(['First clause & terms', 'Second clause']),
      });
    await page.getByText('contract.docx').waitFor();
    assert.equal(await page.getByLabel('Original text').inputValue(), 'First clause & terms\nSecond clause');
    page.assertNoErrors();
  });

  test('diff still works when Web Workers are unavailable', async () => {
    const page = await open('diff', { noWorkers: true });
    await page.getByText('3 places changed').waitFor();
    page.assertNoErrors();
  });

  test('case converter switches format from the cards', async () => {
    const page = await open('case');
    await page.getByLabel('Input', { exact: true }).fill('Hello big World');
    await page.getByRole('radio', { name: /snake_case/ }).click();
    await page.waitForFunction(() => document.querySelector('.editor--output')?.value === 'hello_big_world');
    page.assertNoErrors();
  });

  test('regex highlights matches and stops runaway patterns', async () => {
    const page = await open('regex');
    await page.getByText('3 matches').waitFor();
    assert.equal(await page.locator('.hl mark').count(), 3);

    await page.getByLabel('Test text').fill('a'.repeat(40) + '!');
    await page.getByLabel('Regular expression').fill('(a+)+$');
    await page.getByText(/Stopped after \d+ ms/).waitFor();

    // The killed worker is replaced, so the next pattern works again.
    await page.getByLabel('Regular expression').fill('a{2}');
    await page.getByText('20 matches').waitFor();
    page.assertNoErrors();
  });

  test('regex reports syntax errors inline', async () => {
    const page = await open('regex');
    await page.getByLabel('Regular expression').fill('(unclosed');
    await page.locator('.pattern-status.is-error').waitFor();
    page.assertNoErrors();
  });

  test('word frequency ranks the example', async () => {
    const page = await open('frequency');
    await page.locator('.freq__table tbody tr').first().waitFor();
    const first = await page.locator('.freq__table tbody tr').first().locator('td').allTextContents();
    assert.equal(first[1], 'writing');
    assert.equal(first[2], '6');
    await page.getByRole('radio', { name: '2-word phrases' }).click();
    await page.getByText('Phrase', { exact: true }).waitFor();
    page.assertNoErrors();
  });

  test('cleaner output can be sent to the diff checker', async () => {
    const page = await open('cleaner');
    await page.waitForFunction(() =>
      /Quarterly report/.test(document.querySelector('.editor--output')?.value ?? ''),
    );
    const output = await page.locator('.editor--output').inputValue();
    assert.ok(!/ {2}/.test(output), 'no double spaces remain');

    await page.getByRole('button', { name: 'Send to' }).click();
    await page.getByRole('menuitem', { name: 'Diff Checker' }).click();
    await page.waitForURL(/#\/diff$/);
    assert.equal(await page.getByLabel('Changed text').inputValue(), output);
    await page.locator('.summary__verdict').waitFor();
    page.assertNoErrors();
  });

  test('command palette navigates between tools', async () => {
    const page = await open('diff');
    await page.keyboard.press('Control+k');
    await page.getByLabel('Search tools and actions').fill('regex');
    await page.keyboard.press('Enter');
    await page.waitForURL(/#\/regex$/);
    await page.getByRole('heading', { name: 'Regex Playground' }).waitFor();
    page.assertNoErrors();
  });
});

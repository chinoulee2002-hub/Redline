import { describe, expect, it } from 'vitest';
import { readZipText, ZipError } from '../../src/lib/zip';
import { makeZip } from '../helpers/zip.mjs';

const buffer = (b: Uint8Array) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;

describe('readZipText', () => {
  const zip = buffer(
    makeZip([
      { name: 'a.txt', text: 'stored text', store: true },
      { name: 'dir/b.xml', text: 'déflated <xml/> '.repeat(50) },
    ]),
  );

  it('reads stored and deflated entries', async () => {
    expect(await readZipText(zip, 'a.txt')).toBe('stored text');
    expect(await readZipText(zip, 'dir/b.xml')).toBe('déflated <xml/> '.repeat(50));
  });

  it('returns null for a missing entry', async () => {
    expect(await readZipText(zip, 'nope')).toBeNull();
  });

  it('rejects data that is not a zip', async () => {
    await expect(
      readZipText(new TextEncoder().encode('hello, not a zip archive at all').buffer, 'x'),
    ).rejects.toBeInstanceOf(ZipError);
  });
});

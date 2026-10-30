/**
 * Minimal .zip reader: finds one file by name and returns its text.
 * Uses the browser's built-in DecompressionStream, so reading .docx files
 * needs no library. Handles stored and deflated entries (all that .docx uses);
 * ZIP64 archives (over 4 GB) are not supported.
 *
 * Format reference: PKWARE APPNOTE.TXT, sections 4.3.7 (local header),
 * 4.3.12 (central directory) and 4.3.16 (end of central directory).
 */

const END_OF_DIRECTORY = 0x06054b50;
const DIRECTORY_ENTRY = 0x02014b50;
const LOCAL_HEADER = 0x04034b50;

export class ZipError extends Error {}

/** Returns the named entry's contents as UTF-8 text, or null if the archive has no such entry. */
export async function readZipText(data: ArrayBuffer, name: string): Promise<string | null> {
  const view = new DataView(data);
  const utf8 = new TextDecoder();

  // The end-of-directory record sits in the last 22 bytes, plus up to 64 KB of archive comment.
  let end = -1;
  for (let i = data.byteLength - 22; i >= Math.max(0, data.byteLength - 22 - 0xffff); i--) {
    if (view.getUint32(i, true) === END_OF_DIRECTORY) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new ZipError('Not a zip archive.');

  const entries = view.getUint16(end + 10, true);
  let p = view.getUint32(end + 16, true);
  for (let n = 0; n < entries; n++) {
    if (view.getUint32(p, true) !== DIRECTORY_ENTRY) throw new ZipError('Damaged zip directory.');
    const method = view.getUint16(p + 10, true);
    const compressedSize = view.getUint32(p + 20, true);
    const nameLength = view.getUint16(p + 28, true);
    const extraLength = view.getUint16(p + 30, true);
    const commentLength = view.getUint16(p + 32, true);
    const localOffset = view.getUint32(p + 42, true);

    if (utf8.decode(new Uint8Array(data, p + 46, nameLength)) === name) {
      if (view.getUint32(localOffset, true) !== LOCAL_HEADER) throw new ZipError('Damaged zip entry.');
      // The local header repeats the name and has its own extra field, which may differ in length.
      const start =
        localOffset + 30 + view.getUint16(localOffset + 26, true) + view.getUint16(localOffset + 28, true);
      const bytes = new Uint8Array(data, start, compressedSize);
      if (method === 0) return utf8.decode(bytes);
      if (method === 8) {
        const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        return new Response(stream).text();
      }
      throw new ZipError(`Unsupported zip compression method ${method}.`);
    }
    p += 46 + nameLength + extraLength + commentLength;
  }
  return null;
}

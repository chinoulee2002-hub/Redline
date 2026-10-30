/** Builds a valid .zip in memory (Node only), for testing the zip and .docx readers. */
import { crc32, deflateRawSync } from 'node:zlib';

/** @param {{ name: string, text: string, store?: boolean }[]} files */
export function makeZip(files) {
  const locals = [];
  const directory = [];
  let offset = 0;
  for (const f of files) {
    const name = Buffer.from(f.name);
    const raw = Buffer.from(f.text);
    const data = f.store ? raw : deflateRawSync(raw);
    const method = f.store ? 0 : 8;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(crc32(raw), 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    locals.push(local, name, data);

    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4);
    entry.writeUInt16LE(20, 6);
    entry.writeUInt16LE(method, 10);
    entry.writeUInt32LE(crc32(raw), 16);
    entry.writeUInt32LE(data.length, 20);
    entry.writeUInt32LE(raw.length, 24);
    entry.writeUInt16LE(name.length, 28);
    entry.writeUInt32LE(offset, 42);
    directory.push(entry, name);
    offset += 30 + name.length + data.length;
  }
  const dir = Buffer.concat(directory);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(dir.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, dir, end]);
}

/** A minimal Word document whose paragraphs are `paragraphs`. */
export function makeDocx(paragraphs) {
  const body = paragraphs
    .map(
      (p) =>
        `<w:p><w:r><w:t xml:space="preserve">${p.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</w:t></w:r></w:p>`,
    )
    .join('');
  return makeZip([
    { name: '[Content_Types].xml', text: '<?xml version="1.0"?><Types/>' },
    {
      name: 'word/document.xml',
      text: `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`,
    },
  ]);
}

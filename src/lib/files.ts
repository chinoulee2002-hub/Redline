/** Reading dropped or picked files into plain text. */
import { readZipText } from './zip';

export const ACCEPTED_FILES =
  '.txt,.md,.markdown,.csv,.tsv,.json,.html,.htm,.xml,.docx,.rtf,.log,.yaml,.yml,.js,.ts,.py,.css,text/*';

export async function readFileAsText(file: File): Promise<string> {
  if (/\.docx$/i.test(file.name)) return readDocx(file);
  if (/\.(pdf|doc|pages|odt)$/i.test(file.name)) {
    throw new Error('That format cannot be read here. Copy the text from the document and paste it in.');
  }
  return file.text();
}

/** A .docx is a zip; the body text lives in word/document.xml as <w:p> paragraphs of <w:t> runs. */
async function readDocx(file: File): Promise<string> {
  const documentXml = await readZipText(await file.arrayBuffer(), 'word/document.xml').catch(() => null);
  if (documentXml === null) throw new Error('This does not look like a Word document.');
  const xml = new DOMParser().parseFromString(documentXml, 'application/xml');
  const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const paragraphs = Array.from(xml.getElementsByTagNameNS(W, 'p'));
  return paragraphs
    .map((p) => {
      let text = '';
      for (const node of Array.from(p.getElementsByTagNameNS(W, '*'))) {
        if (node.localName === 't') text += node.textContent ?? '';
        else if (node.localName === 'tab') text += '\t';
        else if (node.localName === 'br') text += '\n';
      }
      return text;
    })
    .join('\n');
}

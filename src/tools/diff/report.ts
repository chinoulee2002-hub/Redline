/** Builds a standalone HTML report of a comparison, for sharing or archiving. */
import type { DiffResult, Segment } from '../../core/diff';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

function segs(list: Segment[], whole: boolean): string {
  if (whole) return esc(list.map((s) => s.text).join(''));
  return list
    .map((s) => (s.type === 'equal' ? esc(s.text) : `<${s.type === 'delete' ? 'del' : 'ins'}>${esc(s.text)}</${s.type === 'delete' ? 'del' : 'ins'}>`))
    .join('');
}

export function buildReport(result: DiffResult, names: { original: string; revised: string }): string {
  const { stats } = result;
  const rows = result.rows
    .map((r) => {
      const whole = r.type !== 'change' || r.rewritten;
      return `<tr class="${r.type}"><td class="n">${r.leftLine ?? ''}</td><td class="l">${segs(r.left, whole)}</td><td class="n">${r.rightLine ?? ''}</td><td class="r">${segs(r.right, whole)}</td></tr>`;
    })
    .join('\n');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Redline comparison</title>
<style>
body{font:15px/1.55 system-ui,sans-serif;color:#18212b;margin:32px auto;max-width:1100px;padding:0 16px}
h1{font-size:22px;margin:0 0 4px}p{color:#5a6877;margin:0 0 20px}
table{border-collapse:collapse;width:100%;table-layout:fixed;font-family:Georgia,serif;font-size:15px}
td{vertical-align:top;padding:3px 10px;white-space:pre-wrap;overflow-wrap:anywhere;border-top:1px solid #eef1f4}
td.n{width:40px;color:#8a96a3;font:12px/2 system-ui;text-align:right}
th{text-align:left;font:600 13px system-ui;color:#5a6877;padding:6px 10px;border-bottom:1px solid #d8dee5}
tr.change td.l,tr.delete td.l{background:#fde6e4}tr.change td.r,tr.insert td.r{background:#dcf3e4}
del{background:#f6b4ae;color:#9c2018}ins{background:#9ad8b0;color:#11663a;text-decoration:none}
</style></head><body>
<h1>${esc(names.original)} → ${esc(names.revised)}</h1>
<p>${stats.blocks} places changed · +${stats.wordsAdded} words added · −${stats.wordsRemoved} removed · ${stats.retainedPercent}% of the original wording kept · generated ${esc(new Date().toLocaleString())}</p>
<table><thead><tr><th></th><th>Original</th><th></th><th>New</th></tr></thead><tbody>
${rows}
</tbody></table></body></html>`;
}

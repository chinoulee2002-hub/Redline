// Copies the single-file build to the repo root as Redline.html, the file people open or share.
import { copyFileSync, statSync } from 'node:fs';

copyFileSync('dist/index.html', 'Redline.html');
console.log(`Redline.html written (${(statSync('Redline.html').size / 1024).toFixed(1)} KB)`);

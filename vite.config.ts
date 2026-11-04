import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// The production build is one self-contained HTML file (dist/index.html):
// every script, stylesheet and worker is inlined so it runs offline and from file://.
export default defineConfig({
  plugins: [viteSingleFile({ removeViteModuleLoader: true })],
  esbuild: { jsx: 'automatic', jsxImportSource: 'preact' },
  // Safari 14 (2020) and later: covers older iPhones and Macs that no longer update.
  build: { target: ['es2020', 'safari14'], reportCompressedSize: true },
  worker: { format: 'iife' },
  test: { include: ['tests/unit/**/*.test.ts'], environment: 'node' },
});

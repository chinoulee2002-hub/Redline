import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// The production build is one self-contained HTML file (dist/index.html):
// every script, stylesheet and worker is inlined so it runs offline and from file://.
export default defineConfig({
  plugins: [viteSingleFile({ removeViteModuleLoader: true })],
  esbuild: { jsx: 'automatic', jsxImportSource: 'preact' },
  build: { target: 'es2022', reportCompressedSize: true },
  worker: { format: 'iife' },
  test: { include: ['tests/unit/**/*.test.ts'], environment: 'node' },
});

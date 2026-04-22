import { createRequire } from 'node:module';
import { dirname, join, sep } from 'node:path';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { setStandardFontDataUrl } from '@pdf-diff/core';

const require = createRequire(import.meta.url);

// Empty workerSrc forces fake-worker mode: all pdfjs processing runs on the main thread.
// Real worker_threads write to fd-1 directly, bypassing any JS-level stdout/console overrides.
pdfjsLib.GlobalWorkerOptions.workerSrc = '';

// NodeStandardFontDataFactory uses fs.readFile(url) — needs a plain filesystem path, not a file:// URL
const pdfjsDir = dirname(require.resolve('pdfjs-dist/package.json'));
setStandardFontDataUrl(join(pdfjsDir, 'standard_fonts') + sep);

// pdfjs warn() calls console.log('Warning: ...') — filter to keep stdout clean for JSON piping
const origLog = console.log.bind(console);
console.log = (...args: unknown[]) => {
  if (typeof args[0] === 'string' && (args[0] as string).startsWith('Warning:')) return;
  origLog(...args);
};

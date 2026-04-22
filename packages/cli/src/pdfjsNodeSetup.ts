import { createRequire } from 'node:module';
import { dirname, join, sep } from 'node:path';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { setStandardFontDataUrl, setPdfjsVerbosityLevel } from '@pdf-diff/core';

const require = createRequire(import.meta.url);

// Empty workerSrc forces fake-worker mode: all pdfjs processing runs on the main thread.
// Real worker_threads write to fd-1 directly, bypassing any JS-level stdout/console overrides.
pdfjsLib.GlobalWorkerOptions.workerSrc = '';

// NodeStandardFontDataFactory uses fs.readFile(url) — needs a plain filesystem path, not a file:// URL
const pdfjsDir = dirname(require.resolve('pdfjs-dist/package.json'));
setStandardFontDataUrl(join(pdfjsDir, 'standard_fonts') + sep);

// VerbosityLevel.ERRORS = 0: suppresses font/glyph warnings from both main thread and worker.
// pdfjs propagates verbosity to the worker thread via workerParams before spawning it.
setPdfjsVerbosityLevel(0);

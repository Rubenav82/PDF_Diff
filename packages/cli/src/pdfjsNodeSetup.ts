import { createRequire } from 'node:module';
import { dirname, join, sep } from 'node:path';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { setStandardFontDataUrl } from '@pdf-diff/core';

const require = createRequire(import.meta.url);

const workerPath = require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs');
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(`file://${workerPath}`).href;

// NodeStandardFontDataFactory uses fs.readFile(url) — needs a plain filesystem path, not a file:// URL
const pdfjsDir = dirname(require.resolve('pdfjs-dist/package.json'));
setStandardFontDataUrl(join(pdfjsDir, 'standard_fonts') + sep);

// pdfjs warn() calls console.log, which in worker_threads writes directly to process.stdout
// (worker threads share the parent's stdio, so console overrides on the main thread don't apply)
// Filter Warning: lines here to keep CLI output clean regardless of thread origin
const origWrite = process.stdout.write.bind(process.stdout);
process.stdout.write = (chunk: string | Uint8Array, ...args: any[]): boolean => {
  const text = typeof chunk === 'string' ? chunk : Buffer.from(chunk as Buffer).toString('utf8');
  if (text.startsWith('Warning:')) {
    const cb = args.find((a): a is () => void => typeof a === 'function');
    if (cb) cb();
    return true;
  }
  return origWrite(chunk, ...args);
};

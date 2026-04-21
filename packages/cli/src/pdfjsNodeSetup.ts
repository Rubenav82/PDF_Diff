import { createRequire } from 'node:module';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

const require = createRequire(import.meta.url);
const workerPath = require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs');
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(`file://${workerPath}`).href;

// pdfjs writes diagnostic warnings via console.log to stdout — redirect to stderr
// so they don't corrupt JSON output in CLI usage
const _origLog = console.log.bind(console);
console.log = (...args: unknown[]) => {
  if (typeof args[0] === 'string' && args[0].startsWith('Warning:')) {
    process.stderr.write(args.join(' ') + '\n');
  } else {
    _origLog(...args);
  }
};

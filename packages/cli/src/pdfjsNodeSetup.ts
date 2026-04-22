import { createRequire } from 'node:module';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

const require = createRequire(import.meta.url);
const workerPath = require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs');
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(`file://${workerPath}`).href;

// pdfjs writes diagnostic warnings via console.log/console.warn — suppress them
// entirely so they don't corrupt JSON output or pollute CLI stderr
const _origLog = console.log.bind(console);
const _origWarn = console.warn.bind(console);
const isPdfjsNoise = (msg: unknown) =>
  typeof msg === 'string' && (msg.startsWith('Warning:') || msg.startsWith('Error:'));
console.log = (...args: unknown[]) => { if (!isPdfjsNoise(args[0])) _origLog(...args); };
console.warn = (...args: unknown[]) => { if (!isPdfjsNoise(args[0])) _origWarn(...args); };

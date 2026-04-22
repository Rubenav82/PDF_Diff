import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { setStandardFontDataUrl } from '@pdf-diff/core';

const require = createRequire(import.meta.url);

const workerPath = require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs');
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(`file://${workerPath}`).href;

const pdfjsDir = dirname(require.resolve('pdfjs-dist/package.json'));
setStandardFontDataUrl(pathToFileURL(join(pdfjsDir, 'standard_fonts') + '/').href);

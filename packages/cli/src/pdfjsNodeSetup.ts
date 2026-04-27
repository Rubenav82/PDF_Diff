import { createRequire } from 'node:module';
import { dirname, join, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { setStandardFontDataUrl, setPdfjsVerbosityLevel } from '@pdf-diff/core';

const require = createRequire(import.meta.url);

const workerPath = require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs');
pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;

// NodeStandardFontDataFactory usa fs.readFile(url) — necesita una ruta del sistema de archivos sin procesar, no una URL file://
const pdfjsDir = dirname(require.resolve('pdfjs-dist/package.json'));
setStandardFontDataUrl(join(pdfjsDir, 'standard_fonts') + sep);

// VerbosityLevel.ERRORS = 0: suprime advertencias de fuentes/glifos del hilo principal y del worker.
// pdfjs propaga el nivel de verbosidad al hilo worker a través de workerParams antes de generarlo.
setPdfjsVerbosityLevel(0);

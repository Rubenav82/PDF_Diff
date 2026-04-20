import { renderPageToCanvas } from './pdfService';

const MIN_MEANINGFUL_CHARS = 20;

export function needsOcr(pageText: string): boolean {
  const nonWhitespace = pageText.replace(/\s+/g, '');
  return nonWhitespace.length < MIN_MEANINGFUL_CHARS;
}

export interface OcrProgress {
  current: number;
  total: number;
  page: number;
}

export interface OcrOptions {
  languages?: string;
  signal?: AbortSignal;
  onProgress?: (progress: OcrProgress) => void;
}

type TesseractModule = typeof import('tesseract.js');

let tesseractPromise: Promise<TesseractModule> | null = null;

function loadTesseract(): Promise<TesseractModule> {
  if (!tesseractPromise) {
    tesseractPromise = import('tesseract.js');
  }
  return tesseractPromise;
}

async function renderPageForOcr(file: File, pageNum: number): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  const task = renderPageToCanvas(file, pageNum, canvas);
  await task.promise;
  return canvas;
}

export async function runOcrOnPages(
  file: File,
  pageNumbers: number[],
  options: OcrOptions = {}
): Promise<Map<number, string>> {
  const results = new Map<number, string>();
  if (pageNumbers.length === 0) return results;

  const languages = options.languages ?? 'spa+eng';
  const tesseract = await loadTesseract();
  const worker = await tesseract.createWorker(languages);

  try {
    for (let i = 0; i < pageNumbers.length; i++) {
      if (options.signal?.aborted) {
        throw new DOMException('OCR cancelado.', 'AbortError');
      }
      const pageNum = pageNumbers[i];
      const canvas = await renderPageForOcr(file, pageNum);
      const { data } = await worker.recognize(canvas);
      results.set(pageNum, data.text ?? '');
      options.onProgress?.({ current: i + 1, total: pageNumbers.length, page: pageNum });
    }
  } finally {
    await worker.terminate();
  }

  return results;
}

export function pickPagesNeedingOcr(pages: string[]): number[] {
  const out: number[] = [];
  pages.forEach((text, idx) => {
    if (needsOcr(text)) out.push(idx + 1);
  });
  return out;
}

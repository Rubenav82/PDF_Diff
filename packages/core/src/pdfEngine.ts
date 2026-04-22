import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { CanvasProvider, CanvasLike } from './canvasProvider.js';

let _standardFontDataUrl: string | undefined;
export function setStandardFontDataUrl(url: string): void {
  _standardFontDataUrl = url;
}

let _verbosityLevel: number | undefined;
export function setPdfjsVerbosityLevel(level: number): void {
  _verbosityLevel = level;
}

function docOptions(data: Uint8Array): object {
  const opts: Record<string, unknown> = { data };
  if (_standardFontDataUrl) opts.standardFontDataUrl = _standardFontDataUrl;
  if (_verbosityLevel !== undefined) opts.verbosity = _verbosityLevel;
  return opts;
}

export interface PdfRenderResult {
  canvas: CanvasLike;
  width: number;
  height: number;
}

export interface PdfRenderTask {
  promise: Promise<PdfRenderResult>;
  cancel(): void;
}

export async function getPdfPageCountFromBuffer(buffer: Uint8Array): Promise<number> {
  const loadingTask = pdfjsLib.getDocument(docOptions(buffer.slice()));
  const pdf = await loadingTask.promise;
  return pdf.numPages;
}

export async function extractTextFromBuffer(buffer: Uint8Array): Promise<string[]> {
  const loadingTask = pdfjsLib.getDocument(docOptions(buffer.slice()));
  const pdf = await loadingTask.promise;
  const pageTexts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = (textContent.items as { str?: string }[])
      .map((item) => item.str || '')
      .join(' ');
    pageTexts.push(pageText);
  }
  return pageTexts;
}

export function renderPageToProvider(
  buffer: Uint8Array,
  pageNum: number,
  provider: CanvasProvider,
  scale = 2.0
): PdfRenderTask {
  let pdfLoadingTask: ReturnType<typeof pdfjsLib.getDocument> | null = null;
  let pdfRenderTask: { promise: Promise<void>; cancel(): void } | null = null;
  let isSettled = false;

  const promise = new Promise<PdfRenderResult>((resolve, reject) => {
    const safeResolve = (v: PdfRenderResult) => {
      if (!isSettled) { isSettled = true; resolve(v); }
    };
    const safeReject = (e: unknown) => {
      if (!isSettled) { isSettled = true; reject(e); }
    };

    void (async () => {
      try {
        pdfLoadingTask = pdfjsLib.getDocument(docOptions(buffer.slice()));
        const pdf = await pdfLoadingTask.promise;

        if (pageNum < 1 || pageNum > pdf.numPages) {
          const canvas = provider.createCanvas(800, 100);
          const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | null;
          if (ctx) {
            ctx.clearRect(0, 0, 800, 100);
          }
          return safeResolve({ canvas, width: 0, height: 0 });
        }

        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale });
        const canvas = provider.createCanvas(viewport.width, viewport.height);
        const ctx = canvas.getContext('2d');
        if (!ctx) return safeReject(new Error('Could not get 2D canvas context.'));

        const renderContext = {
          canvasContext: ctx as CanvasRenderingContext2D,
          viewport,
        };

        pdfRenderTask = page.render(renderContext);
        await pdfRenderTask.promise;
        safeResolve({ canvas, width: viewport.width, height: viewport.height });
      } catch (e) {
        safeReject(e);
      }
    })();
  });

  return {
    promise,
    cancel() {
      if (pdfRenderTask) pdfRenderTask.cancel();
      if (pdfLoadingTask) void pdfLoadingTask.destroy();
    },
  };
}

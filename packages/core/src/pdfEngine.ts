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
  try {
    return pdf.numPages;
  } finally {
    void pdf.destroy();
  }
}

/**
 * Extrae contenido de texto de todas las páginas de un PDF.
 * @param buffer Archivo PDF como Uint8Array.
 * @returns Array de strings de texto, donde índice 0 = página 1, índice 1 = página 2, etc.
 * @throws Si el PDF no puede cargarse o falla la extracción de texto.
 */
export async function extractTextFromBuffer(buffer: Uint8Array): Promise<string[]> {
  const loadingTask = pdfjsLib.getDocument(docOptions(buffer.slice()));
  const pdf = await loadingTask.promise;
  try {
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
  } finally {
    void pdf.destroy();
  }
}

async function renderPageWithPdf(
  pdf: any,
  pageNum: number,
  provider: CanvasProvider,
  scale: number
): Promise<PdfRenderResult> {
  if (pageNum < 1 || pageNum > pdf.numPages) {
    const canvas = provider.createCanvas(800, 100);
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | null;
    if (ctx) {
      ctx.clearRect(0, 0, 800, 100);
    }
    return { canvas, width: 0, height: 0 };
  }

  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale });
  const canvas = provider.createCanvas(viewport.width, viewport.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get 2D canvas context.');

  const renderContext = {
    canvasContext: ctx as CanvasRenderingContext2D,
    viewport,
  };

  const pdfRenderTask = page.render(renderContext);
  await pdfRenderTask.promise;
  return { canvas, width: viewport.width, height: viewport.height };
}

export async function loadPdfBuffer(buffer: Uint8Array): Promise<any> {
  const loadingTask = pdfjsLib.getDocument(docOptions(buffer.slice()));
  return loadingTask.promise;
}

export async function renderPageToProviderWithPdfLocked(
  pdf: any,
  pageNum: number,
  provider: CanvasProvider,
  scale = 2.0
): Promise<PdfRenderResult> {
  return renderPageWithPdf(pdf, pageNum, provider, scale);
}

/**
 * Renderiza una página PDF única a un canvas de forma asincrónica. Soporta cancelación.
 * Si pageNum está fuera de rango, retorna un canvas vacío con width=0, height=0 (sin error).
 * Usa bandera isSettled para prevenir condiciones de carrera entre cancelación y finalización.
 * @param buffer Archivo PDF como Uint8Array.
 * @param pageNum Número de página (basado en 1) a renderizar.
 * @param provider Factory de canvas.
 * @param scale Escala de renderizado (default 2.0 para salida de alta resolución).
 * @returns PdfRenderTask con promesa que resuelve a PdfRenderResult y método cancel.
 * @throws Si no se puede obtener contexto 2D de canvas.
 */
export function renderPageToProvider(
  buffer: Uint8Array,
  pageNum: number,
  provider: CanvasProvider,
  scale = 2.0
): PdfRenderTask {
  let pdfLoadingTask: ReturnType<typeof pdfjsLib.getDocument> | null = null;
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
        try {
          const result = await renderPageWithPdf(pdf, pageNum, provider, scale);
          safeResolve(result);
        } finally {
          void pdf.destroy();
        }
      } catch (e) {
        safeReject(e);
      }
    })();
  });

  return {
    promise,
    cancel() {
      if (pdfLoadingTask) void pdfLoadingTask.destroy();
    },
  };
}

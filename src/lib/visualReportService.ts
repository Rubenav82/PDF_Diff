import pixelmatch from 'pixelmatch';
import { renderPageToCanvas } from './pdfService';
import type { PageMapping, VisualDiffReportEntry } from '../types/types';

const createCanvas = (): HTMLCanvasElement => document.createElement('canvas');

const createThumbnailDataUrl = (source: HTMLCanvasElement, maxWidth: number): string => {
  const ratio = source.width > 0 ? Math.min(1, maxWidth / source.width) : 1;
  const thumb = createCanvas();
  thumb.width = Math.max(1, Math.floor(source.width * ratio));
  thumb.height = Math.max(1, Math.floor(source.height * ratio));
  const ctx = thumb.getContext('2d');
  if (!ctx) return '';
  ctx.drawImage(source, 0, 0, thumb.width, thumb.height);
  return thumb.toDataURL('image/png');
};

export async function buildVisualDiffReportEntries(
  originalFile: File,
  modifiedFile: File,
  pageMapping: PageMapping
): Promise<VisualDiffReportEntry[]> {
  // Only process mappings where both pages exist (skip deleted/added pages)
  const validMappings = pageMapping.filter(
    (entry) => entry.originalPage > 0 && entry.modifiedPage > 0
  );

  const results: VisualDiffReportEntry[] = [];

  for (const entry of validMappings) {
    const originalCanvas = createCanvas();
    const modifiedCanvas = createCanvas();
    const diffCanvas = createCanvas();

    const originalRender = renderPageToCanvas(originalFile, entry.originalPage, originalCanvas);
    const modifiedRender = renderPageToCanvas(modifiedFile, entry.modifiedPage, modifiedCanvas);

    await Promise.all([originalRender.promise, modifiedRender.promise]);

    // Use maximum dimensions to ensure both images fit when comparing different page sizes
    const width = Math.max(originalCanvas.width, modifiedCanvas.width);
    const height = Math.max(originalCanvas.height, modifiedCanvas.height);

    if (width <= 1 || height <= 1) {
      results.push({
        originalPage: entry.originalPage,
        modifiedPage: entry.modifiedPage,
        diffPixels: 0,
        totalPixels: 0,
        diffRatio: 0,
        thumbnailDataUrl: '',
      });
      continue;
    }

    // Normalize both rendered pages to the same dimensions before comparison
    // pixelmatch requires both images to have identical width/height
    const tempOriginal = createCanvas();
    tempOriginal.width = width;
    tempOriginal.height = height;
    const tempOriginalCtx = tempOriginal.getContext('2d');
    if (!tempOriginalCtx) {
      throw new Error('No se pudo crear contexto para imagen original.');
    }
    tempOriginalCtx.drawImage(originalCanvas, 0, 0);

    const tempModified = createCanvas();
    tempModified.width = width;
    tempModified.height = height;
    const tempModifiedCtx = tempModified.getContext('2d');
    if (!tempModifiedCtx) {
      throw new Error('No se pudo crear contexto para imagen modificada.');
    }
    tempModifiedCtx.drawImage(modifiedCanvas, 0, 0);

    diffCanvas.width = width;
    diffCanvas.height = height;
    const diffCtx = diffCanvas.getContext('2d');
    if (!diffCtx) {
      throw new Error('No se pudo crear contexto para imagen de diferencias.');
    }

    const originalImageData = tempOriginalCtx.getImageData(0, 0, width, height);
    const modifiedImageData = tempModifiedCtx.getImageData(0, 0, width, height);
    const diffImageData = diffCtx.createImageData(width, height);

    // threshold 0.1: Sensitivity to color differences (0.0 = strict, 1.0 = lenient)
    // includeAA: Account for anti-aliasing differences to reduce false positives
    const diffPixels = pixelmatch(
      originalImageData.data,
      modifiedImageData.data,
      diffImageData.data,
      width,
      height,
      { threshold: 0.1, includeAA: true }
    );

    diffCtx.putImageData(diffImageData, 0, 0);

    const totalPixels = width * height;
    const diffRatio = totalPixels > 0 ? diffPixels / totalPixels : 0;

    results.push({
      originalPage: entry.originalPage,
      modifiedPage: entry.modifiedPage,
      diffPixels,
      totalPixels,
      diffRatio,
      thumbnailDataUrl: createThumbnailDataUrl(diffCanvas, 360),
    });
  }

  return results;
}

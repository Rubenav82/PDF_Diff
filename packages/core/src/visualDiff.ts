import pixelmatch from 'pixelmatch';
import type { CanvasProvider, CanvasLike } from './canvasProvider.js';
import type { PageMapping, VisualDiffReportEntry } from './types.js';
import { renderPageToProvider } from './pdfEngine.js';

export interface PixelDiffOptions {
  threshold?: number;
  includeAA?: boolean;
}

export interface PixelDiffResult {
  diffPixels: number;
  diffImageData: Uint8ClampedArray;
}

export function compareImageData(
  img1: Uint8ClampedArray,
  img2: Uint8ClampedArray,
  width: number,
  height: number,
  options: PixelDiffOptions = {}
): PixelDiffResult {
  const diffData = new Uint8ClampedArray(width * height * 4);
  const diffPixels = pixelmatch(img1, img2, diffData, width, height, {
    threshold: options.threshold ?? 0.1,
    includeAA: options.includeAA ?? true,
  });
  return { diffPixels, diffImageData: diffData };
}

function getImageData(canvas: CanvasLike, width: number, height: number): Uint8ClampedArray {
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | null;
  if (!ctx) throw new Error('Could not get 2D context from canvas.');
  return ctx.getImageData(0, 0, width, height).data;
}

function createThumbnailDataUrl(canvas: CanvasLike, provider: CanvasProvider, maxWidth: number): string {
  if (!canvas.toDataURL) return '';
  const ratio = canvas.width > 0 ? Math.min(1, maxWidth / canvas.width) : 1;
  const thumb = provider.createCanvas(
    Math.max(1, Math.floor(canvas.width * ratio)),
    Math.max(1, Math.floor(canvas.height * ratio))
  );
  const ctx = thumb.getContext('2d') as CanvasRenderingContext2D | null;
  if (!ctx) return '';
  ctx.drawImage(canvas as unknown as HTMLImageElement, 0, 0, thumb.width, thumb.height);
  return thumb.toDataURL?.('image/png') ?? '';
}

export async function buildVisualDiffEntries(
  originalBuffer: Uint8Array,
  modifiedBuffer: Uint8Array,
  pageMapping: PageMapping,
  provider: CanvasProvider,
  pixelDiffOptions: PixelDiffOptions = {}
): Promise<VisualDiffReportEntry[]> {
  const validMappings = pageMapping.filter(
    (entry) => entry.originalPage > 0 && entry.modifiedPage > 0
  );

  const results: VisualDiffReportEntry[] = [];

  for (const entry of validMappings) {
    const [origResult, modResult] = await Promise.all([
      renderPageToProvider(originalBuffer, entry.originalPage, provider).promise,
      renderPageToProvider(modifiedBuffer, entry.modifiedPage, provider).promise,
    ]);

    const width = Math.max(origResult.canvas.width, modResult.canvas.width);
    const height = Math.max(origResult.canvas.height, modResult.canvas.height);

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

    // Normalize both canvases to identical dimensions before pixel comparison
    const normalizedOrig = provider.createCanvas(width, height);
    const normalizedMod = provider.createCanvas(width, height);
    const normOrigCtx = normalizedOrig.getContext('2d') as CanvasRenderingContext2D | null;
    const normModCtx = normalizedMod.getContext('2d') as CanvasRenderingContext2D | null;
    if (!normOrigCtx || !normModCtx) throw new Error('Could not create normalization contexts.');

    normOrigCtx.drawImage(origResult.canvas as unknown as HTMLImageElement, 0, 0);
    normModCtx.drawImage(modResult.canvas as unknown as HTMLImageElement, 0, 0);

    const img1 = getImageData(normalizedOrig, width, height);
    const img2 = getImageData(normalizedMod, width, height);

    const diffCanvas = provider.createCanvas(width, height);
    const { diffPixels, diffImageData } = compareImageData(img1, img2, width, height, pixelDiffOptions);

    const diffCtx = diffCanvas.getContext('2d') as CanvasRenderingContext2D | null;
    if (diffCtx) {
      const imageData = diffCtx.createImageData(width, height);
      imageData.data.set(diffImageData);
      diffCtx.putImageData(imageData, 0, 0);
    }

    const totalPixels = width * height;
    results.push({
      originalPage: entry.originalPage,
      modifiedPage: entry.modifiedPage,
      diffPixels,
      totalPixels,
      diffRatio: totalPixels > 0 ? diffPixels / totalPixels : 0,
      thumbnailDataUrl: createThumbnailDataUrl(diffCanvas, provider, 360),
    });
  }

  return results;
}

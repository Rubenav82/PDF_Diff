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

/**
 * Compares two images pixel-by-pixel and returns the difference count and diff visualization.
 * @param img1 RGBA pixel data of the first image (Uint8ClampedArray where each 4 consecutive bytes = R,G,B,A).
 * @param img2 RGBA pixel data of the second image (same format).
 * @param width Image width in pixels.
 * @param height Image height in pixels.
 * @param options Matching options: threshold (pixel tolerance 0-1, default 0.1), includeAA (penalize anti-aliased edges, default true).
 * @returns Object with diffPixels (count of differing pixels) and diffImageData (visualization as RGBA).
 */
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

/**
 * Renders mapped page pairs from two PDFs and performs pixel-level comparison.
 * Handles dimension mismatches by padding to the larger size. Generates diff visualization and thumbnail.
 * @param originalBuffer PDF file as Uint8Array.
 * @param modifiedBuffer PDF file as Uint8Array.
 * @param pageMapping Page pairs to compare (filters to entries where both originalPage > 0 and modifiedPage > 0).
 * @param provider Canvas factory (e.g., browser canvas or Node canvas).
 * @param pixelDiffOptions Pixel diff options (threshold, includeAA).
 * @returns Array of VisualDiffReportEntry with diffPixels, totalPixels, diffRatio, and thumbnail.
 * @throws If canvas 2D context cannot be obtained or PDF rendering fails.
 */
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

    const origW = origResult.canvas.width;
    const origH = origResult.canvas.height;
    const modW = modResult.canvas.width;
    const modH = modResult.canvas.height;
    const width = Math.max(origW, modW);
    const height = Math.max(origH, modH);

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

    let img1: Uint8ClampedArray;
    let img2: Uint8ClampedArray;

    if (origW === width && origH === height && modW === width && modH === height) {
      // Same dimensions — read pixel data directly from the rendered canvases to avoid
      // any canvas-to-canvas drawImage copy artefacts in non-browser environments.
      img1 = getImageData(origResult.canvas, width, height);
      img2 = getImageData(modResult.canvas, width, height);
    } else {
      // Different page sizes — pad both to the larger dimension before comparing.
      const normalizedOrig = provider.createCanvas(width, height);
      const normalizedMod = provider.createCanvas(width, height);
      const normOrigCtx = normalizedOrig.getContext('2d') as CanvasRenderingContext2D | null;
      const normModCtx = normalizedMod.getContext('2d') as CanvasRenderingContext2D | null;
      if (!normOrigCtx || !normModCtx) throw new Error('Could not create normalization contexts.');
      normOrigCtx.drawImage(origResult.canvas as unknown as HTMLImageElement, 0, 0);
      normModCtx.drawImage(modResult.canvas as unknown as HTMLImageElement, 0, 0);
      img1 = getImageData(normalizedOrig, width, height);
      img2 = getImageData(normalizedMod, width, height);
    }

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

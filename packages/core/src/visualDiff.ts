import pixelmatch from 'pixelmatch';
import type { CanvasProvider, CanvasLike } from './canvasProvider.js';
import type { PageMapping, VisualDiffReportEntry } from './types.js';
import { renderPageToProviderWithPdfLocked, loadPdfBuffer } from './pdfEngine.js';

export interface PixelDiffOptions {
  threshold?: number;
  includeAA?: boolean;
}

export interface PixelDiffResult {
  diffPixels: number;
  diffImageData: Uint8ClampedArray;
}

/**
 * Compara dos imágenes píxel a píxel y retorna el conteo de diferencias y visualización.
 * @param img1 Datos de píxeles RGBA de la primera imagen (Uint8ClampedArray donde cada 4 bytes consecutivos = R,G,B,A).
 * @param img2 Datos de píxeles RGBA de la segunda imagen (mismo formato).
 * @param width Ancho de la imagen en píxeles.
 * @param height Alto de la imagen en píxeles.
 * @param options Opciones de coincidencia: threshold (tolerancia de píxel 0-1, default 0.1), includeAA (penalizar bordes anti-aliased, default true).
 * @returns Objeto con diffPixels (conteo de píxeles diferentes) y diffImageData (visualización como RGBA).
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

function copyCanvasPixels(srcCanvas: CanvasLike, srcWidth: number, srcHeight: number, destCtx: CanvasRenderingContext2D, destX: number, destY: number): void {
  if (srcWidth <= 0 || srcHeight <= 0) return;
  const srcCtx = srcCanvas.getContext('2d') as CanvasRenderingContext2D | null;
  if (!srcCtx) return;
  const imageData = srcCtx.getImageData(0, 0, srcWidth, srcHeight);
  destCtx.putImageData(imageData, destX, destY);
}

function createThumbnailDataUrl(canvas: CanvasLike, provider: CanvasProvider, maxWidth: number): string {
  if (!canvas.toDataURL || canvas.width === 0 || canvas.height === 0) return '';
  const srcW = canvas.width;
  const srcH = canvas.height;
  const ratio = Math.min(1, maxWidth / srcW);
  const thumbW = Math.max(1, Math.floor(srcW * ratio));
  const thumbH = Math.max(1, Math.floor(srcH * ratio));
  // Use getImageData + nearest-neighbour downsample instead of drawImage to avoid
  // premultiplied-alpha artefacts when scaling semi-transparent canvases in @napi-rs/canvas.
  const srcCtx = canvas.getContext('2d') as CanvasRenderingContext2D | null;
  if (!srcCtx) return '';
  const src = srcCtx.getImageData(0, 0, srcW, srcH).data;
  const dst = new Uint8ClampedArray(thumbW * thumbH * 4);
  for (let y = 0; y < thumbH; y++) {
    const sy = Math.min(srcH - 1, Math.floor(y / ratio));
    for (let x = 0; x < thumbW; x++) {
      const sx = Math.min(srcW - 1, Math.floor(x / ratio));
      const si = (sy * srcW + sx) * 4;
      const di = (y * thumbW + x) * 4;
      dst[di] = src[si];
      dst[di + 1] = src[si + 1];
      dst[di + 2] = src[si + 2];
      dst[di + 3] = src[si + 3];
    }
  }
  const thumb = provider.createCanvas(thumbW, thumbH);
  const thumbCtx = thumb.getContext('2d') as CanvasRenderingContext2D | null;
  if (!thumbCtx) return '';
  const imgData = thumbCtx.createImageData(thumbW, thumbH);
  imgData.data.set(dst);
  thumbCtx.putImageData(imgData, 0, 0);
  return thumb.toDataURL?.('image/png') ?? '';
}

/**
 * Renderiza pares de páginas mapeadas de dos PDFs y realiza comparación a nivel de píxel.
 * Maneja desajustes de dimensiones rellenando al tamaño mayor. Genera visualización de diferencias y miniatura.
 * @param originalBuffer Archivo PDF como Uint8Array.
 * @param modifiedBuffer Archivo PDF como Uint8Array.
 * @param pageMapping Pares de páginas a comparar (filtra a entradas donde ambas originalPage > 0 y modifiedPage > 0).
 * @param provider Factory de canvas (ej., canvas del navegador o canvas de Node).
 * @param pixelDiffOptions Opciones de diferencia de píxel (threshold, includeAA).
 * @returns Array de VisualDiffReportEntry con diffPixels, totalPixels, diffRatio, y miniatura.
 * @throws Si no se puede obtener contexto 2D de canvas o falla el renderizado de PDF.
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

  const originalPdf = await loadPdfBuffer(originalBuffer);
  const modifiedPdf = await loadPdfBuffer(modifiedBuffer);

  try {
    const results: VisualDiffReportEntry[] = [];

    for (const entry of validMappings) {
      const [origResult, modResult] = await Promise.all([
        renderPageToProviderWithPdfLocked(originalPdf, entry.originalPage, provider),
        renderPageToProviderWithPdfLocked(modifiedPdf, entry.modifiedPage, provider),
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
        // Use getImageData/putImageData to avoid canvas-to-canvas drawImage artefacts in Node.
        const normalizedOrig = provider.createCanvas(width, height);
        const normalizedMod = provider.createCanvas(width, height);
        const normOrigCtx = normalizedOrig.getContext('2d') as CanvasRenderingContext2D | null;
        const normModCtx = normalizedMod.getContext('2d') as CanvasRenderingContext2D | null;
        if (!normOrigCtx || !normModCtx) throw new Error('Could not create normalization contexts.');
        copyCanvasPixels(origResult.canvas, origW, origH, normOrigCtx, 0, 0);
        copyCanvasPixels(modResult.canvas, modW, modH, normModCtx, 0, 0);
        img1 = getImageData(normalizedOrig, width, height);
        img2 = getImageData(normalizedMod, width, height);
      }

      const { diffPixels, diffImageData } = compareImageData(img1, img2, width, height, pixelDiffOptions);

      // Build composite thumbnail: img1 blended over white + diff pixels in solid red.
      // Blending over white (instead of copying img1 directly) ensures all pixels are fully
      // opaque so the thumbnail doesn't appear faded when pdfjs renders on a transparent
      // background in Node.js.
      const compositeData = new Uint8ClampedArray(width * height * 4);
      for (let i = 0; i < img1.length; i += 4) {
        const a = img1[i + 3] / 255;
        compositeData[i] = Math.round(img1[i] * a + 255 * (1 - a));
        compositeData[i + 1] = Math.round(img1[i + 1] * a + 255 * (1 - a));
        compositeData[i + 2] = Math.round(img1[i + 2] * a + 255 * (1 - a));
        compositeData[i + 3] = 255;
      }
      for (let i = 0; i < diffImageData.length; i += 4) {
        if (diffImageData[i] === 255 && diffImageData[i + 1] === 0 && diffImageData[i + 2] === 0) {
          compositeData[i] = 255;
          compositeData[i + 1] = 0;
          compositeData[i + 2] = 0;
          compositeData[i + 3] = 255;
        }
      }
      const compositeCanvas = provider.createCanvas(width, height);
      const compCtx = compositeCanvas.getContext('2d') as CanvasRenderingContext2D | null;
      if (compCtx) {
        const imgData = compCtx.createImageData(width, height);
        imgData.data.set(compositeData);
        compCtx.putImageData(imgData, 0, 0);
      }

      const totalPixels = width * height;
      results.push({
        originalPage: entry.originalPage,
        modifiedPage: entry.modifiedPage,
        diffPixels,
        totalPixels,
        diffRatio: totalPixels > 0 ? diffPixels / totalPixels : 0,
        thumbnailDataUrl: createThumbnailDataUrl(compositeCanvas, provider, 360),
      });
    }

    return results;
  } finally {
    void originalPdf.destroy();
    void modifiedPdf.destroy();
  }
}

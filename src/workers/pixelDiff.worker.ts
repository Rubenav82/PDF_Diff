import pixelmatch from 'pixelmatch';

export interface PixelDiffRequest {
  id: number;
  width: number;
  height: number;
  originalBuffer: ArrayBuffer;
  modifiedBuffer: ArrayBuffer;
  threshold: number;
  includeAA: boolean;
}

export type PixelDiffResponse =
  | { id: number; ok: true; diffPixels: number; diffBuffer: ArrayBuffer }
  | { id: number; ok: false; error: string };

const ctx = self as unknown as Worker;

ctx.onmessage = (event: MessageEvent<PixelDiffRequest>) => {
  const { id, width, height, originalBuffer, modifiedBuffer, threshold, includeAA } = event.data;
  try {
    const original = new Uint8ClampedArray(originalBuffer);
    const modified = new Uint8ClampedArray(modifiedBuffer);
    const diff = new Uint8ClampedArray(width * height * 4);
    const diffPixels = pixelmatch(original, modified, diff, width, height, { threshold, includeAA });
    ctx.postMessage(
      { id, ok: true, diffPixels, diffBuffer: diff.buffer } satisfies PixelDiffResponse,
      [diff.buffer]
    );
  } catch (err) {
    ctx.postMessage({
      id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    } satisfies PixelDiffResponse);
  }
};

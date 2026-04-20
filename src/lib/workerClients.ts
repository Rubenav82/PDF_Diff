import { diffChars, diffWords, diffLines, type Change } from 'diff';
import pixelmatch from 'pixelmatch';
import type { TextDiffMode, TextDiffRequest, TextDiffResponse } from '../workers/textDiff.worker';
import type { PixelDiffRequest, PixelDiffResponse } from '../workers/pixelDiff.worker';

let textWorker: Worker | null = null;
let pixelWorker: Worker | null = null;
let nextId = 1;
const pendingText = new Map<number, (res: TextDiffResponse) => void>();
const pendingPixel = new Map<number, (res: PixelDiffResponse) => void>();

function hasWorker(): boolean {
  return typeof Worker !== 'undefined';
}

function getTextWorker(): Worker | null {
  if (!hasWorker()) return null;
  if (!textWorker) {
    try {
      textWorker = new Worker(new URL('../workers/textDiff.worker.ts', import.meta.url), {
        type: 'module',
      });
      textWorker.onmessage = (e: MessageEvent<TextDiffResponse>) => {
        const resolver = pendingText.get(e.data.id);
        if (resolver) {
          resolver(e.data);
          pendingText.delete(e.data.id);
        }
      };
    } catch {
      textWorker = null;
    }
  }
  return textWorker;
}

function getPixelWorker(): Worker | null {
  if (!hasWorker()) return null;
  if (!pixelWorker) {
    try {
      pixelWorker = new Worker(new URL('../workers/pixelDiff.worker.ts', import.meta.url), {
        type: 'module',
      });
      pixelWorker.onmessage = (e: MessageEvent<PixelDiffResponse>) => {
        const resolver = pendingPixel.get(e.data.id);
        if (resolver) {
          resolver(e.data);
          pendingPixel.delete(e.data.id);
        }
      };
    } catch {
      pixelWorker = null;
    }
  }
  return pixelWorker;
}

function diffSync(original: string, modified: string, mode: TextDiffMode): Change[] {
  const fn = mode === 'words' ? diffWords : mode === 'lines' ? diffLines : diffChars;
  return fn(original, modified);
}

export async function runTextDiff(
  original: string,
  modified: string,
  mode: TextDiffMode = 'chars'
): Promise<Change[]> {
  const worker = getTextWorker();
  if (!worker) return diffSync(original, modified, mode);

  const id = nextId++;
  return new Promise<Change[]>((resolve, reject) => {
    pendingText.set(id, (response) => {
      if (response.ok) resolve(response.result);
      else reject(new Error(response.error));
    });
    const payload: TextDiffRequest = { id, original, modified, mode };
    worker.postMessage(payload);
  });
}

export interface PixelDiffOptions {
  threshold?: number;
  includeAA?: boolean;
}

export interface PixelDiffOutcome {
  diffPixels: number;
  diffImageData: Uint8ClampedArray;
}

export async function runPixelDiff(
  original: Uint8ClampedArray,
  modified: Uint8ClampedArray,
  width: number,
  height: number,
  options: PixelDiffOptions = {}
): Promise<PixelDiffOutcome> {
  const threshold = options.threshold ?? 0.1;
  const includeAA = options.includeAA ?? true;
  const worker = getPixelWorker();

  if (!worker) {
    const diffData = new Uint8ClampedArray(width * height * 4);
    const diffPixels = pixelmatch(original, modified, diffData, width, height, {
      threshold,
      includeAA,
    });
    return { diffPixels, diffImageData: diffData };
  }

  const id = nextId++;
  const originalCopy = new Uint8ClampedArray(original);
  const modifiedCopy = new Uint8ClampedArray(modified);
  return new Promise<PixelDiffOutcome>((resolve, reject) => {
    pendingPixel.set(id, (response) => {
      if (response.ok) {
        resolve({
          diffPixels: response.diffPixels,
          diffImageData: new Uint8ClampedArray(response.diffBuffer),
        });
      } else {
        reject(new Error(response.error));
      }
    });
    const payload: PixelDiffRequest = {
      id,
      width,
      height,
      originalBuffer: originalCopy.buffer,
      modifiedBuffer: modifiedCopy.buffer,
      threshold,
      includeAA,
    };
    worker.postMessage(payload, [originalCopy.buffer, modifiedCopy.buffer]);
  });
}

export function terminateWorkers(): void {
  if (textWorker) {
    textWorker.terminate();
    textWorker = null;
  }
  if (pixelWorker) {
    pixelWorker.terminate();
    pixelWorker = null;
  }
  pendingText.clear();
  pendingPixel.clear();
}

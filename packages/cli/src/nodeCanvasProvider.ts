import { createCanvas } from '@napi-rs/canvas';
import type { CanvasProvider, CanvasLike } from '@pdf-diff/core';

export const nodeCanvasProvider: CanvasProvider = {
  createCanvas(width: number, height: number): CanvasLike {
    const canvas = createCanvas(width, height);
    return canvas as unknown as CanvasLike;
  },
};

import type { CanvasProvider, CanvasLike } from '@pdf-diff/core';

export const browserCanvasProvider: CanvasProvider = {
  createCanvas(width: number, height: number): CanvasLike {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas as unknown as CanvasLike;
  },
};

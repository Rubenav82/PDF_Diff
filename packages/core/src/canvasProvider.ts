export interface CanvasLike {
  width: number;
  height: number;
  getContext(type: '2d'): unknown;
  toDataURL?(type?: string): string;
}

export interface CanvasProvider {
  createCanvas(width: number, height: number): CanvasLike;
}

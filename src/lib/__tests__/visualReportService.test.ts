// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';

// ─── Mocks (must be hoisted before imports) ───────────────────────────────────

const { mockRenderPageToCanvas, mockPixelmatch } = vi.hoisted(() => ({
  mockRenderPageToCanvas: vi.fn(),
  mockPixelmatch: vi.fn(),
}));

vi.mock('../pdfService', () => ({ renderPageToCanvas: mockRenderPageToCanvas }));
vi.mock('pixelmatch', () => ({ default: mockPixelmatch }));

import { buildVisualDiffReportEntries } from '../visualReportService';
import type { PageMapping } from '../../types/types';

// ─── Canvas mock helpers ──────────────────────────────────────────────────────

function makeImageData(width: number, height: number): ImageData {
  return { data: new Uint8ClampedArray(width * height * 4), width, height, colorSpace: 'srgb' };
}

function makeCtx(width = 100, height = 100) {
  return {
    drawImage: vi.fn(),
    getImageData: vi.fn((_x = 0, _y = 0, w = width, h = height) => makeImageData(w, h)),
    createImageData: vi.fn((w = width, h = height) => makeImageData(w, h)),
    putImageData: vi.fn(),
  };
}

function setupCanvasMock(originalSize = { width: 100, height: 100 }, modifiedSize = { width: 100, height: 100 }) {
  let callCount = 0;
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    if (tag !== 'canvas') return document.createElement.call(document, tag);

    callCount++;
    const call = callCount;
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => {
        const size = call === 1 ? originalSize : call === 2 ? modifiedSize : { width: 100, height: 100 };
        return makeCtx(size.width, size.height);
      }),
      toDataURL: vi.fn(() => 'data:image/png;base64,THUMB'),
    } as unknown as HTMLCanvasElement;

    // renderPageToCanvas sets width/height on the canvas
    Object.defineProperty(canvas, 'width', { writable: true, value: call === 1 ? originalSize.width : modifiedSize.width });
    Object.defineProperty(canvas, 'height', { writable: true, value: call === 1 ? originalSize.height : modifiedSize.height });

    return canvas;
  });
}

function makeFile(): File {
  return new File(['pdf'], 'test.pdf', { type: 'application/pdf' });
}

function makeRenderTask(width: number, height: number) {
  return {
    promise: Promise.resolve({ width, height }),
    cancel: vi.fn(),
  };
}

// ─── buildVisualDiffReportEntries ─────────────────────────────────────────────

describe('buildVisualDiffReportEntries', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns an empty array when pageMapping is empty', async () => {
    const result = await buildVisualDiffReportEntries(makeFile(), makeFile(), []);
    expect(result).toHaveLength(0);
  });

  it('skips mappings where originalPage or modifiedPage is 0', async () => {
    const mapping: PageMapping = [
      { originalPage: 0, modifiedPage: 1 },
      { originalPage: 1, modifiedPage: 0 },
    ];
    const result = await buildVisualDiffReportEntries(makeFile(), makeFile(), mapping);
    expect(result).toHaveLength(0);
  });

  it('returns one entry per valid mapping', async () => {
    setupCanvasMock();
    mockPixelmatch.mockReturnValue(10);
    mockRenderPageToCanvas.mockReturnValue(makeRenderTask(100, 100));

    const mapping: PageMapping = [
      { originalPage: 1, modifiedPage: 1 },
      { originalPage: 2, modifiedPage: 2 },
    ];
    const result = await buildVisualDiffReportEntries(makeFile(), makeFile(), mapping);
    expect(result).toHaveLength(2);
  });

  it('populates entry fields from pixelmatch result', async () => {
    setupCanvasMock({ width: 200, height: 300 }, { width: 200, height: 300 });
    mockPixelmatch.mockReturnValue(600);
    mockRenderPageToCanvas.mockReturnValue(makeRenderTask(200, 300));

    const mapping: PageMapping = [{ originalPage: 1, modifiedPage: 1 }];
    const [entry] = await buildVisualDiffReportEntries(makeFile(), makeFile(), mapping);

    expect(entry.originalPage).toBe(1);
    expect(entry.modifiedPage).toBe(1);
    expect(entry.diffPixels).toBe(600);
    expect(entry.totalPixels).toBe(200 * 300);
    expect(entry.diffRatio).toBeCloseTo(600 / (200 * 300));
  });

  it('uses max dimensions when pages have different sizes', async () => {
    setupCanvasMock({ width: 100, height: 200 }, { width: 150, height: 180 });
    mockPixelmatch.mockReturnValue(0);
    mockRenderPageToCanvas.mockReturnValue(makeRenderTask(100, 200));

    const mapping: PageMapping = [{ originalPage: 1, modifiedPage: 1 }];
    const [entry] = await buildVisualDiffReportEntries(makeFile(), makeFile(), mapping);

    // max width=150, max height=200
    expect(entry.totalPixels).toBe(150 * 200);
  });

  it('returns zero-diff entry when canvas has degenerate dimensions (width/height <= 1)', async () => {
    setupCanvasMock({ width: 0, height: 0 }, { width: 0, height: 0 });
    mockRenderPageToCanvas.mockReturnValue(makeRenderTask(0, 0));

    const mapping: PageMapping = [{ originalPage: 1, modifiedPage: 1 }];
    const [entry] = await buildVisualDiffReportEntries(makeFile(), makeFile(), mapping);

    expect(entry.diffPixels).toBe(0);
    expect(entry.totalPixels).toBe(0);
    expect(entry.diffRatio).toBe(0);
    expect(entry.thumbnailDataUrl).toBe('');
  });

  it('calls pixelmatch with the correct arguments', async () => {
    setupCanvasMock({ width: 50, height: 50 }, { width: 50, height: 50 });
    mockPixelmatch.mockReturnValue(5);
    mockRenderPageToCanvas.mockReturnValue(makeRenderTask(50, 50));

    const mapping: PageMapping = [{ originalPage: 1, modifiedPage: 1 }];
    await buildVisualDiffReportEntries(makeFile(), makeFile(), mapping);

    expect(mockPixelmatch).toHaveBeenCalledWith(
      expect.any(Uint8ClampedArray),
      expect.any(Uint8ClampedArray),
      expect.any(Uint8ClampedArray),
      expect.any(Number),
      expect.any(Number),
      expect.objectContaining({ threshold: 0.1, includeAA: true })
    );
  });

  it('produces a non-empty thumbnailDataUrl for a valid comparison', async () => {
    setupCanvasMock({ width: 100, height: 100 }, { width: 100, height: 100 });
    mockPixelmatch.mockReturnValue(0);
    mockRenderPageToCanvas.mockReturnValue(makeRenderTask(100, 100));

    const mapping: PageMapping = [{ originalPage: 1, modifiedPage: 1 }];
    const [entry] = await buildVisualDiffReportEntries(makeFile(), makeFile(), mapping);

    expect(entry.thumbnailDataUrl).not.toBe('');
  });

  it('passes correct page numbers to renderPageToCanvas', async () => {
    setupCanvasMock();
    mockPixelmatch.mockReturnValue(0);
    mockRenderPageToCanvas.mockReturnValue(makeRenderTask(100, 100));

    const mapping: PageMapping = [{ originalPage: 3, modifiedPage: 7 }];
    await buildVisualDiffReportEntries(makeFile(), makeFile(), mapping);

    expect(mockRenderPageToCanvas).toHaveBeenCalledWith(expect.any(File), 3, expect.anything());
    expect(mockRenderPageToCanvas).toHaveBeenCalledWith(expect.any(File), 7, expect.anything());
  });
});

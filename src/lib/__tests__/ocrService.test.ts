// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';

const { mockCreateWorker, mockRecognize, mockTerminate, mockRenderPageToCanvas } = vi.hoisted(() => ({
  mockCreateWorker: vi.fn(),
  mockRecognize: vi.fn(),
  mockTerminate: vi.fn(),
  mockRenderPageToCanvas: vi.fn(),
}));

vi.mock('tesseract.js', () => ({
  createWorker: mockCreateWorker,
}));

vi.mock('../pdfService', () => ({
  renderPageToCanvas: mockRenderPageToCanvas,
}));

import { needsOcr, pickPagesNeedingOcr, runOcrOnPages } from '../ocrService';

function makeFile(): File {
  return new File(['pdf'], 'scanned.pdf', { type: 'application/pdf' });
}

describe('needsOcr', () => {
  it('returns true for empty text', () => {
    expect(needsOcr('')).toBe(true);
  });

  it('returns true for text with only whitespace', () => {
    expect(needsOcr('     \n\n\t  ')).toBe(true);
  });

  it('returns true for a handful of chars (below the threshold)', () => {
    expect(needsOcr('page 3')).toBe(true);
  });

  it('returns false once the text has meaningful content', () => {
    expect(needsOcr('This page has plenty of extracted text content to work with')).toBe(false);
  });
});

describe('pickPagesNeedingOcr', () => {
  it('returns the 1-indexed page numbers that fail the threshold', () => {
    const pages = [
      '   ',
      'A reasonably long text that contains real content for diffing.',
      '1',
    ];
    expect(pickPagesNeedingOcr(pages)).toEqual([1, 3]);
  });

  it('returns an empty array when every page has content', () => {
    const pages = ['plenty of meaningful text here', 'another well populated page of text'];
    expect(pickPagesNeedingOcr(pages)).toEqual([]);
  });
});

describe('runOcrOnPages', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockCreateWorker.mockReset();
    mockRecognize.mockReset();
    mockTerminate.mockReset();
    mockRenderPageToCanvas.mockReset();
  });

  it('returns an empty map when no pages are requested without instantiating tesseract', async () => {
    const result = await runOcrOnPages(makeFile(), []);
    expect(result.size).toBe(0);
    expect(mockCreateWorker).not.toHaveBeenCalled();
  });

  it('recognizes text for each requested page and terminates the worker', async () => {
    mockCreateWorker.mockResolvedValue({
      recognize: mockRecognize,
      terminate: mockTerminate,
    });
    mockRecognize.mockResolvedValueOnce({ data: { text: 'page one' } });
    mockRecognize.mockResolvedValueOnce({ data: { text: 'page three' } });
    mockRenderPageToCanvas.mockReturnValue({ promise: Promise.resolve({ width: 10, height: 10 }), cancel: vi.fn() });

    const result = await runOcrOnPages(makeFile(), [1, 3]);

    expect(result.get(1)).toBe('page one');
    expect(result.get(3)).toBe('page three');
    expect(mockRecognize).toHaveBeenCalledTimes(2);
    expect(mockTerminate).toHaveBeenCalledTimes(1);
  });

  it('reports progress per page', async () => {
    mockCreateWorker.mockResolvedValue({
      recognize: mockRecognize,
      terminate: mockTerminate,
    });
    mockRecognize.mockResolvedValue({ data: { text: 'text' } });
    mockRenderPageToCanvas.mockReturnValue({ promise: Promise.resolve({ width: 10, height: 10 }), cancel: vi.fn() });

    const progress: Array<{ current: number; total: number; page: number }> = [];
    await runOcrOnPages(makeFile(), [2, 4, 5], { onProgress: (p) => progress.push(p) });

    expect(progress).toEqual([
      { current: 1, total: 3, page: 2 },
      { current: 2, total: 3, page: 4 },
      { current: 3, total: 3, page: 5 },
    ]);
  });

  it('terminates the worker even when recognize throws', async () => {
    mockCreateWorker.mockResolvedValue({
      recognize: mockRecognize,
      terminate: mockTerminate,
    });
    mockRecognize.mockRejectedValue(new Error('boom'));
    mockRenderPageToCanvas.mockReturnValue({ promise: Promise.resolve({ width: 10, height: 10 }), cancel: vi.fn() });

    await expect(runOcrOnPages(makeFile(), [1])).rejects.toThrow('boom');
    expect(mockTerminate).toHaveBeenCalledTimes(1);
  });
});

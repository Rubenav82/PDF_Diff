// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockGetDocument, mockGetPage, mockDestroy } = vi.hoisted(() => ({
  mockGetDocument: vi.fn(),
  mockGetPage: vi.fn(),
  mockDestroy: vi.fn(),
}));

vi.mock('pdfjs-dist/build/pdf.worker.mjs?url', () => ({ default: 'worker.mjs' }));
vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: mockGetDocument,
}));

import { calculateFileHash, getPdfPageCount, extractTextFromPdf, renderPageToCanvas } from '../pdfService';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeFile(content = 'hello'): File {
  return new File([content], 'test.pdf', { type: 'application/pdf' });
}

function simulateFileReader(result: ArrayBuffer | null, error = false) {
  vi.spyOn(global, 'FileReader').mockImplementation(() => {
    const reader = {
      result,
      onload: null as ((e: ProgressEvent<FileReader>) => void) | null,
      onerror: null as ((e: ProgressEvent<FileReader>) => void) | null,
      onabort: null as ((e: ProgressEvent<FileReader>) => void) | null,
      readyState: FileReader.DONE,
      abort: vi.fn(),
      readAsArrayBuffer: vi.fn(function () {
        Promise.resolve().then(() => {
          if (error) {
            reader.onerror?.({} as ProgressEvent<FileReader>);
          } else {
            reader.onload?.({ target: reader } as unknown as ProgressEvent<FileReader>);
          }
        });
      }),
    };
    return reader as unknown as FileReader;
  });
}

// ─── calculateFileHash ────────────────────────────────────────────────────────

describe('calculateFileHash', () => {
  it('returns a 128-character hex string for SHA-512', async () => {
    const file = makeFile('some content');
    const hash = await calculateFileHash(file);
    expect(hash).toMatch(/^[0-9a-f]{128}$/);
  });

  it('returns the same hash for the same content', async () => {
    const file1 = makeFile('same');
    const file2 = makeFile('same');
    const [h1, h2] = await Promise.all([calculateFileHash(file1), calculateFileHash(file2)]);
    expect(h1).toBe(h2);
  });

  it('returns different hashes for different content', async () => {
    const h1 = await calculateFileHash(makeFile('aaa'));
    const h2 = await calculateFileHash(makeFile('bbb'));
    expect(h1).not.toBe(h2);
  });
});

// ─── getPdfPageCount ──────────────────────────────────────────────────────────

describe('getPdfPageCount', () => {
  beforeEach(() => {
    simulateFileReader(new ArrayBuffer(8));
    mockGetDocument.mockReturnValue({ promise: Promise.resolve({ numPages: 3, getPage: mockGetPage }), destroy: mockDestroy });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the number of pages from the PDF', async () => {
    const count = await getPdfPageCount(makeFile());
    expect(count).toBe(3);
  });

  it('rejects when FileReader fires an error', async () => {
    simulateFileReader(null, true);
    await expect(getPdfPageCount(makeFile())).rejects.toBeDefined();
  });

  it('rejects when pdfjs fails to load the document', async () => {
    simulateFileReader(new ArrayBuffer(8));
    mockGetDocument.mockReturnValue({ promise: Promise.reject(new Error('corrupt pdf')), destroy: mockDestroy });
    await expect(getPdfPageCount(makeFile())).rejects.toThrow('corrupt pdf');
  });

  it('rejects when FileReader result is null', async () => {
    simulateFileReader(null);
    await expect(getPdfPageCount(makeFile())).rejects.toThrow('Error al leer el archivo.');
  });
});

// ─── extractTextFromPdf ───────────────────────────────────────────────────────

describe('extractTextFromPdf', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns an array with text for each page', async () => {
    simulateFileReader(new ArrayBuffer(8));
    mockGetPage.mockImplementation(async (pageNum: number) => ({
      getTextContent: async () => ({
        items: [{ str: `page ${pageNum} text` }],
      }),
    }));
    mockGetDocument.mockReturnValue({
      promise: Promise.resolve({ numPages: 2, getPage: mockGetPage }),
      destroy: mockDestroy,
    });

    const texts = await extractTextFromPdf(makeFile());
    expect(texts).toHaveLength(2);
    expect(texts[0]).toContain('page 1 text');
    expect(texts[1]).toContain('page 2 text');
  });

  it('joins item strings with spaces', async () => {
    simulateFileReader(new ArrayBuffer(8));
    mockGetPage.mockResolvedValue({
      getTextContent: async () => ({
        items: [{ str: 'hello' }, { str: 'world' }],
      }),
    });
    mockGetDocument.mockReturnValue({
      promise: Promise.resolve({ numPages: 1, getPage: mockGetPage }),
      destroy: mockDestroy,
    });

    const [text] = await extractTextFromPdf(makeFile());
    expect(text).toBe('hello world');
  });

  it('treats items without str as empty string', async () => {
    simulateFileReader(new ArrayBuffer(8));
    mockGetPage.mockResolvedValue({
      getTextContent: async () => ({ items: [{}, { str: 'visible' }] }),
    });
    mockGetDocument.mockReturnValue({
      promise: Promise.resolve({ numPages: 1, getPage: mockGetPage }),
      destroy: mockDestroy,
    });

    const [text] = await extractTextFromPdf(makeFile());
    expect(text).toContain('visible');
  });

  it('rejects when FileReader fires an error', async () => {
    simulateFileReader(null, true);
    await expect(extractTextFromPdf(makeFile())).rejects.toBeDefined();
  });
});

// ─── renderPageToCanvas ───────────────────────────────────────────────────────

describe('renderPageToCanvas', () => {
  // jsdom does not implement canvas.getContext(); provide a mock canvas instead.
  function makeMockCanvas(): HTMLCanvasElement {
    const ctx = {
      clearRect: vi.fn(),
      fillText: vi.fn(),
      drawImage: vi.fn(),
    };
    return {
      width: 0,
      height: 0,
      getContext: vi.fn(() => ctx),
    } as unknown as HTMLCanvasElement;
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('resolves with canvas dimensions after rendering', async () => {
    simulateFileReader(new ArrayBuffer(8));
    const viewport = { width: 800, height: 1000 };
    mockGetPage.mockResolvedValue({
      getViewport: () => viewport,
      render: () => ({ promise: Promise.resolve(), cancel: vi.fn() }),
    });
    mockGetDocument.mockReturnValue({
      promise: Promise.resolve({ numPages: 1, getPage: mockGetPage }),
      destroy: mockDestroy,
    });

    const { promise } = renderPageToCanvas(makeFile(), 1, makeMockCanvas());
    const result = await promise;
    expect(result).toEqual({ width: 800, height: 1000 });
  });

  it('resolves with {0,0} when pageNum is out of bounds', async () => {
    simulateFileReader(new ArrayBuffer(8));
    mockGetDocument.mockReturnValue({
      promise: Promise.resolve({ numPages: 1, getPage: mockGetPage }),
      destroy: mockDestroy,
    });

    const { promise } = renderPageToCanvas(makeFile(), 99, makeMockCanvas());
    const result = await promise;
    expect(result).toEqual({ width: 0, height: 0 });
  });

  it('rejects when FileReader result is null', async () => {
    simulateFileReader(null);
    const { promise } = renderPageToCanvas(makeFile(), 1, makeMockCanvas());
    await expect(promise).rejects.toThrow('Error al leer el archivo.');
  });

  it('cancel() stops an in-flight render', async () => {
    simulateFileReader(new ArrayBuffer(8));
    const renderCancel = vi.fn();
    let startRender!: () => void;

    mockGetPage.mockResolvedValue({
      getViewport: () => ({ width: 100, height: 100 }),
      render: () => ({
        promise: new Promise<void>((res) => { startRender = res; }),
        cancel: renderCancel,
      }),
    });
    mockGetDocument.mockReturnValue({
      promise: Promise.resolve({ numPages: 1, getPage: mockGetPage }),
      destroy: mockDestroy,
    });

    const task = renderPageToCanvas(makeFile(), 1, makeMockCanvas());
    // Drain microtasks so page.render() has been called and renderTask is set
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    task.cancel();
    expect(renderCancel).toHaveBeenCalled();
    startRender(); // unblock the hanging promise
  });
});

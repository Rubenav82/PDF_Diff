// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { downloadComparisonReport } from '../reportService';
import type { ComparisonSummary, TextDiffResult, PageMapping, TextComparisonOptions } from '../../types/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const baseOptions: TextComparisonOptions = {
  includeUnmappedPages: true,
  normalization: { ignoreCase: false, ignoreWhitespace: false, ignoreLineBreaks: false },
};

const baseSummary: ComparisonSummary = {
  mappedPairs: 2,
  changedPairs: 1,
  unchangedPairs: 1,
  deletedPages: 0,
  addedPages: 0,
  totalOriginalPages: 2,
  totalModifiedPages: 2,
};

const baseMapping: PageMapping = [{ originalPage: 1, modifiedPage: 1 }];

const changedDiff: TextDiffResult = {
  page: 1,
  modifiedPage: 1,
  kind: 'changed',
  diff: [
    { value: 'before context ', added: false, removed: false, count: 15 },
    { value: 'old word', added: false, removed: true, count: 8 },
    { value: 'new word', added: true, removed: false, count: 8 },
    { value: ' after context', added: false, removed: false, count: 14 },
  ],
};

function captureDownload(): { html: string } {
  const captured = { html: '' };

  const fakeAnchor = {
    href: '',
    download: '',
    click: vi.fn(),
  };

  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    if (tag === 'a') return fakeAnchor as unknown as HTMLAnchorElement;
    return document.createElement.call(document, tag);
  });
  vi.spyOn(document.body, 'appendChild').mockImplementation(() => null as unknown as Node);
  vi.spyOn(document.body, 'removeChild').mockImplementation(() => null as unknown as Node);

  const originalBlob = global.Blob;
  vi.stubGlobal('Blob', class MockBlob {
    constructor(parts: BlobPart[]) {
      captured.html = parts[0] as string;
    }
  });
  vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:test'), revokeObjectURL: vi.fn() });

  return captured;
}

// ─── downloadComparisonReport ─────────────────────────────────────────────────

describe('downloadComparisonReport', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('triggers a file download (anchor click)', () => {
    const fakeAnchor = { href: '', download: '', click: vi.fn() };
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') return fakeAnchor as unknown as HTMLAnchorElement;
      return document.createElement.call(document, tag);
    });
    vi.spyOn(document.body, 'appendChild').mockReturnValue(null as unknown as Node);
    vi.spyOn(document.body, 'removeChild').mockReturnValue(null as unknown as Node);
    vi.stubGlobal('Blob', class { constructor() {} });
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:url'), revokeObjectURL: vi.fn() });

    downloadComparisonReport({
      createdAt: '2024-01-01T00:00:00',
      originalFileName: 'a.pdf',
      modifiedFileName: 'b.pdf',
      hashes: { original: null, modified: null },
      pageCounts: null,
      mapping: [],
      options: baseOptions,
      summary: null,
      textDiff: null,
      visualDiffEntries: [],
    });

    expect(fakeAnchor.click).toHaveBeenCalled();
  });

  it('includes original and modified filenames in the HTML', () => {
    const captured = captureDownload();
    downloadComparisonReport({
      createdAt: '2024-01-01',
      originalFileName: 'original.pdf',
      modifiedFileName: 'modified.pdf',
      hashes: { original: 'abc123', modified: 'def456' },
      pageCounts: { original: 3, modified: 4 },
      mapping: baseMapping,
      options: baseOptions,
      summary: baseSummary,
      textDiff: [],
      visualDiffEntries: [],
    });

    expect(captured.html).toContain('original.pdf');
    expect(captured.html).toContain('modified.pdf');
    expect(captured.html).toContain('abc123');
    expect(captured.html).toContain('def456');
  });

  it('HTML-escapes filenames containing special characters', () => {
    const captured = captureDownload();
    downloadComparisonReport({
      createdAt: '2024-01-01',
      originalFileName: '<script>alert(1)</script>',
      modifiedFileName: 'safe.pdf',
      hashes: { original: null, modified: null },
      pageCounts: null,
      mapping: [],
      options: baseOptions,
      summary: null,
      textDiff: null,
      visualDiffEntries: [],
    });

    expect(captured.html).not.toContain('<script>alert(1)');
    expect(captured.html).toContain('&lt;script&gt;');
  });

  it('renders changed diff entries with removed/added markup', () => {
    const captured = captureDownload();
    downloadComparisonReport({
      createdAt: '2024-01-01',
      originalFileName: 'a.pdf',
      modifiedFileName: 'b.pdf',
      hashes: { original: null, modified: null },
      pageCounts: null,
      mapping: baseMapping,
      options: baseOptions,
      summary: baseSummary,
      textDiff: [changedDiff],
      visualDiffEntries: [],
    });

    expect(captured.html).toContain('class="diff-del"');
    expect(captured.html).toContain('class="diff-ins"');
    expect(captured.html).toContain('old word');
    expect(captured.html).toContain('new word');
  });

  it('renders deleted page entries with type label "Eliminada"', () => {
    const captured = captureDownload();
    const deleted: TextDiffResult = {
      page: 2,
      kind: 'deleted',
      diff: [{ value: 'gone text', added: false, removed: true, count: 9 }],
    };
    downloadComparisonReport({
      createdAt: '2024-01-01',
      originalFileName: 'a.pdf',
      modifiedFileName: 'b.pdf',
      hashes: { original: null, modified: null },
      pageCounts: null,
      mapping: [],
      options: baseOptions,
      summary: baseSummary,
      textDiff: [deleted],
      visualDiffEntries: [],
    });

    expect(captured.html).toContain('Eliminada');
    expect(captured.html).toContain('gone text');
  });

  it('renders added page entries with type label "Anadida"', () => {
    const captured = captureDownload();
    const added: TextDiffResult = {
      page: 0,
      modifiedPage: 3,
      kind: 'added',
      diff: [{ value: 'new text', added: true, removed: false, count: 8 }],
    };
    downloadComparisonReport({
      createdAt: '2024-01-01',
      originalFileName: 'a.pdf',
      modifiedFileName: 'b.pdf',
      hashes: { original: null, modified: null },
      pageCounts: null,
      mapping: [],
      options: baseOptions,
      summary: baseSummary,
      textDiff: [added],
      visualDiffEntries: [],
    });

    expect(captured.html).toContain('Anadida');
    expect(captured.html).toContain('new text');
  });

  it('shows "Sin diferencias" when textDiff is empty', () => {
    const captured = captureDownload();
    downloadComparisonReport({
      createdAt: '2024-01-01',
      originalFileName: 'a.pdf',
      modifiedFileName: 'b.pdf',
      hashes: { original: null, modified: null },
      pageCounts: null,
      mapping: [],
      options: baseOptions,
      summary: null,
      textDiff: [],
      visualDiffEntries: [],
    });

    expect(captured.html).toContain('Sin diferencias');
  });

  it('shows "Sin datos visuales" when visualDiffEntries is empty', () => {
    const captured = captureDownload();
    downloadComparisonReport({
      createdAt: '2024-01-01',
      originalFileName: 'a.pdf',
      modifiedFileName: 'b.pdf',
      hashes: { original: null, modified: null },
      pageCounts: null,
      mapping: [],
      options: baseOptions,
      summary: null,
      textDiff: null,
      visualDiffEntries: [],
    });

    expect(captured.html).toContain('Sin datos visuales');
  });

  it('includes visual diff thumbnail when thumbnailDataUrl is provided', () => {
    const captured = captureDownload();
    downloadComparisonReport({
      createdAt: '2024-01-01',
      originalFileName: 'a.pdf',
      modifiedFileName: 'b.pdf',
      hashes: { original: null, modified: null },
      pageCounts: null,
      mapping: [],
      options: baseOptions,
      summary: baseSummary,
      textDiff: null,
      visualDiffEntries: [
        {
          originalPage: 1,
          modifiedPage: 1,
          diffPixels: 500,
          totalPixels: 10000,
          diffRatio: 0.05,
          thumbnailDataUrl: 'data:image/png;base64,ABC',
        },
      ],
    });

    expect(captured.html).toContain('data:image/png;base64,ABC');
    expect(captured.html).toContain('class="thumb"');
  });

  it('shows "Sin miniatura" when thumbnailDataUrl is empty', () => {
    const captured = captureDownload();
    downloadComparisonReport({
      createdAt: '2024-01-01',
      originalFileName: 'a.pdf',
      modifiedFileName: 'b.pdf',
      hashes: { original: null, modified: null },
      pageCounts: null,
      mapping: [],
      options: baseOptions,
      summary: baseSummary,
      textDiff: null,
      visualDiffEntries: [
        {
          originalPage: 1,
          modifiedPage: 1,
          diffPixels: 0,
          totalPixels: 0,
          diffRatio: 0,
          thumbnailDataUrl: '',
        },
      ],
    });

    expect(captured.html).toContain('Sin miniatura');
  });

  it('escapes HTML in diff content to prevent XSS', () => {
    const captured = captureDownload();
    const xssDiff: TextDiffResult = {
      page: 1,
      modifiedPage: 1,
      kind: 'changed',
      diff: [{ value: '<img src=x onerror=alert(1)>', added: true, removed: false, count: 27 }],
    };
    downloadComparisonReport({
      createdAt: '2024-01-01',
      originalFileName: 'a.pdf',
      modifiedFileName: 'b.pdf',
      hashes: { original: null, modified: null },
      pageCounts: null,
      mapping: [],
      options: baseOptions,
      summary: baseSummary,
      textDiff: [xssDiff],
      visualDiffEntries: [],
    });

    expect(captured.html).not.toContain('<img src=x');
    expect(captured.html).toContain('&lt;img');
  });

  it('includes summary stats in the HTML', () => {
    const captured = captureDownload();
    downloadComparisonReport({
      createdAt: '2024-01-01',
      originalFileName: 'a.pdf',
      modifiedFileName: 'b.pdf',
      hashes: { original: null, modified: null },
      pageCounts: { original: 5, modified: 6 },
      mapping: [],
      options: baseOptions,
      summary: { mappedPairs: 4, changedPairs: 2, unchangedPairs: 2, deletedPages: 1, addedPages: 1, totalOriginalPages: 5, totalModifiedPages: 6 },
      textDiff: [],
      visualDiffEntries: [],
    });

    expect(captured.html).toContain('4');  // mappedPairs
    expect(captured.html).toContain('2');  // changedPairs / unchangedPairs
  });

  it('renders the report in English when locale is "en"', () => {
    const captured = captureDownload();
    downloadComparisonReport({
      createdAt: '2024-01-01',
      originalFileName: 'a.pdf',
      modifiedFileName: 'b.pdf',
      hashes: { original: 'h1', modified: 'h2' },
      pageCounts: { original: 1, modified: 1 },
      mapping: baseMapping,
      options: baseOptions,
      summary: baseSummary,
      textDiff: [],
      visualDiffEntries: [],
      locale: 'en',
    });

    expect(captured.html).toContain('<html lang="en">');
    expect(captured.html).toContain('Comparison report');
    expect(captured.html).toContain('Compared documents');
    expect(captured.html).toContain('Executive summary');
    expect(captured.html).toContain('No differences');
    expect(captured.html).toContain('No visual data');
    // ES-only strings should not appear
    expect(captured.html).not.toContain('Informe de comparaci');
    expect(captured.html).not.toContain('Sin diferencias');
  });

  it('renders English "Added" label for added pages when locale is "en"', () => {
    const captured = captureDownload();
    const added: TextDiffResult = {
      page: 0,
      modifiedPage: 3,
      kind: 'added',
      diff: [{ value: 'new text', added: true, removed: false, count: 8 }],
    };
    downloadComparisonReport({
      createdAt: '2024-01-01',
      originalFileName: 'a.pdf',
      modifiedFileName: 'b.pdf',
      hashes: { original: null, modified: null },
      pageCounts: null,
      mapping: [],
      options: baseOptions,
      summary: baseSummary,
      textDiff: [added],
      visualDiffEntries: [],
      locale: 'en',
    });

    // "Added" appears both as the kind label and as a section title — either is fine.
    expect(captured.html).toMatch(/>Added</);
    expect(captured.html).not.toContain('Anadida');
  });
});

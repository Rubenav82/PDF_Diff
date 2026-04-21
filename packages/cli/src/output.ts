import type { CompareResult } from './commands/compare.js';
import { generateReportHtml } from '@pdf-diff/core';
import type { ReportData } from '@pdf-diff/core';

export function formatHtml(result: CompareResult): string {
  const textDiff = result._internal?.textDiff ?? null;

  const reportData: ReportData = {
    createdAt: new Date().toISOString(),
    originalFileName: result.original.path,
    modifiedFileName: result.modified.path,
    hashes: { original: result.original.hash, modified: result.modified.hash },
    pageCounts: { original: result.original.pages, modified: result.modified.pages },
    mapping: result.mapping.map(([o, m]) => ({
      originalPage: o ?? 0,
      modifiedPage: m ?? 0,
    })),
    options: {
      normalization: { ignoreCase: false, ignoreWhitespace: false, ignoreLineBreaks: false },
      includeUnmappedPages: false,
    },
    summary: null,
    textDiff,
    visualDiffEntries: result.pages
      .filter((p) => p.visual !== undefined)
      .map((p) => ({
        originalPage: p.original ?? 0,
        modifiedPage: p.modified ?? 0,
        diffPixels: p.visual!.diffPixels,
        totalPixels: p.visual!.totalPixels,
        diffRatio: p.visual!.diffPercentage,
        thumbnailDataUrl: p.visual!.thumbnailDataUrl ?? '',
      })),
    locale: 'en',
  };

  return generateReportHtml(reportData);
}

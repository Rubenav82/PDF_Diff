import type { CompareResult } from './commands/compare.js';
import { generateReportHtml } from '@pdf-diff/core';
import type { ReportData, ComparisonSummary } from '@pdf-diff/core';

function computeSummary(result: CompareResult): ComparisonSummary {
  const mappedPairs = result.mapping.filter(([o, m]) => o !== null && m !== null).length;
  const deletedPages = result.mapping.filter(([o, m]) => o !== null && m === null).length;
  const addedPages = result.mapping.filter(([o, m]) => o === null && m !== null).length;

  let changedPairs = 0;
  for (const page of result.pages) {
    if (page.original !== null && page.modified !== null) {
      const hasTextChanges = page.textChanges
        ? page.textChanges.added + page.textChanges.removed > 0
        : false;
      const hasVisualChanges = page.visual ? page.visual.diffPixels > 0 : false;
      if (hasTextChanges || hasVisualChanges) changedPairs++;
    }
  }

  return {
    mappedPairs,
    changedPairs,
    unchangedPairs: mappedPairs - changedPairs,
    deletedPages,
    addedPages,
    totalOriginalPages: result.original.pages,
    totalModifiedPages: result.modified.pages,
  };
}

/**
 * Transforma CompareResult de CLI en ReportData compatible con core y genera HTML.
 * Extrae textDiff de _internal, mapea resultados de página a entradas visuales, y completa defaults.
 * @param result CompareResult de runCompare (incluye _internal.textDiff para diffs detallados).
 * @returns String HTML generado a partir de los datos del reporte.
 */
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
    summary: computeSummary(result),
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

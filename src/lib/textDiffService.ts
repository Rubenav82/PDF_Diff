export type { TextComparisonResult } from '@pdf-diff/core';
export { normalizeText, buildTextComparison } from '@pdf-diff/core';

import type { TextComparisonResult } from '@pdf-diff/core';
import type {
  PageMapping,
  TextComparisonOptions,
  TextDiffResult,
  ComparisonSummary,
} from '../types/types';
import { normalizeText } from '@pdf-diff/core';
import { runTextDiff } from './workerClients';

export interface AsyncComparisonProgress {
  stage: 'text';
  current: number;
  total: number;
}

/**
 * Versión asincrónica de buildTextComparison con seguimiento de progreso.
 * Útil para UI del navegador para actualizar barra de progreso mientras la comparación procede a través de pares de páginas.
 * @param originalPages Array de texto extraído de páginas del PDF original.
 * @param modifiedPages Array de texto extraído de páginas del PDF modificado.
 * @param pageMapping Mapeo de páginas que define qué páginas comparar.
 * @param options Marcas de normalización e inclusión.
 * @param onProgress Callback opcional disparado después de que cada par de páginas sea procesado, con conteos actual y total.
 * @returns TextComparisonResult con diffResults y resumen (mismo formato que buildTextComparison sincrónico).
 */
export async function buildTextComparisonAsync(
  originalPages: string[],
  modifiedPages: string[],
  pageMapping: PageMapping,
  options: TextComparisonOptions,
  onProgress?: (progress: AsyncComparisonProgress) => void
): Promise<TextComparisonResult> {
  const diffResults: TextDiffResult[] = [];
  const mappedOriginalPages = new Set<number>();
  const mappedModifiedPages = new Set<number>();
  const deletedPages = new Set<number>();
  const addedPages = new Set<number>();

  const summary: ComparisonSummary = {
    mappedPairs: 0,
    changedPairs: 0,
    unchangedPairs: 0,
    deletedPages: 0,
    addedPages: 0,
    totalOriginalPages: originalPages.length,
    totalModifiedPages: modifiedPages.length,
  };

  const total = pageMapping.length;
  let current = 0;

  for (const mapping of pageMapping) {
    const originalPage = mapping.originalPage;
    const modifiedPage = mapping.modifiedPage;

    if (
      modifiedPage > 0 &&
      modifiedPage <= modifiedPages.length &&
      originalPage > 0 &&
      originalPage <= originalPages.length
    ) {
      mappedOriginalPages.add(originalPage);
      mappedModifiedPages.add(modifiedPage);
      summary.mappedPairs += 1;

      const originalText = normalizeText(originalPages[originalPage - 1] || '', options.normalization);
      const modifiedText = normalizeText(modifiedPages[modifiedPage - 1] || '', options.normalization);

      if (originalText !== modifiedText) {
        summary.changedPairs += 1;
        const diff = await runTextDiff(originalText, modifiedText, 'chars');
        diffResults.push({
          page: originalPage,
          modifiedPage,
          kind: 'changed',
          diff,
        });
      } else {
        summary.unchangedPairs += 1;
      }
    }

    if (options.includeUnmappedPages && modifiedPage === 0 && originalPage > 0 && originalPage <= originalPages.length) {
      const originalText = normalizeText(originalPages[originalPage - 1] || '', options.normalization);
      deletedPages.add(originalPage);
      diffResults.push({
        page: originalPage,
        kind: 'deleted',
        diff: [{ value: originalText, added: false, removed: true, count: originalText.length }],
      });
    }

    current += 1;
    onProgress?.({ stage: 'text', current, total });
  }

  if (options.includeUnmappedPages) {
    for (let originalPage = 1; originalPage <= originalPages.length; originalPage++) {
      if (!mappedOriginalPages.has(originalPage) && !deletedPages.has(originalPage)) {
        const originalText = normalizeText(originalPages[originalPage - 1] || '', options.normalization);
        deletedPages.add(originalPage);
        diffResults.push({
          page: originalPage,
          kind: 'deleted',
          diff: [{ value: originalText, added: false, removed: true, count: originalText.length }],
        });
      }
    }

    for (let modifiedPage = 1; modifiedPage <= modifiedPages.length; modifiedPage++) {
      if (!mappedModifiedPages.has(modifiedPage)) {
        const modifiedText = normalizeText(modifiedPages[modifiedPage - 1] || '', options.normalization);
        addedPages.add(modifiedPage);
        diffResults.push({
          page: 0,
          modifiedPage,
          kind: 'added',
          diff: [{ value: modifiedText, added: true, removed: false, count: modifiedText.length }],
        });
      }
    }
  }

  summary.deletedPages = deletedPages.size;
  summary.addedPages = addedPages.size;

  return { diffResults, summary };
}

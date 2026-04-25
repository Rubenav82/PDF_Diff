import { diffChars } from 'diff';
import type {
  ComparisonSummary,
  PageMapping,
  TextComparisonOptions,
  TextDiffResult,
} from './types.js';

export interface TextComparisonResult {
  diffResults: TextDiffResult[];
  summary: ComparisonSummary;
}

export function normalizeText(text: string, options: TextComparisonOptions['normalization']): string {
  let normalized = text;

  if (options.ignoreLineBreaks) {
    normalized = normalized.replace(/[\r\n]+/g, ' ');
  }

  if (options.ignoreWhitespace) {
    normalized = normalized.replace(/\s+/g, ' ').trim();
  }

  if (options.ignoreCase) {
    normalized = normalized.toLowerCase();
  }

  return normalized;
}

/**
 * Realiza comparación de texto a nivel de carácter entre páginas mapeadas.
 * Clasifica cada par de páginas como cambio, eliminado o agregado. Recopila estadísticas de resumen.
 * Solo incluye páginas sin mapear si options.includeUnmappedPages es verdadero.
 * @param originalPages Array de texto extraído de páginas del PDF original (índice = número de página - 1).
 * @param modifiedPages Array de texto extraído de páginas del PDF modificado (índice = número de página - 1).
 * @param pageMapping Mapeo de páginas que define qué páginas original y modificada comparar.
 * @param options Marcas de normalización e inclusión (ignoreCase, ignoreWhitespace, ignoreLineBreaks, includeUnmappedPages).
 * @returns Objeto que contiene diffResults (diffs por página con tipo 'changed'/'deleted'/'added') y estadísticas de resumen.
 */
export function buildTextComparison(
  originalPages: string[],
  modifiedPages: string[],
  pageMapping: PageMapping,
  options: TextComparisonOptions
): TextComparisonResult {
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

  for (const mapping of pageMapping) {
    const originalPage = mapping.originalPage;
    const modifiedPage = mapping.modifiedPage;

    if (modifiedPage > 0 && modifiedPage <= modifiedPages.length && originalPage > 0 && originalPage <= originalPages.length) {
      mappedOriginalPages.add(originalPage);
      mappedModifiedPages.add(modifiedPage);
      summary.mappedPairs += 1;

      const originalText = normalizeText(originalPages[originalPage - 1] || '', options.normalization);
      const modifiedText = normalizeText(modifiedPages[modifiedPage - 1] || '', options.normalization);

      if (originalText !== modifiedText) {
        summary.changedPairs += 1;
        diffResults.push({
          page: originalPage,
          modifiedPage,
          kind: 'changed',
          diff: diffChars(originalText, modifiedText),
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

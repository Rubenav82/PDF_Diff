import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {
  suggestPageMapping,
  buildTextComparison,
  buildVisualDiffEntries,
  getPdfPageCountFromBuffer,
  extractTextFromBuffer,
} from '@pdf-diff/core';
import type { PageMapping, TextComparisonOptions, TextDiffResult } from '@pdf-diff/core';
import { nodeCanvasProvider } from '../nodeCanvasProvider.js';
import { formatHtml } from '../output.js';

export interface PageResult {
  original: number | null;
  modified: number | null;
  textChanges?: {
    added: number;
    removed: number;
    unchanged: number;
  };
  visual?: {
    diffPixels: number;
    totalPixels: number;
    diffPercentage: number;
    thumbnailDataUrl?: string;
  };
}

export interface CompareResult {
  version: '1.0';
  original: { path: string; hash: string; pages: number };
  modified: { path: string; hash: string; pages: number };
  mapping: Array<[number | null, number | null]>;
  summary: {
    text: { added: number; removed: number; unchanged: number } | null;
    visual: { diffPixels: number; diffPercentage: number } | null;
    thresholds: {
      textChangesLimit: number | null;
      visualLimit: number | null;
      passed: boolean;
    };
  };
  pages: PageResult[];
  _internal?: {
    textDiff: TextDiffResult[] | null;
  };
}

export interface CompareOptions {
  output: 'json' | 'html' | 'text';
  out?: string;
  mode: 'text+visual' | 'text-only' | 'visual-only';
  autoMap: boolean;
  map?: string;
  maxVisualDiff?: number;
  maxTextChanges?: number;
  ignoreCase: boolean;
  ignoreWhitespace: boolean;
}

function sha512(buf: Uint8Array): string {
  return 'sha512:' + createHash('sha512').update(buf).digest('hex');
}

function parseManualMap(spec: string, origPages: number, modPages: number): PageMapping {
  return spec.split(',').map((pair) => {
    const [a, b] = pair.split(':');
    const orig = a === 'null' ? null : parseInt(a, 10);
    const mod = b === 'null' ? null : parseInt(b, 10);
    if (orig !== null && (isNaN(orig) || orig < 1 || orig > origPages)) {
      throw new Error(`Invalid original page in map: ${a}`);
    }
    if (mod !== null && (isNaN(mod) || mod < 1 || mod > modPages)) {
      throw new Error(`Invalid modified page in map: ${b}`);
    }
    return { originalPage: orig ?? 0, modifiedPage: mod ?? 0 };
  });
}

function countDiffChars(diff: TextDiffResult['diff']): { added: number; removed: number; unchanged: number } {
  let added = 0, removed = 0, unchanged = 0;
  for (const part of diff) {
    if (part.added) added += part.value.length;
    else if (part.removed) removed += part.value.length;
    else unchanged += part.value.length;
  }
  return { added, removed, unchanged };
}

/**
 * Orquesta la comparación completa de PDF: hash, conteo de páginas, extracción de texto, mapeo de páginas, diff de texto, diff visual y evaluación de umbrales.
 * Determina código de salida basado en si existen diffs y si pasan umbrales explícitos.
 * @param originalPath Ruta al archivo PDF original.
 * @param modifiedPath Ruta al archivo PDF modificado.
 * @param opts Opciones de comparación (modo, autoMap, formato de salida, marcas de normalización, umbrales).
 * @returns CompareResult con todos los diffs calculados y resumen, más exitCode (0 = éxito, 1 = fallo).
 * @throws Si los archivos no pueden leerse o falla el procesamiento de PDF.
 */
export async function runCompare(
  originalPath: string,
  modifiedPath: string,
  opts: CompareOptions
): Promise<{ result: CompareResult; exitCode: number }> {
  const toOwnedUint8Array = (b: Buffer): Uint8Array =>
    new Uint8Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
  const [origBuf, modBuf] = await Promise.all([
    readFile(originalPath).then(toOwnedUint8Array),
    readFile(modifiedPath).then(toOwnedUint8Array),
  ]);

  const [origHash, modHash] = [sha512(origBuf), sha512(modBuf)];
  const [origPages, modPages] = await Promise.all([
    getPdfPageCountFromBuffer(origBuf),
    getPdfPageCountFromBuffer(modBuf),
  ]);

  let pageMapping: PageMapping;
  let origTexts: string[] = [];
  let modTexts: string[] = [];

  const needsText = opts.mode !== 'visual-only' || opts.autoMap;
  if (needsText) {
    [origTexts, modTexts] = await Promise.all([
      extractTextFromBuffer(origBuf),
      extractTextFromBuffer(modBuf),
    ]);
  }

  if (opts.map) {
    pageMapping = parseManualMap(opts.map, origPages, modPages);
  } else if (opts.autoMap) {
    pageMapping = suggestPageMapping(origTexts, modTexts);
  } else {
    const count = Math.max(origPages, modPages);
    pageMapping = Array.from({ length: count }, (_, i) => ({
      originalPage: i < origPages ? i + 1 : 0,
      modifiedPage: i < modPages ? i + 1 : 0,
    }));
  }

  const normOptions: TextComparisonOptions['normalization'] = {
    ignoreCase: opts.ignoreCase,
    ignoreWhitespace: opts.ignoreWhitespace,
    ignoreLineBreaks: false,
  };

  const textCompOptions: TextComparisonOptions = {
    normalization: normOptions,
    includeUnmappedPages: false,
  };

  let textDiffResults: TextDiffResult[] | null = null;
  const pages: PageResult[] = [];

  if (opts.mode === 'text+visual' || opts.mode === 'text-only') {
    const cmp = buildTextComparison(origTexts, modTexts, pageMapping, textCompOptions);
    textDiffResults = cmp.diffResults;

    for (const entry of pageMapping) {
      const diffEntry = cmp.diffResults.find(
        (d) => d.page === entry.originalPage && d.modifiedPage === entry.modifiedPage
      );
      const counts = diffEntry ? countDiffChars(diffEntry.diff) : { added: 0, removed: 0, unchanged: 0 };
      pages.push({
        original: entry.originalPage > 0 ? entry.originalPage : null,
        modified: entry.modifiedPage > 0 ? entry.modifiedPage : null,
        textChanges: counts,
      });
    }
  }

  if (opts.mode === 'text+visual' || opts.mode === 'visual-only') {
    const visualEntries = await buildVisualDiffEntries(origBuf, modBuf, pageMapping, nodeCanvasProvider);

    for (const ve of visualEntries) {
      const existing = pages.find(
        (p) => (p.original ?? 0) === ve.originalPage && (p.modified ?? 0) === ve.modifiedPage
      );
      const visual = {
        diffPixels: ve.diffPixels,
        totalPixels: ve.totalPixels,
        diffPercentage: ve.diffRatio,
        thumbnailDataUrl: ve.thumbnailDataUrl,
      };
      if (existing) {
        existing.visual = visual;
      } else {
        pages.push({
          original: ve.originalPage > 0 ? ve.originalPage : null,
          modified: ve.modifiedPage > 0 ? ve.modifiedPage : null,
          visual,
        });
      }
    }
  }

  if (opts.mode === 'visual-only') {
    for (const entry of pageMapping) {
      if (!pages.find((p) => (p.original ?? 0) === entry.originalPage && (p.modified ?? 0) === entry.modifiedPage)) {
        pages.push({
          original: entry.originalPage > 0 ? entry.originalPage : null,
          modified: entry.modifiedPage > 0 ? entry.modifiedPage : null,
        });
      }
    }
  }

  const textSummary =
    opts.mode !== 'visual-only'
      ? pages.reduce(
          (acc, p) => {
            if (p.textChanges) {
              acc.added += p.textChanges.added;
              acc.removed += p.textChanges.removed;
              acc.unchanged += p.textChanges.unchanged;
            }
            return acc;
          },
          { added: 0, removed: 0, unchanged: 0 }
        )
      : null;

  const visualSummaryAgg =
    opts.mode !== 'text-only'
      ? pages.reduce(
          (acc, p) => {
            if (p.visual) {
              acc.diffPixels += p.visual.diffPixels;
              acc.totalPixels += p.visual.totalPixels;
            }
            return acc;
          },
          { diffPixels: 0, totalPixels: 0 }
        )
      : null;

  const visualDiffPct =
    visualSummaryAgg && visualSummaryAgg.totalPixels > 0
      ? visualSummaryAgg.diffPixels / visualSummaryAgg.totalPixels
      : 0;

  const totalTextChanges = textSummary ? textSummary.added + textSummary.removed : 0;

  const thresholdsPassed =
    (opts.maxVisualDiff === undefined || visualDiffPct <= opts.maxVisualDiff) &&
    (opts.maxTextChanges === undefined || totalTextChanges <= opts.maxTextChanges);

  const hasDiffs =
    totalTextChanges > 0 || (visualSummaryAgg !== null && visualSummaryAgg.diffPixels > 0);

  const result: CompareResult = {
    version: '1.0',
    original: { path: originalPath, hash: origHash, pages: origPages },
    modified: { path: modifiedPath, hash: modHash, pages: modPages },
    mapping: pageMapping.map((e) => [
      e.originalPage > 0 ? e.originalPage : null,
      e.modifiedPage > 0 ? e.modifiedPage : null,
    ]),
    summary: {
      text: textSummary,
      visual: visualSummaryAgg
        ? { diffPixels: visualSummaryAgg.diffPixels, diffPercentage: visualDiffPct }
        : null,
      thresholds: {
        textChangesLimit: opts.maxTextChanges ?? null,
        visualLimit: opts.maxVisualDiff ?? null,
        passed: thresholdsPassed,
      },
    },
    pages,
    _internal: { textDiff: textDiffResults },
  };

  // Exit 0: no diffs, or diffs within explicit thresholds. Exit 1: diffs (no threshold) or threshold exceeded.
  const hasExplicitThreshold = opts.maxVisualDiff !== undefined || opts.maxTextChanges !== undefined;
  const exitCode = thresholdsPassed && (!hasDiffs || hasExplicitThreshold) ? 0 : 1;
  return { result, exitCode };
}

/**
 * Punto de entrada CLI para comparación de PDF. Envuelve runCompare y formatea salida (JSON/HTML/texto).
 * Escribe salida a archivo (si opts.out está configurado) o a stdout. Siempre llama process.exit con el código de resultado.
 * @param originalPath Ruta al archivo PDF original.
 * @param modifiedPath Ruta al archivo PDF modificado.
 * @param opts Opciones de comparación y formato de salida.
 * @throws Nunca (captura todos los errores internamente y sale con código 2).
 */
export async function compareCommand(
  originalPath: string,
  modifiedPath: string,
  opts: CompareOptions
): Promise<void> {
  let exitCode = 2;
  try {
    const { result, exitCode: code } = await runCompare(originalPath, modifiedPath, opts);
    exitCode = code;

    let output: string;
    if (opts.output === 'json') {
      const { _internal: _i, ...publicResult } = result;
      output = JSON.stringify(publicResult, null, 2);
    } else if (opts.output === 'html') {
      output = formatHtml(result);
    } else {
      const { summary } = result;
      const lines: string[] = [
        `Original: ${result.original.path} (${result.original.pages} pages)`,
        `Modified: ${result.modified.path} (${result.modified.pages} pages)`,
      ];
      if (summary.text) {
        lines.push(
          `Text: +${summary.text.added} added, -${summary.text.removed} removed, ${summary.text.unchanged} unchanged`
        );
      }
      if (summary.visual) {
        lines.push(
          `Visual: ${summary.visual.diffPixels} diff pixels (${(summary.visual.diffPercentage * 100).toFixed(3)}%)`
        );
      }
      lines.push(`Thresholds: ${summary.thresholds.passed ? 'PASSED' : 'FAILED'}`);
      output = lines.join('\n');
    }

    if (opts.out) {
      await writeFile(opts.out, output, 'utf8');
    } else {
      process.stdout.write(output + '\n');
    }
  } catch (err) {
    process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
    exitCode = 2;
  }

  process.exit(exitCode);
}

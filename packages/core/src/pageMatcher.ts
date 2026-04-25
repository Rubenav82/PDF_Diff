import type { PageMapping } from './types.js';
import { normalizeText } from './textDiff.js';

export interface PageMatcherOptions {
  threshold?: number;
  shingleSize?: number;
  gapPenalty?: number;
}

const DEFAULT_OPTIONS: Required<PageMatcherOptions> = {
  threshold: 0.2,
  shingleSize: 3,
  gapPenalty: 0,
};

const MATCH_NORMALIZATION = {
  ignoreCase: true,
  ignoreWhitespace: true,
  ignoreLineBreaks: true,
};

/**
 * Builds word-based shingles (n-grams) from text for similarity matching.
 * When text has fewer words than shingle size, each word becomes a shingle.
 * @param text The text to build shingles from.
 * @param size The number of consecutive words per shingle.
 * @returns A set of shingles (word n-grams).
 */
export function buildShingles(text: string, size: number): Set<string> {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const shingles = new Set<string>();
  if (words.length === 0) return shingles;
  if (words.length < size) {
    words.forEach((w) => shingles.add(w));
    return shingles;
  }
  for (let i = 0; i <= words.length - size; i++) {
    shingles.add(words.slice(i, i + size).join(' '));
  }
  return shingles;
}

export function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) intersection += 1;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Suggests an automatic page mapping between original and modified PDFs using dynamic programming.
 * Uses shingle-based Jaccard similarity to find optimal page pairs, then backtracks to construct the mapping.
 * Pages with similarity below the threshold are treated as deleted (original) or inserted (modified).
 * @param originalTexts Extracted text from each page of the original PDF.
 * @param modifiedTexts Extracted text from each page of the modified PDF.
 * @param options Matching options: threshold (min similarity to match, default 0.2), shingleSize (n-gram size, default 3), gapPenalty (penalty for deletions/insertions, default 0).
 * @returns PageMapping array where each entry maps an original page number to a modified page number (0 means no match).
 */
export function suggestPageMapping(
  originalTexts: string[],
  modifiedTexts: string[],
  options: PageMatcherOptions = {}
): PageMapping {
  const { threshold, shingleSize, gapPenalty } = { ...DEFAULT_OPTIONS, ...options };

  const n = originalTexts.length;
  const m = modifiedTexts.length;

  if (n === 0) return [];

  if (m === 0) {
    return originalTexts.map((_, i) => ({ originalPage: i + 1, modifiedPage: 0 }));
  }

  const origShingles = originalTexts.map((t) =>
    buildShingles(normalizeText(t, MATCH_NORMALIZATION), shingleSize)
  );
  const modShingles = modifiedTexts.map((t) =>
    buildShingles(normalizeText(t, MATCH_NORMALIZATION), shingleSize)
  );

  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  const back: Array<Array<'S' | 'M' | 'D' | 'I'>> = Array.from({ length: n + 1 }, () =>
    new Array(m + 1).fill('S')
  );

  for (let i = 1; i <= n; i++) {
    dp[i][0] = dp[i - 1][0] + gapPenalty;
    back[i][0] = 'D';
  }
  for (let j = 1; j <= m; j++) {
    dp[0][j] = dp[0][j - 1] + gapPenalty;
    back[0][j] = 'I';
  }

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const sim = jaccardSimilarity(origShingles[i - 1], modShingles[j - 1]);
      const matchScore = sim >= threshold ? dp[i - 1][j - 1] + sim : -Infinity;
      const deleteScore = dp[i - 1][j] + gapPenalty;
      const insertScore = dp[i][j - 1] + gapPenalty;

      if (matchScore >= deleteScore && matchScore >= insertScore && matchScore > -Infinity) {
        dp[i][j] = matchScore;
        back[i][j] = 'M';
      } else if (deleteScore >= insertScore) {
        dp[i][j] = deleteScore;
        back[i][j] = 'D';
      } else {
        dp[i][j] = insertScore;
        back[i][j] = 'I';
      }
    }
  }

  const matched = new Map<number, number>();
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    const dir = back[i][j];
    if (dir === 'M') {
      matched.set(i - 1, j - 1);
      i -= 1;
      j -= 1;
    } else if (dir === 'D') {
      i -= 1;
    } else if (dir === 'I') {
      j -= 1;
    } else {
      break;
    }
  }

  const mapping: PageMapping = [];
  for (let o = 0; o < n; o++) {
    const modIdx = matched.get(o);
    mapping.push({
      originalPage: o + 1,
      modifiedPage: modIdx === undefined ? 0 : modIdx + 1,
    });
  }
  return mapping;
}

import type { PageMapping } from '../types/types';
import { normalizeText } from './textDiffService';

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

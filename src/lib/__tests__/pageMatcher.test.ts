import { describe, it, expect } from 'vitest';
import { buildShingles, jaccardSimilarity, suggestPageMapping } from '../pageMatcher';

// ─── buildShingles ────────────────────────────────────────────────────────────

describe('buildShingles', () => {
  it('returns empty set for empty text', () => {
    expect(buildShingles('', 3).size).toBe(0);
  });

  it('returns each word as its own shingle when text has fewer words than size', () => {
    const shingles = buildShingles('hola mundo', 3);
    expect(shingles.has('hola')).toBe(true);
    expect(shingles.has('mundo')).toBe(true);
    expect(shingles.size).toBe(2);
  });

  it('produces overlapping shingles of the given size', () => {
    const shingles = buildShingles('a b c d', 3);
    expect(shingles.has('a b c')).toBe(true);
    expect(shingles.has('b c d')).toBe(true);
    expect(shingles.size).toBe(2);
  });

  it('handles collapsed whitespace', () => {
    const shingles = buildShingles('a   b\t c', 2);
    expect(shingles.has('a b')).toBe(true);
    expect(shingles.has('b c')).toBe(true);
  });
});

// ─── jaccardSimilarity ────────────────────────────────────────────────────────

describe('jaccardSimilarity', () => {
  it('returns 0 when one set is empty', () => {
    expect(jaccardSimilarity(new Set(), new Set(['a']))).toBe(0);
    expect(jaccardSimilarity(new Set(['a']), new Set())).toBe(0);
  });

  it('returns 0 for two empty sets', () => {
    expect(jaccardSimilarity(new Set(), new Set())).toBe(0);
  });

  it('returns 1 for identical sets', () => {
    expect(jaccardSimilarity(new Set(['a', 'b']), new Set(['a', 'b']))).toBe(1);
  });

  it('returns 0 for disjoint sets', () => {
    expect(jaccardSimilarity(new Set(['a', 'b']), new Set(['c', 'd']))).toBe(0);
  });

  it('computes correct ratio for partial overlap', () => {
    // |{a,b} ∩ {b,c}| = 1, |{a,b} ∪ {b,c}| = 3 → 1/3
    expect(jaccardSimilarity(new Set(['a', 'b']), new Set(['b', 'c']))).toBeCloseTo(1 / 3);
  });
});

// ─── suggestPageMapping ───────────────────────────────────────────────────────

describe('suggestPageMapping', () => {
  const pages = {
    intro: 'El presente contrato se celebra entre las partes mencionadas a continuación',
    clauses: 'Primera cláusula: las partes acuerdan respetar los términos aquí descritos',
    payment: 'Los pagos se realizarán mediante transferencia bancaria en euros antes del día 15',
    extra: 'Cláusula adicional sobre confidencialidad de la información compartida',
    signatures: 'En fe de lo cual firman ambas partes en el lugar y fecha indicados arriba',
  };

  it('returns empty mapping when original has no pages', () => {
    expect(suggestPageMapping([], ['whatever'])).toEqual([]);
  });

  it('marks all pages as deleted when modified has no pages', () => {
    expect(suggestPageMapping([pages.intro, pages.clauses], [])).toEqual([
      { originalPage: 1, modifiedPage: 0 },
      { originalPage: 2, modifiedPage: 0 },
    ]);
  });

  it('maps 1:1 when both documents are identical', () => {
    const texts = [pages.intro, pages.clauses, pages.payment, pages.signatures];
    expect(suggestPageMapping(texts, texts)).toEqual([
      { originalPage: 1, modifiedPage: 1 },
      { originalPage: 2, modifiedPage: 2 },
      { originalPage: 3, modifiedPage: 3 },
      { originalPage: 4, modifiedPage: 4 },
    ]);
  });

  it('detects an inserted page in modified and shifts subsequent mappings', () => {
    const original = [pages.intro, pages.clauses, pages.payment, pages.signatures];
    const modified = [pages.intro, pages.clauses, pages.extra, pages.payment, pages.signatures];
    expect(suggestPageMapping(original, modified)).toEqual([
      { originalPage: 1, modifiedPage: 1 },
      { originalPage: 2, modifiedPage: 2 },
      { originalPage: 3, modifiedPage: 4 },
      { originalPage: 4, modifiedPage: 5 },
    ]);
  });

  it('detects a deleted page in original', () => {
    const original = [pages.intro, pages.clauses, pages.extra, pages.payment];
    const modified = [pages.intro, pages.clauses, pages.payment];
    expect(suggestPageMapping(original, modified)).toEqual([
      { originalPage: 1, modifiedPage: 1 },
      { originalPage: 2, modifiedPage: 2 },
      { originalPage: 3, modifiedPage: 0 },
      { originalPage: 4, modifiedPage: 3 },
    ]);
  });

  it('marks all pages as deleted when no content overlaps above threshold', () => {
    const original = ['lorem ipsum dolor sit amet consectetur adipiscing elit'];
    const modified = ['totally unrelated text about weather and cooking recipes'];
    expect(suggestPageMapping(original, modified)).toEqual([{ originalPage: 1, modifiedPage: 0 }]);
  });

  it('matches pages even after heavy modification (small inserts and edits)', () => {
    const original = [pages.payment];
    const modified = ['Los pagos se realizarán mediante transferencia bancaria en dólares antes del día 20 del mes'];
    const result = suggestPageMapping(original, modified);
    expect(result).toEqual([{ originalPage: 1, modifiedPage: 1 }]);
  });

  it('preserves monotonicity (no crossed mappings)', () => {
    const original = [pages.intro, pages.clauses, pages.payment];
    const modified = [pages.payment, pages.clauses, pages.intro];
    const result = suggestPageMapping(original, modified);
    const modPages = result.map((r) => r.modifiedPage).filter((p) => p > 0);
    const sorted = [...modPages].sort((a, b) => a - b);
    expect(modPages).toEqual(sorted);
  });

  it('ignores blank pages rather than matching them trivially', () => {
    const result = suggestPageMapping(['', pages.clauses], ['', pages.clauses]);
    expect(result[0]).toEqual({ originalPage: 1, modifiedPage: 0 });
    expect(result[1]).toEqual({ originalPage: 2, modifiedPage: 2 });
  });

  it('respects a custom threshold that rejects weak matches', () => {
    const original = ['alpha beta gamma delta'];
    const modified = ['alpha zeta eta theta'];
    const permissive = suggestPageMapping(original, modified, { threshold: 0.05, shingleSize: 1 });
    const strict = suggestPageMapping(original, modified, { threshold: 0.9, shingleSize: 1 });
    expect(permissive[0].modifiedPage).toBe(1);
    expect(strict[0].modifiedPage).toBe(0);
  });
});

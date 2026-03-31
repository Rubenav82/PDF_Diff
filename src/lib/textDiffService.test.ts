import { describe, expect, it } from 'vitest';
import { buildTextComparison, normalizeText } from './textDiffService';
import type { TextComparisonOptions } from '../types/types';

const defaultOptions: TextComparisonOptions = {
  includeUnmappedPages: false,
  normalization: {
    ignoreCase: false,
    ignoreWhitespace: false,
    ignoreLineBreaks: false,
  },
};

describe('normalizeText', () => {
  it('normaliza según las opciones activadas', () => {
    const input = 'Hola\n   MUNDO  ';

    const normalized = normalizeText(input, {
      ignoreCase: true,
      ignoreWhitespace: true,
      ignoreLineBreaks: true,
    });

    expect(normalized).toBe('hola mundo');
  });
});

describe('buildTextComparison', () => {
  it('solo compara pares mapeados válidos por defecto', () => {
    const result = buildTextComparison(
      ['A', 'B', 'C'],
      ['A', 'X', 'Y'],
      [{ originalPage: 1, modifiedPage: 1 }],
      defaultOptions
    );

    expect(result.diffResults).toHaveLength(0);
    expect(result.summary.mappedPairs).toBe(1);
    expect(result.summary.unchangedPairs).toBe(1);
    expect(result.summary.changedPairs).toBe(0);
    expect(result.summary.deletedPages).toBe(0);
    expect(result.summary.addedPages).toBe(0);
  });

  it('incluye páginas no mapeadas cuando se activa la opción', () => {
    const result = buildTextComparison(
      ['A', 'B', 'C'],
      ['A', 'X', 'Y'],
      [{ originalPage: 1, modifiedPage: 1 }, { originalPage: 2, modifiedPage: 0 }],
      {
        ...defaultOptions,
        includeUnmappedPages: true,
      }
    );

    const kinds = result.diffResults.map((item) => item.kind);
    expect(kinds).toContain('deleted');
    expect(kinds).toContain('added');
    expect(result.summary.deletedPages).toBe(2);
    expect(result.summary.addedPages).toBe(2);
  });

  it('ignora diferencias de caso y espacios cuando se configura', () => {
    const result = buildTextComparison(
      ['Hola   mundo'],
      ['hola\nMUNDO'],
      [{ originalPage: 1, modifiedPage: 1 }],
      {
        includeUnmappedPages: false,
        normalization: {
          ignoreCase: true,
          ignoreWhitespace: true,
          ignoreLineBreaks: true,
        },
      }
    );

    expect(result.diffResults).toHaveLength(0);
    expect(result.summary.changedPairs).toBe(0);
    expect(result.summary.unchangedPairs).toBe(1);
  });
});

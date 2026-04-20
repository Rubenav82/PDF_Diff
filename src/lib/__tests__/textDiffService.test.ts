import { describe, it, expect } from 'vitest';
import { normalizeText, buildTextComparison, buildTextComparisonAsync } from '../textDiffService';
import type { TextComparisonOptions, PageMapping } from '../../types/types';

const defaultNormalization: TextComparisonOptions['normalization'] = {
  ignoreLineBreaks: false,
  ignoreWhitespace: false,
  ignoreCase: false,
};

const defaultOptions: TextComparisonOptions = {
  normalization: defaultNormalization,
  includeUnmappedPages: true,
};

// ─── normalizeText ────────────────────────────────────────────────────────────

describe('normalizeText', () => {
  it('returns text unchanged when all options are off', () => {
    expect(normalizeText('Hello World\nLine2', defaultNormalization)).toBe('Hello World\nLine2');
  });

  describe('ignoreLineBreaks', () => {
    it('replaces \\n with a space', () => {
      expect(normalizeText('a\nb', { ...defaultNormalization, ignoreLineBreaks: true })).toBe('a b');
    });

    it('replaces \\r\\n with a space', () => {
      expect(normalizeText('a\r\nb', { ...defaultNormalization, ignoreLineBreaks: true })).toBe('a b');
    });

    it('collapses consecutive line breaks into one space', () => {
      expect(normalizeText('a\n\n\nb', { ...defaultNormalization, ignoreLineBreaks: true })).toBe('a b');
    });
  });

  describe('ignoreWhitespace', () => {
    it('collapses multiple spaces', () => {
      expect(normalizeText('a   b', { ...defaultNormalization, ignoreWhitespace: true })).toBe('a b');
    });

    it('trims leading and trailing whitespace', () => {
      expect(normalizeText('  hello  ', { ...defaultNormalization, ignoreWhitespace: true })).toBe('hello');
    });

    it('collapses mixed whitespace (tabs and spaces)', () => {
      expect(normalizeText('a\t  b', { ...defaultNormalization, ignoreWhitespace: true })).toBe('a b');
    });
  });

  describe('ignoreCase', () => {
    it('lowercases the text', () => {
      expect(normalizeText('Hello WORLD', { ...defaultNormalization, ignoreCase: true })).toBe('hello world');
    });

    it('leaves already lowercase text unchanged', () => {
      expect(normalizeText('hello', { ...defaultNormalization, ignoreCase: true })).toBe('hello');
    });
  });

  describe('combined options', () => {
    it('applies all three normalizations together', () => {
      const opts = { ignoreLineBreaks: true, ignoreWhitespace: true, ignoreCase: true };
      expect(normalizeText('  Hello\r\n  WORLD  ', opts)).toBe('hello world');
    });
  });

  describe('edge cases', () => {
    it('handles empty string', () => {
      expect(normalizeText('', { ignoreLineBreaks: true, ignoreWhitespace: true, ignoreCase: true })).toBe('');
    });

    it('handles string with only whitespace', () => {
      expect(normalizeText('   ', { ...defaultNormalization, ignoreWhitespace: true })).toBe('');
    });
  });
});

// ─── buildTextComparison ──────────────────────────────────────────────────────

describe('buildTextComparison', () => {
  describe('happy path — matched pages', () => {
    it('reports unchanged when both pages are identical', () => {
      const { diffResults, summary } = buildTextComparison(
        ['same text'],
        ['same text'],
        [{ originalPage: 1, modifiedPage: 1 }],
        defaultOptions
      );

      expect(diffResults).toHaveLength(0);
      expect(summary.mappedPairs).toBe(1);
      expect(summary.unchangedPairs).toBe(1);
      expect(summary.changedPairs).toBe(0);
    });

    it('reports changed when pages differ', () => {
      const { diffResults, summary } = buildTextComparison(
        ['original text'],
        ['modified text'],
        [{ originalPage: 1, modifiedPage: 1 }],
        defaultOptions
      );

      expect(diffResults).toHaveLength(1);
      expect(diffResults[0].kind).toBe('changed');
      expect(diffResults[0].page).toBe(1);
      expect(diffResults[0].modifiedPage).toBe(1);
      expect(summary.changedPairs).toBe(1);
      expect(summary.unchangedPairs).toBe(0);
    });

    it('produces char-level diff tokens for changed pages', () => {
      const { diffResults } = buildTextComparison(
        ['cat'],
        ['car'],
        [{ originalPage: 1, modifiedPage: 1 }],
        defaultOptions
      );

      const values = diffResults[0].diff.map((d) => d.value);
      expect(values).toContain('ca');
      expect(values).toContain('t');
      expect(values).toContain('r');
    });

    it('handles multiple page mappings with mixed results', () => {
      const { summary } = buildTextComparison(
        ['same', 'original'],
        ['same', 'modified'],
        [
          { originalPage: 1, modifiedPage: 1 },
          { originalPage: 2, modifiedPage: 2 },
        ],
        defaultOptions
      );

      expect(summary.mappedPairs).toBe(2);
      expect(summary.unchangedPairs).toBe(1);
      expect(summary.changedPairs).toBe(1);
    });
  });

  describe('deleted pages', () => {
    it('marks pages with modifiedPage === 0 as deleted', () => {
      const { diffResults, summary } = buildTextComparison(
        ['deleted content'],
        [],
        [{ originalPage: 1, modifiedPage: 0 }],
        defaultOptions
      );

      expect(diffResults).toHaveLength(1);
      expect(diffResults[0].kind).toBe('deleted');
      expect(diffResults[0].page).toBe(1);
      expect(summary.deletedPages).toBe(1);
    });

    it('diff token for deleted page is fully removed', () => {
      const { diffResults } = buildTextComparison(
        ['gone'],
        [],
        [{ originalPage: 1, modifiedPage: 0 }],
        defaultOptions
      );

      expect(diffResults[0].diff[0].removed).toBe(true);
      expect(diffResults[0].diff[0].added).toBe(false);
    });

    it('skips deleted pages when includeUnmappedPages is false', () => {
      const { diffResults } = buildTextComparison(
        ['deleted content'],
        [],
        [{ originalPage: 1, modifiedPage: 0 }],
        { ...defaultOptions, includeUnmappedPages: false }
      );

      expect(diffResults).toHaveLength(0);
    });
  });

  describe('added pages', () => {
    it('marks unmapped modified pages as added', () => {
      const { diffResults, summary } = buildTextComparison(
        ['original'],
        ['original', 'new page'],
        [{ originalPage: 1, modifiedPage: 1 }],
        defaultOptions
      );

      const added = diffResults.filter((r) => r.kind === 'added');
      expect(added).toHaveLength(1);
      expect(added[0].page).toBe(0);
      expect(added[0].modifiedPage).toBe(2);
      expect(summary.addedPages).toBe(1);
    });

    it('diff token for added page is fully added', () => {
      const { diffResults } = buildTextComparison(
        [],
        ['brand new'],
        [],
        defaultOptions
      );

      expect(diffResults[0].diff[0].added).toBe(true);
      expect(diffResults[0].diff[0].removed).toBe(false);
    });

    it('skips added pages when includeUnmappedPages is false', () => {
      const { diffResults } = buildTextComparison(
        ['original'],
        ['original', 'new page'],
        [{ originalPage: 1, modifiedPage: 1 }],
        { ...defaultOptions, includeUnmappedPages: false }
      );

      expect(diffResults.filter((r) => r.kind === 'added')).toHaveLength(0);
    });
  });

  describe('unmapped original pages', () => {
    it('treats unmapped original pages as deleted when includeUnmappedPages is true', () => {
      const { diffResults, summary } = buildTextComparison(
        ['page1', 'orphan'],
        ['page1'],
        [{ originalPage: 1, modifiedPage: 1 }],
        defaultOptions
      );

      const deleted = diffResults.filter((r) => r.kind === 'deleted');
      expect(deleted).toHaveLength(1);
      expect(deleted[0].page).toBe(2);
      expect(summary.deletedPages).toBe(1);
    });
  });

  describe('summary totals', () => {
    it('reports correct totalOriginalPages and totalModifiedPages', () => {
      const { summary } = buildTextComparison(
        ['a', 'b', 'c'],
        ['x', 'y'],
        [],
        defaultOptions
      );

      expect(summary.totalOriginalPages).toBe(3);
      expect(summary.totalModifiedPages).toBe(2);
    });
  });

  describe('normalization integration', () => {
    it('treats pages as identical when they differ only by case and ignoreCase is on', () => {
      const { summary } = buildTextComparison(
        ['Hello World'],
        ['hello world'],
        [{ originalPage: 1, modifiedPage: 1 }],
        { normalization: { ...defaultNormalization, ignoreCase: true }, includeUnmappedPages: false }
      );

      expect(summary.unchangedPairs).toBe(1);
      expect(summary.changedPairs).toBe(0);
    });

    it('treats pages as identical when they differ only by whitespace and ignoreWhitespace is on', () => {
      const { summary } = buildTextComparison(
        ['hello   world'],
        ['hello world'],
        [{ originalPage: 1, modifiedPage: 1 }],
        { normalization: { ...defaultNormalization, ignoreWhitespace: true }, includeUnmappedPages: false }
      );

      expect(summary.unchangedPairs).toBe(1);
    });
  });

  describe('edge cases', () => {
    it('handles empty page arrays with no mappings', () => {
      const { diffResults, summary } = buildTextComparison([], [], [], defaultOptions);

      expect(diffResults).toHaveLength(0);
      expect(summary.mappedPairs).toBe(0);
      expect(summary.deletedPages).toBe(0);
      expect(summary.addedPages).toBe(0);
    });

    it('ignores out-of-bounds mapping entries (no changed result emitted)', () => {
      const { diffResults } = buildTextComparison(
        ['only page'],
        ['only page'],
        [{ originalPage: 99, modifiedPage: 99 }],
        defaultOptions
      );

      // The mapping is out of bounds so no 'changed' entry is produced;
      // page 1 of each document remains unmapped and surfaces as deleted/added.
      expect(diffResults.filter((r) => r.kind === 'changed')).toHaveLength(0);
    });

    it('handles pages containing only whitespace', () => {
      const { summary } = buildTextComparison(
        ['   '],
        [''],
        [{ originalPage: 1, modifiedPage: 1 }],
        { normalization: { ...defaultNormalization, ignoreWhitespace: true }, includeUnmappedPages: false }
      );

      expect(summary.unchangedPairs).toBe(1);
    });
  });
});

// ─── buildTextComparisonAsync ─────────────────────────────────────────────────

describe('buildTextComparisonAsync', () => {
  const mapping: PageMapping = [
    { originalPage: 1, modifiedPage: 1 },
    { originalPage: 2, modifiedPage: 2 },
    { originalPage: 3, modifiedPage: 0 },
  ];

  it('produces the same summary and diff structure as the sync version', async () => {
    const original = ['hello world', 'contract clause A', 'deleted only here'];
    const modified = ['hello there', 'contract clause A'];
    const sync = buildTextComparison(original, modified, mapping, defaultOptions);
    const async_ = await buildTextComparisonAsync(original, modified, mapping, defaultOptions);

    expect(async_.summary).toEqual(sync.summary);
    expect(async_.diffResults.length).toBe(sync.diffResults.length);
    expect(async_.diffResults.map((r) => r.kind)).toEqual(sync.diffResults.map((r) => r.kind));
  });

  it('reports progress as pages are processed', async () => {
    const calls: Array<{ current: number; total: number }> = [];
    await buildTextComparisonAsync(
      ['a', 'b', 'c'],
      ['a', 'b', 'c'],
      [
        { originalPage: 1, modifiedPage: 1 },
        { originalPage: 2, modifiedPage: 2 },
        { originalPage: 3, modifiedPage: 3 },
      ],
      defaultOptions,
      (p) => calls.push({ current: p.current, total: p.total })
    );
    expect(calls).toHaveLength(3);
    expect(calls[calls.length - 1]).toEqual({ current: 3, total: 3 });
  });
});

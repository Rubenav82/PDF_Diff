# @pdf-diff/core

Portable SDK for PDF comparison — text diff + visual pixel diff. Works in Node.js and browser (via a `CanvasProvider` adapter).

Used internally by `@pdf-diff/cli`. Import it directly for snapshot testing or custom integrations.

## Install

```bash
npm install @pdf-diff/core
```

> **Note**: `@pdf-diff/core` does not include a canvas implementation. You must provide one via `CanvasProvider`:
> - **Node.js**: use `@napi-rs/canvas` (see example below)
> - **Browser**: use `document.createElement('canvas')`

## Quick start (Node.js)

```ts
import { readFile } from 'node:fs/promises';
import {
  extractTextFromBuffer,
  buildTextComparison,
  buildVisualDiffEntries,
  suggestPageMapping,
} from '@pdf-diff/core';
import { createCanvas } from '@napi-rs/canvas';
import type { CanvasProvider, CanvasLike } from '@pdf-diff/core';

const nodeCanvasProvider: CanvasProvider = {
  createCanvas: (w, h) => createCanvas(w, h) as unknown as CanvasLike,
};

const origBuf = new Uint8Array(await readFile('a.pdf'));
const modBuf  = new Uint8Array(await readFile('b.pdf'));

// Auto-detect page mapping
const origTexts = await extractTextFromBuffer(origBuf);
const modTexts  = await extractTextFromBuffer(modBuf);
const mapping   = suggestPageMapping(origTexts, modTexts);

// Text diff
const { diffResults } = buildTextComparison(origTexts, modTexts, mapping, {
  normalization: { ignoreCase: false, ignoreWhitespace: false, ignoreLineBreaks: false },
  includeUnmappedPages: false,
});

// Visual diff
const visualEntries = await buildVisualDiffEntries(origBuf, modBuf, mapping, nodeCanvasProvider);

console.log('Text changes:', diffResults.length);
console.log('Visual diff %:', visualEntries[0]?.diffRatio);
```

## Vitest / Jest snapshot testing

```ts
import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { extractTextFromBuffer, buildTextComparison, suggestPageMapping } from '@pdf-diff/core';

describe('invoice PDF', () => {
  it('matches baseline', async () => {
    const baseline = new Uint8Array(await readFile('fixtures/baseline.pdf'));
    const actual   = new Uint8Array(await readFile('dist/invoice.pdf'));

    const [baseTexts, actualTexts] = await Promise.all([
      extractTextFromBuffer(baseline),
      extractTextFromBuffer(actual),
    ]);
    const mapping = suggestPageMapping(baseTexts, actualTexts);
    const { diffResults } = buildTextComparison(baseTexts, actualTexts, mapping, {
      normalization: { ignoreCase: false, ignoreWhitespace: false, ignoreLineBreaks: false },
      includeUnmappedPages: false,
    });

    const totalChanges = diffResults.reduce((sum, r) =>
      sum + r.diff.filter(p => p.added || p.removed).reduce((s, p) => s + p.value.length, 0), 0
    );
    expect(totalChanges).toBe(0);
  });
});
```

## API

### PDF loading

```ts
getPdfPageCountFromBuffer(buffer: Uint8Array): Promise<number>
extractTextFromBuffer(buffer: Uint8Array): Promise<string[]>  // one string per page
```

### Page mapping

```ts
// Returns PageMapping[] ordered by similarity score
suggestPageMapping(origTexts: string[], modTexts: string[]): PageMapping[]

// PageMapping = { originalPage: number, modifiedPage: number }
// 0 means "no corresponding page" (deleted/added)
```

### Text comparison

```ts
buildTextComparison(
  origTexts: string[],
  modTexts: string[],
  mapping: PageMapping[],
  options: TextComparisonOptions
): { diffResults: TextDiffResult[] }

// TextDiffResult = { page, modifiedPage, diff: DiffPart[] }
// DiffPart = { value: string, added?: boolean, removed?: boolean }
```

### Visual diff

```ts
buildVisualDiffEntries(
  origBuf: Uint8Array,
  modBuf: Uint8Array,
  mapping: PageMapping[],
  provider: CanvasProvider
): Promise<VisualDiffReportEntry[]>

// VisualDiffReportEntry = { originalPage, modifiedPage, diffPixels, totalPixels, diffRatio, thumbnailDataUrl? }
```

### Canvas abstraction

```ts
interface CanvasProvider {
  createCanvas(width: number, height: number): CanvasLike;
}

interface CanvasLike {
  width: number;
  height: number;
  getContext(type: '2d'): unknown;
  toDataURL?(type?: string): string;   // browser
  toBuffer?(): Uint8Array;             // Node
}
```

## Requirements

- Node.js ≥ 18 or modern browser
- `pdfjs-dist` ≥ 4.x (peer dependency, bundled)

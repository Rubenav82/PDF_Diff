# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install        # Install dependencies
npm run dev        # Start Vite dev server
npm run build      # Production build (ES2022 target)
npm run preview    # Preview production build
npm run test       # Run tests in watch mode
npm run test:run   # Run tests once
```

Tests live alongside source files as `*.test.ts` and use Vitest.

## Architecture

**PDF_Diff** is a client-side-only React SPA that compares two PDF documents via text diff and pixel-level visual diff. All processing happens in the browser — no backend.

### Data flow

1. User uploads two PDFs → hash (SHA-512) + page count extracted
2. User configures page mapping (flexible: 1:1, deleted, added pages)
3. User selects normalization options (case, whitespace, line breaks)
4. Comparison runs two parallel paths:
   - **Text**: `pdfService` extracts text → `textDiffService` normalizes + diffs chars (`diff` library)
   - **Visual**: `pdfService` renders pages to canvas → `visualReportService` pixel-diffs (`pixelmatch`)
5. Results displayed in `ComparisonView` (tab between Text / Visual)
6. Optional HTML report download via `reportService`

### Key modules

| File | Responsibility |
|------|---------------|
| [src/App.tsx](src/App.tsx) | Root orchestrator — all state lives here |
| [src/lib/pdfService.ts](src/lib/pdfService.ts) | Hash, page count, text extraction, canvas rendering (uses pdfjs-dist) |
| [src/lib/textDiffService.ts](src/lib/textDiffService.ts) | Normalization pipeline + `diffChars()` comparison |
| [src/lib/visualReportService.ts](src/lib/visualReportService.ts) | Renders page pairs to canvas, runs pixelmatch, produces thumbnails |
| [src/lib/reportService.ts](src/lib/reportService.ts) | Generates and downloads a self-contained HTML report |
| [src/types/types.ts](src/types/types.ts) | All shared TypeScript interfaces (`TextDiffResult`, `ComparisonSummary`, `VisualDiffReportEntry`, `PageMapping`) |

### Component hierarchy

```
App.tsx
├── FileUploader (×2 — original & modified)
├── PageMapper          ← page mapping configuration
├── ComparisonSummary   ← stats after comparison
└── ComparisonView      ← tab switcher
    ├── TextDiffView    ← char-level diff with highlighting
    └── VisualDiffView  ← interactive canvas diff viewer
```

### State management

`App.tsx` owns all state: uploaded files, hashes, page counts, page mapping, normalization flags, comparison results (`textDiff`, `visualDiff`, `comparisonSummary`), view mode, and export state. No external state library is used.

### Notable implementation details

- **Render cancellation**: `renderPageToCanvas` supports cancellation tokens so switching pages in `VisualDiffView` aborts in-flight renders.
- **Page mapping flexibility**: `PageMapping` is `Array<{ originalPage, modifiedPage }>` — pages can be deleted (no modifiedPage), added (no originalPage), or many-to-one.
- **Report context clipping**: `reportService` truncates unchanged context around diffs to 70 chars for readability.
- **PDF.js worker**: `pdfjs-dist` requires the worker to be loaded separately; check `pdfService.ts` for how it's configured with Vite.

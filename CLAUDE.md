# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Root (SPA)
npm install        # Install all workspaces
npm run dev        # Start Vite dev server
npm run build      # Production build (ES2022 target)
npm run preview    # Preview production build
npm run test       # Run SPA tests in watch mode
npm run test:run   # Run SPA tests once

# packages/core
npm run build -w @pdf-diff/core   # Compile core library

# packages/cli
npm run build -w @pdf-diff/cli    # Compile CLI
npm run test -w @pdf-diff/cli     # Run CLI E2E tests (Vitest, ~60 s timeout)
node packages/cli/dist/bin.js compare a.pdf b.pdf --output json
```

Tests live alongside source files as `*.test.ts` and use Vitest.

## Repository structure

This is an **npm workspaces monorepo** with three independent units:

| Path | Package | Purpose |
|------|---------|---------|
| `src/` | *(root SPA)* | React browser app — no backend |
| `packages/core/` | `@pdf-diff/core` | Framework-agnostic comparison engine |
| `packages/cli/` | `@pdf-diff/cli` | Node.js CLI (`pdf-diff compare`) |

The SPA depends on the browser APIs directly; `packages/core` is a pure-TS library used by the CLI (and could be used by other Node tools). The CLI depends on `@pdf-diff/core` plus `@napi-rs/canvas` as a Node `CanvasProvider`.

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

## packages/core

Pure-TypeScript library (`@pdf-diff/core`) with no browser or Node dependencies. Exports:

| Export | Description |
|--------|-------------|
| `getPdfPageCountFromBuffer` | Page count from a `Uint8Array` |
| `extractTextFromBuffer` | Text extraction per page |
| `suggestPageMapping` | Auto page-mapping heuristic |
| `buildTextComparison` | Normalization + char diff |
| `buildVisualDiffEntries` | Pixel diff via `CanvasProvider` |
| `CanvasProvider` / `CanvasLike` | Interface to inject canvas implementation |

Built with `tsc -p tsconfig.build.json` → `dist/`.

## packages/cli

Node.js CLI (`@pdf-diff/cli`, binary `pdf-diff`) wrapping `@pdf-diff/core`.

Key files:

| File | Responsibility |
|------|---------------|
| [packages/cli/src/bin.ts](packages/cli/src/bin.ts) | Entry point — Commander setup |
| [packages/cli/src/commands/compare.ts](packages/cli/src/commands/compare.ts) | `compare` subcommand logic + exit codes |
| [packages/cli/src/pdfjsNodeSetup.ts](packages/cli/src/pdfjsNodeSetup.ts) | Worker path config + redirect pdfjs `console.log` warnings to stderr |
| [packages/cli/src/nodeCanvasProvider.ts](packages/cli/src/nodeCanvasProvider.ts) | `@napi-rs/canvas` adapter implementing `CanvasProvider` |
| [packages/cli/src/output.ts](packages/cli/src/output.ts) | JSON / text formatters |
| [packages/cli/src/__tests__/compare.test.ts](packages/cli/src/__tests__/compare.test.ts) | 21 E2E tests via `child_process.execFile` |

**Exit codes**: `0` = no diffs or diffs within explicit threshold; `1` = diffs without threshold, or threshold exceeded; `2` = error.

**pdfjs stdout contamination**: pdfjs writes diagnostic warnings via `console.log`. `pdfjsNodeSetup.ts` intercepts calls starting with `"Warning:"` and redirects them to `process.stderr` to keep stdout clean for JSON piping.

## CI/CD

| Workflow | Trigger | What it does |
|----------|---------|--------------|
| `.github/workflows/cli-tests.yml` | push/PR touching `packages/**` | Matrix (ubuntu + windows), builds core + CLI, runs 21 E2E tests |
| `.github/workflows/release.yml` | push tag `v*.*.*` | Builds both packages, runs tests, publishes to npm with provenance |

To release: create `NPM_TOKEN` secret in repo settings, then push a tag (`git tag v0.1.0 && git push --tags`).

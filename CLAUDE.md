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
| [src/version.ts](src/version.ts) | `APP_VERSION` constant — **must be bumped (semver) in every PR that changes the SPA**; merging to `main` auto-publishes the release (see *SPA versioning & release*) |

### Component hierarchy

```
App.tsx
├── [header]
│   ├── LanguageSelector    ← ES/EN switcher
│   ├── HelpMenu            ← ? button: version, report issue (mailto), privacy policy modal
│   └── theme toggle
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

## Known gotchas

### `@napi-rs/canvas` — `drawImage` canvas-to-canvas copy

In Node (`@napi-rs/canvas`), calling `ctx.drawImage(otherCanvas, 0, 0)` to copy pixel data between canvases does **not** reliably transfer all pixel data — text rendered with embedded PDF fonts may be lost, making both canvases appear identical and producing 0 pixel differences.

**Fix**: when both rendered pages have the same dimensions, call `getImageData()` directly on the rendered canvas without an intermediate copy. See `packages/core/src/visualDiff.ts` — the same-dimensions fast path.

### pdfjs embedded font rendering in Node vs browser

In the browser, pdfjs registers embedded PDF fonts via the `FontFace` CSS API → text renders with the exact PDF font. In Node, this API is absent → pdfjs falls back to standard/substitute fonts. Pages that differ only in small text (e.g., footer timestamps) may render identically in Node, causing the CLI to report 0 visual differences where the browser finds ~118 px.

Mitigation in place: reading pixel data directly from rendered canvases avoids the copy artefact. If font substitution still masks differences, consider increasing `scale` (currently `1.5`) or configuring `cMapUrl` / `cMapPacked` in `pdfEngine.ts`.

### Release order matters

Always publish `@pdf-diff/core` **before** `@pdf-diff/cli`. The CLI depends on core; publishing in reverse order causes npm to resolve the old core version. The automated release workflow handles this correctly when tags are pushed.

## CI/CD

| Workflow | Trigger | What it does |
|----------|---------|--------------|
| `.github/workflows/cli-tests.yml` | push/PR touching `packages/**` | Matrix (ubuntu + windows), builds core + CLI, runs 21 E2E tests |
| `.github/workflows/release.yml` | push tag `v*.*.*` | Builds both packages, runs tests, publishes to npm with provenance |
| `.github/workflows/html-release.yml` | push to `main` (or manual tag `web*`) | If no `web<APP_VERSION>` tag exists yet, builds the SPA, creates the tag and publishes a GitHub Release with `dist/` zips |

### SPA versioning & release

The SPA release is fully automated: on every push/merge to `main`, `html-release.yml` reads `APP_VERSION` from `src/version.ts` and, if the tag `web<APP_VERSION>` does not exist yet, it creates the tag and publishes the GitHub Release (zips of `dist/`). If the version was not bumped, the job exits without publishing — so **the version bump is the release trigger**.

Therefore, **every PR that changes the SPA must bump `APP_VERSION`** following semver:

- **Patch** (`2.0.0` → `2.0.1`): bug fixes, build/config tweaks, no behavior change visible to the user
- **Minor** (`2.0.0` → `2.1.0`): new features, backwards-compatible (new options, new views, new report content)
- **Major** (`2.0.0` → `3.0.0`): breaking or disruptive changes (redesigned flow, removed features, changed report format)

Changes that don't touch the SPA (docs, `packages/**`, workflows) must **not** bump `APP_VERSION` — no release will be produced for them.

### Publishing to npm (via GitHub Actions)

**Setup:** Ensure `NPM_TOKEN` secret exists in repo settings (Settings → Secrets and variables → Actions).

**Release process:**

1. **Update versions** in both `packages/core/package.json` and `packages/cli/package.json` to the same version (e.g., `0.2.0`)
2. **Update CLI dependency** in `packages/cli/package.json` to match the new core version
3. **Commit** these version bumps (e.g., `git commit -am "chore: release v0.2.0"`)
4. **Create tag** and push to GitHub:
   ```bash
   git tag v0.2.0
   git push origin v0.2.0
   ```
5. **GitHub Actions** automatically:
   - Builds both packages (`tsc`)
   - Runs 21 E2E CLI tests
   - Publishes `@pdf-diff/core` to npm
   - Publishes `@pdf-diff/cli` to npm (with core dependency resolved)
   - Creates release notes

Monitor progress at: https://github.com/Rubenav82/PDF_Diff/actions

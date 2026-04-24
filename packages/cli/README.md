# @pdf-diff/cli

CLI for comparing PDF documents — text + visual diff for CI/CD pipelines.

## Install

```bash
npm install -g @pdf-diff/cli
# or use without installing:
npx @pdf-diff/cli compare a.pdf b.pdf
```

## Usage

```bash
pdf-diff compare <original> <modified> [options]
```

### Basic examples

```bash
# Exit 0 if identical, 1 if differences found, 2 on error
pdf-diff compare baseline.pdf actual.pdf

# JSON output for pipes and scripts
pdf-diff compare a.pdf b.pdf --output json

# Write report to file
pdf-diff compare a.pdf b.pdf --output json --out report.json

# HTML report
pdf-diff compare a.pdf b.pdf --output html --out report.html
```

### CI/CD with thresholds

```bash
# Pass if visual diff ≤ 0.5% and text changes ≤ 10 chars
pdf-diff compare baseline.pdf actual.pdf \
  --max-visual-diff 0.005 \
  --max-text-changes 10

# Text-only mode (fast, no canvas required)
pdf-diff compare a.pdf b.pdf --mode text-only --max-text-changes 0
```

**Threshold guidance:**
- **Legal/contract documents** (crisp text, no images): `--max-visual-diff 0.001` (0.1%) — very strict
- **Invoices** (tables, small numbers): `--max-visual-diff 0.005` (0.5%) — typical
- **Design proofs** (gradients, colors): `--max-visual-diff 0.02` (2%) — lenient
- **No visual diff expected**: `--max-visual-diff 0` — fail if ANY pixels differ

### Page mapping

```bash
# Auto-detect page mapping (handles reordered/inserted pages)
pdf-diff compare a.pdf b.pdf --auto-map

# Manual mapping: page 1→1, page 2→2, page 3 deleted, page 4 added in modified
pdf-diff compare a.pdf b.pdf --map "1:1,2:2,3:null,null:4"
```

### Normalization

```bash
pdf-diff compare a.pdf b.pdf --ignore-case --ignore-whitespace
```

## Options

| Flag | Description | Default |
|------|-------------|---------|
| `--output <format>` | `json` \| `html` \| `text` | `text` |
| `--out <file>` | Write output to file | stdout |
| `--mode <mode>` | `text+visual` \| `text-only` \| `visual-only` | `text+visual` |
| `--auto-map` | Auto-detect page mapping by text similarity | false |
| `--map <spec>` | Manual mapping, e.g. `"1:1,2:null,null:3"` | — |
| `--max-visual-diff <ratio>` | Max visual diff ratio 0–1 (e.g. `0.005` = 0.5%) | — |
| `--max-text-changes <n>` | Max total text char changes | — |
| `--ignore-case` | Case-insensitive text comparison | false |
| `--ignore-whitespace` | Ignore whitespace in text comparison | false |

## Exit codes

| Code | Meaning |
|------|---------|
| `0` | No differences, or all differences within specified thresholds |
| `1` | Differences detected, or a threshold was exceeded |
| `2` | Error (file not found, invalid PDF, etc.) |

## JSON output schema

```json
{
  "version": "1.0",
  "original": { "path": "a.pdf", "hash": "sha512:...", "pages": 3 },
  "modified": { "path": "b.pdf", "hash": "sha512:...", "pages": 3 },
  "mapping": [[1, 1], [2, 2], [3, null]],
  "summary": {
    "text": { "added": 12, "removed": 8, "unchanged": 450 },
    "visual": { "diffPixels": 1240, "diffPercentage": 0.002 },
    "thresholds": { "textChangesLimit": 10, "visualLimit": 0.005, "passed": false }
  },
  "pages": [
    {
      "original": 1,
      "modified": 1,
      "textChanges": { "added": 4, "removed": 2, "unchanged": 150 },
      "visual": { "diffPixels": 620, "totalPixels": 700000, "diffPercentage": 0.001 }
    }
  ]
}
```

## GitHub Actions example

```yaml
- name: Build PDF
  run: node scripts/build-invoice.js

- name: Validate against baseline
  run: |
    npx @pdf-diff/cli compare fixtures/baseline.pdf dist/invoice.pdf \
      --mode text-only \
      --max-text-changes 0 \
      --output json \
      --out diff-report.json

- name: Upload diff report
  if: failure()
  uses: actions/upload-artifact@v4
  with:
    name: pdf-diff-report
    path: diff-report.json
```

## Troubleshooting

### "Visual diff shows 0 differences but the web app shows differences"

**Root cause:** `@napi-rs/canvas` (Node.js software rendering) cannot render embedded PDF fonts the same way browsers do. Pages that differ only in small text may appear identical in Node despite being rendered at 2.0× scale.

**Solutions:**
1. Use the **web app** (browser-based) for final human review of documents with small text changes
2. Focus on **text diff** (`--mode text-only`) which is platform-agnostic and always detects text changes
3. Check that both PDFs actually differ — run text diff first to confirm

### PDF fails to render

- Ensure the PDF is not corrupted: `pdfjs` with `verbosity: 0` (default) will silently fail on malformed streams
- Try the same PDF in the web app; if it fails there too, the PDF itself is the issue

## Requirements

- Node.js ≥ 18
- Prebuilt native binaries included for Linux x64/arm64, macOS x64/arm64, Windows x64

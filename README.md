
# PDF Diff 

A client-side React app (+ CLI and core library) for comparing two PDF documents via text diff and pixel-level visual diff. All browser processing happens locally — no backend.

## Packages

| Package | Description |
|---------|-------------|
| *(root SPA)* | React browser app |
| [`@pdf-diff/core`](packages/core) | Framework-agnostic comparison engine |
| [`@pdf-diff/cli`](packages/cli) | Node.js CLI (`pdf-diff compare`) |

## Getting started

**Prerequisites:** Node.js

```bash
npm install     # Install all workspaces
npm run dev     # Start dev server
npm run build   # Production build
```

## CLI

```bash
npm install -g @pdf-diff/cli
pdf-diff compare a.pdf b.pdf --output json
```

## License

[MIT](LICENSE) © 2025 Rubén Asenjo Vega

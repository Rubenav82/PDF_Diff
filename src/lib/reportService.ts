import type {
  ComparisonSummary,
  PageMapping,
  TextComparisonOptions,
  TextDiffResult,
  VisualDiffReportEntry,
} from '../types/types';

interface ReportData {
  createdAt: string;
  originalFileName: string;
  modifiedFileName: string;
  hashes: { original: string | null; modified: string | null };
  pageCounts: { original: number; modified: number } | null;
  mapping: PageMapping;
  options: TextComparisonOptions;
  summary: ComparisonSummary | null;
  textDiff: TextDiffResult[] | null;
  visualDiffEntries: VisualDiffReportEntry[];
}

const escapeHtml = (value: string): string => {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const clipText = (value: string, maxLength: number): string => {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}...`;
};

const normalizeInline = (value: string): string => value.replace(/\s+/g, ' ').trim();

const leadingContext = (value: string, maxLength: number): string => {
  const normalized = normalizeInline(value);
  if (!normalized) return '';
  if (normalized.length <= maxLength) return normalized;
  return `...${normalized.slice(normalized.length - maxLength)}`;
};

const trailingContext = (value: string, maxLength: number): string => {
  const normalized = normalizeInline(value);
  if (!normalized) return '';
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength)}...`;
};

const formatDiffHtml = (diff: TextDiffResult['diff']): string => {
  const maxChangeBlocks = 12;
  const initialVisibleBlocks = 3;
  const contextChars = 70;
  const changeChars = 180;
  const blocks: string[] = [];

  for (let i = 0; i < diff.length; i++) {
    const part = diff[i];
    if (!part.added && !part.removed) continue;
    if (blocks.length >= maxChangeBlocks) break;

    const previous = i > 0 ? diff[i - 1] : undefined;
    const next = i < diff.length - 1 ? diff[i + 1] : undefined;

    const before = previous && !previous.added && !previous.removed
      ? leadingContext(previous.value, contextChars)
      : '';
    const after = next && !next.added && !next.removed
      ? trailingContext(next.value, contextChars)
      : '';

    const change = clipText(normalizeInline(part.value), changeChars);
    if (!change) continue;

    const highlighted = part.added
      ? `<span class="diff-added">${escapeHtml(change)}</span>`
      : `<span class="diff-removed">${escapeHtml(change)}</span>`;

    const beforeHtml = before ? `<span class="diff-same">${escapeHtml(before)}</span>` : '';
    const afterHtml = after ? `<span class="diff-same">${escapeHtml(after)}</span>` : '';

    blocks.push(`<div class="diff-block">${beforeHtml}${beforeHtml ? '<span class="diff-sep"> </span>' : ''}${highlighted}${afterHtml ? '<span class="diff-sep"> </span>' : ''}${afterHtml}</div>`);
  }

  if (blocks.length === 0) {
    return '<span class="muted">(sin contenido textual)</span>';
  }

  if (blocks.length <= initialVisibleBlocks) {
    return blocks.join('');
  }

  const visible = blocks.slice(0, initialVisibleBlocks).join('');
  const hidden = blocks.slice(initialVisibleBlocks).join('');
  return `${visible}<details class="diff-more"><summary>Ver más cambios (${blocks.length - initialVisibleBlocks})</summary>${hidden}</details>`;
};

export function downloadComparisonReport(data: ReportData): void {
  const summary = data.summary;
  const textDiffRows = (data.textDiff ?? [])
    .map((entry) => {
      const typeLabel = entry.kind === 'added'
        ? 'Anadida'
        : entry.kind === 'deleted'
        ? 'Eliminada'
        : 'Cambiada';
      const originalLabel = entry.page > 0 ? String(entry.page) : '-';
      const modifiedLabel = entry.modifiedPage && entry.modifiedPage > 0 ? String(entry.modifiedPage) : '-';
      const snippet = formatDiffHtml(entry.diff);

      return `
        <tr>
          <td>${typeLabel}</td>
          <td>${originalLabel}</td>
          <td>${modifiedLabel}</td>
          <td>${snippet}</td>
        </tr>
      `;
    })
    .join('');

  const mappingRows = data.mapping
    .map((entry) => `<tr><td>${entry.originalPage}</td><td>${entry.modifiedPage}</td></tr>`)
    .join('');

  const visualRows = data.visualDiffEntries
    .map((entry) => {
      const diffPercent = (entry.diffRatio * 100).toFixed(3);
      return `
        <tr>
          <td>${entry.originalPage}</td>
          <td>${entry.modifiedPage}</td>
          <td>${entry.diffPixels.toLocaleString('es-ES')}</td>
          <td>${diffPercent}%</td>
          <td>${entry.thumbnailDataUrl ? `<img class="thumb" src="${entry.thumbnailDataUrl}" alt="Diff visual p${entry.originalPage}-${entry.modifiedPage}" />` : '<span class="muted">Sin miniatura</span>'}</td>
        </tr>
      `;
    })
    .join('');

  const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Informe PDF Diff</title>
  <style>
    body { font-family: Segoe UI, Arial, sans-serif; color: #1f2937; margin: 24px; }
    h1, h2 { margin: 0 0 10px 0; }
    .muted { color: #6b7280; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 16px; margin: 10px 0 20px 0; }
    .card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { border: 1px solid #e5e7eb; padding: 8px; font-size: 13px; vertical-align: top; text-align: left; }
    th { background: #f3f4f6; }
    .hash { font-family: Consolas, Monaco, monospace; font-size: 12px; word-break: break-all; overflow-wrap: anywhere; }
    .diff-added { background: #dcfce7; color: #166534; padding: 0 2px; border-radius: 3px; }
    .diff-removed { background: #fee2e2; color: #991b1b; text-decoration: line-through; padding: 0 2px; border-radius: 3px; }
    .diff-same { color: #374151; }
    .diff-sep { color: #9ca3af; }
    .diff-block { margin-bottom: 6px; line-height: 1.5; }
    .diff-more { margin-top: 8px; }
    .diff-more summary { cursor: pointer; color: #4338ca; font-weight: 600; }
    .diff-more[open] summary { margin-bottom: 8px; }
    .thumb { max-width: 220px; height: auto; border: 1px solid #d1d5db; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>Informe de comparacion PDF</h1>
  <p class="muted">Generado: ${escapeHtml(data.createdAt)}</p>

  <div class="card">
    <h2>Documentos</h2>
    <div class="grid">
      <div><strong>Original:</strong> ${escapeHtml(data.originalFileName)}</div>
      <div><strong>Modificado:</strong> ${escapeHtml(data.modifiedFileName)}</div>
      <div><strong>Hash original:</strong> <span class="hash">${escapeHtml(data.hashes.original ?? '-')}</span></div>
      <div><strong>Hash modificado:</strong> <span class="hash">${escapeHtml(data.hashes.modified ?? '-')}</span></div>
      <div><strong>Paginas original:</strong> ${data.pageCounts?.original ?? '-'}</div>
      <div><strong>Paginas modificado:</strong> ${data.pageCounts?.modified ?? '-'}</div>
    </div>
  </div>

  <div class="card">
    <h2>Opciones de comparacion</h2>
    <div class="grid">
      <div><strong>Incluir no mapeadas:</strong> ${data.options.includeUnmappedPages ? 'Si' : 'No'}</div>
      <div><strong>Ignorar mayusculas/minusculas:</strong> ${data.options.normalization.ignoreCase ? 'Si' : 'No'}</div>
      <div><strong>Normalizar espacios:</strong> ${data.options.normalization.ignoreWhitespace ? 'Si' : 'No'}</div>
      <div><strong>Ignorar saltos de linea:</strong> ${data.options.normalization.ignoreLineBreaks ? 'Si' : 'No'}</div>
    </div>
  </div>

  <div class="card">
    <h2>Resumen ejecutivo</h2>
    <div class="grid">
      <div><strong>Pares mapeados:</strong> ${summary?.mappedPairs ?? 0}</div>
      <div><strong>Pares con cambios:</strong> ${summary?.changedPairs ?? 0}</div>
      <div><strong>Pares sin cambios:</strong> ${summary?.unchangedPairs ?? 0}</div>
      <div><strong>Paginas eliminadas:</strong> ${summary?.deletedPages ?? 0}</div>
      <div><strong>Paginas anadidas:</strong> ${summary?.addedPages ?? 0}</div>
      <div><strong>Total diferencias textuales:</strong> ${(data.textDiff ?? []).length}</div>
    </div>
  </div>

  <div class="card">
    <h2>Mapeo aplicado</h2>
    <table>
      <thead>
        <tr><th>Pagina original</th><th>Pagina modificada</th></tr>
      </thead>
      <tbody>
        ${mappingRows}
      </tbody>
    </table>
  </div>

  <div class="card">
    <h2>Diferencias textuales</h2>
    <table>
      <thead>
        <tr><th>Tipo</th><th>Pag. original</th><th>Pag. modificada</th><th>Cambios detectados (con contexto)</th></tr>
      </thead>
      <tbody>
        ${textDiffRows || '<tr><td colspan="4">Sin diferencias</td></tr>'}
      </tbody>
    </table>
  </div>

  <div class="card">
    <h2>Diferencias visuales</h2>
    <table>
      <thead>
        <tr><th>Pag. original</th><th>Pag. modificada</th><th>Pixeles distintos</th><th>% diferencia</th><th>Miniatura diff</th></tr>
      </thead>
      <tbody>
        ${visualRows || '<tr><td colspan="5">Sin datos visuales</td></tr>'}
      </tbody>
    </table>
  </div>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const fileName = `informe-pdf-diff-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.html`;

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

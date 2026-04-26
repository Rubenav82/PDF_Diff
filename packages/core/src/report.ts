import type {
  ComparisonSummary,
  PageMapping,
  TextComparisonOptions,
  TextDiffResult,
  VisualDiffReportEntry,
} from './types.js';
import type { Locale, MessageKey } from './i18n.js';
import { translate } from './i18n.js';

export interface ReportData {
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
  locale?: Locale;
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

const formatDiffHtml = (
  diff: TextDiffResult['diff'],
  t: (key: MessageKey, params?: Record<string, string | number>) => string
): string => {
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
    const beforeSep = beforeHtml ? '<span class="diff-sep"> </span>' : '';
    const afterSep = afterHtml ? '<span class="diff-sep"> </span>' : '';

    blocks.push(`<div class="diff-block">${beforeHtml}${beforeSep}${highlighted}${afterSep}${afterHtml}</div>`);
  }

  if (blocks.length === 0) {
    return `<span class="muted">${escapeHtml(t('report.emptyContent'))}</span>`;
  }

  if (blocks.length <= initialVisibleBlocks) {
    return blocks.join('');
  }

  const visible = blocks.slice(0, initialVisibleBlocks).join('');
  const hidden = blocks.slice(initialVisibleBlocks).join('');
  return `${visible}<details class="diff-more"><summary>${escapeHtml(t('report.moreChanges', { n: blocks.length - initialVisibleBlocks }))}</summary>${hidden}</details>`;
};

export function generateReportHtml(data: ReportData): string {
  const locale: Locale = data.locale ?? 'es';
  const t = (key: MessageKey, params?: Record<string, string | number>) => translate(locale, key, params);
  const numberLocaleTag = locale === 'en' ? 'en-US' : 'es-ES';

  const summary = data.summary;
  const textDiffRows = (data.textDiff ?? [])
    .map((entry) => {
      const typeLabel = entry.kind === 'added'
        ? t('report.kind.added')
        : entry.kind === 'deleted'
        ? t('report.kind.deleted')
        : t('report.kind.changed');
      const originalLabel = entry.page > 0 ? String(entry.page) : '-';
      const modifiedLabel = entry.modifiedPage && entry.modifiedPage > 0 ? String(entry.modifiedPage) : '-';
      const snippet = formatDiffHtml(entry.diff, t);

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
          <td>${entry.diffPixels.toLocaleString(numberLocaleTag)}</td>
          <td>${diffPercent}%</td>
          <td>${entry.thumbnailDataUrl ? `<img class="thumb" src="${entry.thumbnailDataUrl}" alt="Diff p${entry.originalPage}-${entry.modifiedPage}" />` : `<span class="muted">${escapeHtml(t('report.visual.noThumb'))}</span>`}</td>
        </tr>
      `;
    })
    .join('');

  const yesLabel = t('report.yes');
  const noLabel = t('report.no');

  return `<!doctype html>
<html lang="${locale}">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(t('report.title'))}</title>
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
  <h1>${escapeHtml(t('report.heading'))}</h1>
  <p class="muted">${escapeHtml(t('report.generated', { date: data.createdAt }))}</p>

  <div class="card">
    <h2>${escapeHtml(t('report.docs.title'))}</h2>
    <div class="grid">
      <div><strong>${escapeHtml(t('report.docs.original'))}</strong> ${escapeHtml(data.originalFileName)}</div>
      <div><strong>${escapeHtml(t('report.docs.modified'))}</strong> ${escapeHtml(data.modifiedFileName)}</div>
      <div><strong>${escapeHtml(t('report.docs.originalHash'))}</strong> <span class="hash">${escapeHtml(data.hashes.original ?? '-')}</span></div>
      <div><strong>${escapeHtml(t('report.docs.modifiedHash'))}</strong> <span class="hash">${escapeHtml(data.hashes.modified ?? '-')}</span></div>
      <div><strong>${escapeHtml(t('report.docs.pagesOriginal'))}</strong> ${data.pageCounts?.original ?? '-'}</div>
      <div><strong>${escapeHtml(t('report.docs.pagesModified'))}</strong> ${data.pageCounts?.modified ?? '-'}</div>
    </div>
  </div>

  <div class="card">
    <h2>${escapeHtml(t('report.opts.title'))}</h2>
    <div class="grid">
      <div><strong>${escapeHtml(t('report.opts.includeUnmapped'))}</strong> ${data.options.includeUnmappedPages ? yesLabel : noLabel}</div>
      <div><strong>${escapeHtml(t('report.opts.ignoreCase'))}</strong> ${data.options.normalization.ignoreCase ? yesLabel : noLabel}</div>
      <div><strong>${escapeHtml(t('report.opts.ignoreWhitespace'))}</strong> ${data.options.normalization.ignoreWhitespace ? yesLabel : noLabel}</div>
      <div><strong>${escapeHtml(t('report.opts.ignoreLineBreaks'))}</strong> ${data.options.normalization.ignoreLineBreaks ? yesLabel : noLabel}</div>
    </div>
  </div>

  <div class="card">
    <h2>${escapeHtml(t('report.summary.title'))}</h2>
    <div class="grid">
      <div><strong>${escapeHtml(t('report.summary.mapped'))}</strong> ${summary?.mappedPairs ?? 0}</div>
      <div><strong>${escapeHtml(t('report.summary.changed'))}</strong> ${summary?.changedPairs ?? 0}</div>
      <div><strong>${escapeHtml(t('report.summary.unchanged'))}</strong> ${summary?.unchangedPairs ?? 0}</div>
      <div><strong>${escapeHtml(t('report.summary.deleted'))}</strong> ${summary?.deletedPages ?? 0}</div>
      <div><strong>${escapeHtml(t('report.summary.added'))}</strong> ${summary?.addedPages ?? 0}</div>
      <div><strong>${escapeHtml(t('report.summary.textDiffs'))}</strong> ${(data.textDiff ?? []).length}</div>
    </div>
  </div>

  <div class="card">
    <h2>${escapeHtml(t('report.mapping.title'))}</h2>
    <table>
      <thead>
        <tr><th>${escapeHtml(t('report.mapping.orig'))}</th><th>${escapeHtml(t('report.mapping.mod'))}</th></tr>
      </thead>
      <tbody>
        ${mappingRows}
      </tbody>
    </table>
  </div>

  <div class="card">
    <h2>${escapeHtml(t('report.text.title'))}</h2>
    <table>
      <thead>
        <tr><th>${escapeHtml(t('report.text.type'))}</th><th>${escapeHtml(t('report.text.pOrig'))}</th><th>${escapeHtml(t('report.text.pMod'))}</th><th>${escapeHtml(t('report.text.changes'))}</th></tr>
      </thead>
      <tbody>
        ${textDiffRows || `<tr><td colspan="4">${escapeHtml(t('report.text.none'))}</td></tr>`}
      </tbody>
    </table>
  </div>

  <div class="card">
    <h2>${escapeHtml(t('report.visual.title'))}</h2>
    <table>
      <thead>
        <tr><th>${escapeHtml(t('report.text.pOrig'))}</th><th>${escapeHtml(t('report.text.pMod'))}</th><th>${escapeHtml(t('report.visual.pixels'))}</th><th>${escapeHtml(t('report.visual.percent'))}</th><th>${escapeHtml(t('report.visual.thumbnail'))}</th></tr>
      </thead>
      <tbody>
        ${visualRows || `<tr><td colspan="5">${escapeHtml(t('report.visual.none'))}</td></tr>`}
      </tbody>
    </table>
  </div>
</body>
</html>`;
}

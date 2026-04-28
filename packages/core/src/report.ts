import type {
  PageMapping,
  TextComparisonOptions,
  TextDiffResult,
  VisualDiffReportEntry,
  ComparisonSummary,
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

// ─── helpers ────────────────────────────────────────────────────────────────

const escapeHtml = (v: string): string =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
   .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const clipText = (v: string, max: number): string =>
  v.length <= max ? v : `${v.slice(0, max)}...`;

const normalizeInline = (v: string): string => v.replace(/\s+/g, ' ').trim();

const leadingContext = (v: string, max: number): string => {
  const n = normalizeInline(v);
  return !n ? '' : n.length <= max ? n : `...${n.slice(n.length - max)}`;
};

const trailingContext = (v: string, max: number): string => {
  const n = normalizeInline(v);
  return !n ? '' : n.length <= max ? n : `${n.slice(0, max)}...`;
};

type T = (key: MessageKey, params?: Record<string, string | number>) => string;

// ─── per-diff item builders ──────────────────────────────────────────────────

type DiffType = 'changed' | 'added' | 'removed';

interface TextDiffItem {
  type: DiffType;
  orig: number;
  mod: number;
  searchKey: string;
  blocksHtml: string;
}

const kindToType = (kind: string | undefined): DiffType =>
  kind === 'added' ? 'added' : kind === 'deleted' ? 'removed' : 'changed';

function buildTextDiffItem(entry: TextDiffResult, t: T): TextDiffItem {
  const MAX_BLOCKS = 12;
  const CTX = 70;
  const CHANGE = 180;

  const blocks: string[] = [];
  const searchParts: string[] = [];

  for (let i = 0; i < entry.diff.length; i++) {
    const part = entry.diff[i];
    if (!part.added && !part.removed) continue;
    if (blocks.length >= MAX_BLOCKS) break;

    const prev = i > 0 ? entry.diff[i - 1] : undefined;
    const next = i < entry.diff.length - 1 ? entry.diff[i + 1] : undefined;

    const before = prev && !prev.added && !prev.removed ? leadingContext(prev.value, CTX) : '';
    const after  = next && !next.added && !next.removed ? trailingContext(next.value, CTX) : '';
    const change = clipText(normalizeInline(part.value), CHANGE);
    if (!change) continue;

    searchParts.push(change.toLowerCase());

    const cls        = part.added ? 'diff-ins' : 'diff-del';
    const beforeHtml = before ? `<span class="diff-same">${escapeHtml(before)}</span>` : '';
    const afterHtml  = after  ? `<span class="diff-same">${escapeHtml(after)}</span>`  : '';
    const changeHtml = `<span class="${cls}">${escapeHtml(change)}</span>`;

    let block = '<div class="block">';
    if (beforeHtml) block += beforeHtml + '<span class="diff-sep"> </span>';
    block += changeHtml;
    if (afterHtml)  block += '<span class="diff-sep"> </span>' + afterHtml;
    block += '</div>';
    blocks.push(block);
  }

  return {
    type: kindToType(entry.kind),
    orig: entry.page,
    mod:  entry.modifiedPage ?? 0,
    searchKey: searchParts.join(' '),
    blocksHtml: blocks.length > 0
      ? blocks.join('')
      : `<span style="color:var(--text-3);font-size:12px">${escapeHtml(t('report.emptyContent'))}</span>`,
  };
}

function buildMappingCells(mapping: PageMapping): string {
  return mapping.map(({ originalPage, modifiedPage }) => {
    const isRemoved = originalPage > 0 && modifiedPage === 0;
    const isAdded   = originalPage === 0 && modifiedPage > 0;
    const cls  = isRemoved ? ' removed' : isAdded ? ' added' : '';
    const from = originalPage > 0 ? String(originalPage) : '—';
    const to   = modifiedPage > 0 ? String(modifiedPage) : '—';
    return `<div class="map-cell${cls}"><span class="from">${from}</span><span class="arrow">→</span><span class="to">${to}</span></div>`;
  }).join('');
}

// ─── CSS (copied from design handoff prototype) ──────────────────────────────

const CSS = `
:root {
  --bg: oklch(97% 0.005 60);
  --surface: #ffffff;
  --surface-2: oklch(95.5% 0.006 60);
  --border: oklch(88% 0.006 60);
  --border-strong: oklch(78% 0.008 60);
  --text: oklch(15% 0.01 60);
  --text-2: oklch(45% 0.01 60);
  --text-3: oklch(65% 0.008 60);
  --accent: #e05a3a;
  --accent-hover: #c94d30;
  --blue: #2563eb;
  --blue-subtle: #eff6ff;
  --green: #16a34a;
  --green-subtle: #f0fdf4;
  --red: #dc2626;
  --red-subtle: #fef2f2;
  --warn: #d97706;
  --warn-subtle: #fffbeb;
  --logo: #6B90D2;
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow: 0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.08);
}
[data-theme="dark"] {
  --bg: oklch(13% 0.008 250);
  --surface: oklch(18% 0.01 250);
  --surface-2: oklch(22% 0.01 250);
  --border: oklch(28% 0.01 250);
  --border-strong: oklch(36% 0.012 250);
  --text: oklch(93% 0.005 60);
  --text-2: oklch(68% 0.008 60);
  --text-3: oklch(50% 0.006 60);
  --blue-subtle: oklch(18% 0.04 250);
  --green-subtle: oklch(18% 0.04 150);
  --red-subtle: oklch(18% 0.04 25);
  --warn-subtle: oklch(18% 0.04 70);
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.3);
  --shadow: 0 1px 3px rgba(0,0,0,0.3);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.4);
}
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body { font-family: 'Inter', system-ui, sans-serif; background: var(--bg); color: var(--text); -webkit-font-smoothing: antialiased; transition: background 0.2s, color 0.2s; }
button { font-family: inherit; cursor: pointer; border: none; background: none; color: inherit; }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 4px; }

.header {
  height: 56px; background: var(--surface); border-bottom: 1px solid var(--border);
  box-shadow: var(--shadow-sm); display: flex; align-items: center; justify-content: space-between;
  padding: 0 24px; position: sticky; top: 0; z-index: 100;
}
.brand { display: flex; align-items: center; gap: 14px; }
.logo-a { color: var(--logo); font-weight: 700; font-size: 18px; letter-spacing: -0.02em; }
.divider { width: 1px; height: 22px; background: var(--border-strong); }
.app-title { display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 600; color: var(--text); }
.app-title svg { color: var(--text-2); }
.header-right { display: flex; align-items: center; gap: 12px; }
.icon-btn {
  width: 32px; height: 32px; border-radius: 7px; display: inline-flex; align-items: center;
  justify-content: center; color: var(--text-2); transition: background 0.15s;
}
.icon-btn:hover { background: var(--surface-2); color: var(--text); }
.btn-action {
  display: inline-flex; align-items: center; gap: 7px; padding: 7px 14px;
  border: 1.5px solid var(--border-strong); border-radius: 7px; background: var(--surface);
  font-size: 13px; font-weight: 500; color: var(--text-2); transition: all 0.15s;
}
.btn-action:hover { border-color: var(--accent); color: var(--accent); }

main { max-width: 1100px; margin: 0 auto; padding: 28px 24px 60px; }

.page-title {
  display: flex; flex-direction: column; align-items: center; text-align: center;
  margin-bottom: 24px; gap: 6px;
}
.page-title h1 { font-size: 26px; font-weight: 700; letter-spacing: -0.02em; }
.page-title .meta { font-size: 13px; color: var(--text-2); display: flex; gap: 14px; align-items: center; flex-wrap: wrap; justify-content: center; }
.page-title .meta .pill {
  display: inline-flex; align-items: center; gap: 5px;
  background: var(--surface); border: 1px solid var(--border); border-radius: 100px;
  padding: 3px 11px; font-size: 12px; font-weight: 500; color: var(--text-2);
}
.page-title .meta .pill svg { color: var(--text-3); }

.hero {
  background: linear-gradient(135deg, var(--blue-subtle) 0%, var(--surface) 100%);
  border: 1px solid color-mix(in oklch, var(--blue) 18%, transparent);
  border-radius: 14px; padding: 22px 26px; margin-bottom: 18px; box-shadow: var(--shadow-sm);
}
.hero-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 18px; margin-bottom: 16px; }
.hero-head h2 { font-size: 17px; font-weight: 700; letter-spacing: -0.01em; margin-bottom: 3px; }
.hero-head .sub { font-size: 13px; color: var(--blue); font-weight: 500; }

.stats { display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; }
.stat {
  background: var(--surface); border: 1px solid var(--border); border-radius: 8px;
  padding: 11px 13px; box-shadow: var(--shadow-sm); position: relative; overflow: hidden;
  display: flex; flex-direction: column;
}
.stat::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: var(--text-3); }
.stat.neutral::before { background: var(--text-3); }
.stat.changed::before { background: var(--accent); }
.stat.same::before    { background: var(--text-3); opacity: 0.5; }
.stat.removed::before { background: var(--red); }
.stat.added::before   { background: var(--green); }
.stat.total::before   { background: var(--blue); }
.stat .label { font-size: 11px; color: var(--text-3); line-height: 1.35; margin-bottom: 5px; flex: 1; }
.stat .value { font-size: 26px; font-weight: 700; line-height: 1; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
.stat.changed .value { color: var(--accent); }
.stat.removed .value { color: var(--red); }
.stat.added   .value { color: var(--green); }
.stat.total   .value { color: var(--blue); }
.stat.same    .value { color: var(--text-2); }

.section {
  background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
  margin-bottom: 14px; overflow: hidden; box-shadow: var(--shadow-sm);
}
.section-head {
  padding: 14px 20px; display: flex; align-items: center; justify-content: space-between;
  gap: 12px; border-bottom: 1px solid var(--border); background: var(--surface);
}
.section-head .title { display: flex; align-items: center; gap: 11px; }
.section-head .title-num {
  width: 22px; height: 22px; border-radius: 50%; background: var(--text);
  color: var(--surface); font-size: 11px; font-weight: 600;
  display: inline-flex; align-items: center; justify-content: center;
}
.section-head h3 { font-size: 15px; font-weight: 600; letter-spacing: -0.01em; }
.section-head .badge {
  font-size: 11px; font-weight: 500; color: var(--text-2); background: var(--surface-2);
  border: 1px solid var(--border); border-radius: 100px; padding: 2px 9px;
}
.section-body { padding: 18px 20px; }

.doc-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.doc-card {
  border: 1.5px solid color-mix(in oklch, var(--accent-doc) 22%, transparent);
  border-radius: 10px; padding: 14px 16px;
  background: color-mix(in oklch, var(--accent-doc) 4%, var(--surface));
}
.doc-card.original { --accent-doc: var(--blue); }
.doc-card.modified { --accent-doc: var(--accent); }
.doc-card .doc-label {
  display: flex; align-items: center; gap: 7px; font-size: 11px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.06em; color: var(--accent-doc); margin-bottom: 8px;
}
.doc-card .doc-label .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--accent-doc); }
.doc-card .doc-name {
  display: flex; align-items: center; gap: 9px; font-size: 14px; font-weight: 600;
  color: var(--text); margin-bottom: 10px; word-break: break-all;
}
.doc-card .doc-name svg { color: var(--accent-doc); flex-shrink: 0; }
.doc-card .doc-meta { display: grid; grid-template-columns: auto 1fr; gap: 4px 10px; font-size: 11.5px; line-height: 1.55; }
.doc-card .doc-meta .k { color: var(--text-3); }
.doc-card .doc-meta .v { color: var(--text-2); font-family: 'JetBrains Mono', monospace; word-break: break-all; }
.doc-card .doc-meta .v.pages { font-family: inherit; font-weight: 500; color: var(--text); }

.opts-grid { display: flex; flex-wrap: wrap; gap: 6px; }
.opt-chip {
  display: inline-flex; align-items: center; gap: 6px; font-size: 12px;
  border: 1px solid var(--border); border-radius: 6px; padding: 5px 9px;
  background: var(--surface-2); color: var(--text-2); font-weight: 500;
}
.opt-chip.on { border-color: color-mix(in oklch, var(--green) 35%, transparent); background: var(--green-subtle); color: var(--green); }
.opt-chip.off { color: var(--text-3); }

.mapping-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 5px; }
.map-cell {
  background: var(--surface-2); border: 1px solid var(--border); border-radius: 6px;
  padding: 6px 8px; display: flex; align-items: center; justify-content: space-between;
  font-size: 11.5px; gap: 6px;
}
.map-cell .from  { color: var(--blue); font-weight: 500; font-variant-numeric: tabular-nums; }
.map-cell .arrow { color: var(--text-3); font-size: 10px; }
.map-cell .to    { color: var(--accent); font-weight: 500; font-variant-numeric: tabular-nums; }
.map-cell.removed { background: var(--red-subtle); border-color: color-mix(in oklch, var(--red) 25%, transparent); }
.map-cell.removed .to { color: var(--red); }
.map-cell.added { background: var(--green-subtle); border-color: color-mix(in oklch, var(--green) 25%, transparent); }

.diff-list { display: flex; flex-direction: column; gap: 10px; }
.diff-item {
  border: 1px solid var(--border); border-radius: 9px; overflow: hidden;
  background: var(--surface); transition: box-shadow 0.15s;
}
.diff-item:hover { box-shadow: var(--shadow-sm); }
.diff-item-head {
  display: flex; align-items: center; gap: 14px; padding: 11px 16px;
  background: var(--surface-2); border-bottom: 1px solid var(--border);
  cursor: pointer; user-select: none;
}
.diff-item-head .pages { display: flex; align-items: center; gap: 8px; }
.page-tag {
  display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 600;
  padding: 3px 9px; border-radius: 5px; font-variant-numeric: tabular-nums;
}
.page-tag.orig { background: var(--blue-subtle); color: var(--blue); }
.page-tag.mod  { background: color-mix(in oklch, var(--accent) 12%, transparent); color: var(--accent); }
.diff-item-head .arrow-icon { color: var(--text-3); }
.type-badge {
  font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;
  padding: 2px 8px; border-radius: 4px;
}
.type-badge.changed { background: color-mix(in oklch, var(--warn) 15%, transparent); color: var(--warn); }
.type-badge.added   { background: var(--green-subtle); color: var(--green); }
.type-badge.removed { background: var(--red-subtle); color: var(--red); }
.pixel-info { margin-left: auto; display: flex; align-items: center; gap: 14px; font-size: 12px; color: var(--text-2); }
.pixel-info .num { font-variant-numeric: tabular-nums; font-weight: 500; }
.toggle-icon { margin-left: 8px; transition: transform 0.2s; color: var(--text-3); }
.diff-item.open .toggle-icon { transform: rotate(180deg); }
.diff-item-body { display: none; padding: 16px 18px; }
.diff-item.open .diff-item-body { display: block; }

.diff-changes {
  background: var(--surface-2); border-radius: 7px; padding: 12px 14px;
  font-size: 13px; line-height: 1.75; color: var(--text-2);
  max-height: 280px; overflow-y: auto;
}
.diff-changes .block { margin-bottom: 4px; }
.diff-changes .block:last-child { margin-bottom: 0; }
.diff-del { text-decoration: line-through; color: var(--red); background: #fee2e2; padding: 0 3px; border-radius: 3px; font-weight: 500; }
.diff-ins { color: var(--green); background: #dcfce7; padding: 0 3px; border-radius: 3px; font-weight: 500; }
.diff-same { color: var(--text-2); }
.diff-sep  { color: var(--text-3); }
[data-theme="dark"] .diff-del { background: #450a0a; }
[data-theme="dark"] .diff-ins { background: #052e16; }

.visual-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-top: 14px; }
.visual-col { background: var(--surface); border: 1px solid var(--border); border-radius: 6px; overflow: hidden; }
.visual-col .col-label {
  font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;
  text-align: center; padding: 7px 0; border-bottom: 1px solid var(--border);
  color: var(--text-2); background: var(--surface-2);
}
.visual-col img { width: 100%; height: auto; display: block; }
.visual-col .visual-placeholder {
  background: var(--surface-2); aspect-ratio: 3/4; display: flex;
  align-items: center; justify-content: center; color: var(--text-3); font-size: 11px;
}
.px-pill {
  display: inline-flex; align-items: center; gap: 5px;
  background: var(--warn-subtle); border: 1px solid color-mix(in oklch, var(--warn) 30%, transparent);
  border-radius: 100px; padding: 3px 9px; color: var(--warn); font-weight: 500; font-size: 11px;
}
.px-pill.tiny { background: var(--green-subtle); border-color: color-mix(in oklch, var(--green) 25%, transparent); color: var(--green); }
.pct { font-variant-numeric: tabular-nums; font-weight: 500; }
.bar { flex: 1; height: 4px; background: var(--surface); border-radius: 2px; overflow: hidden; min-width: 80px; }
.bar-fill { height: 100%; background: var(--warn); border-radius: 2px; }
.bar-fill.tiny { background: var(--green); }

.tabs {
  display: flex; border-bottom: 2px solid var(--border); margin-bottom: 18px;
  position: sticky; top: 56px; background: var(--bg); z-index: 50; padding-top: 4px;
}
.tab {
  padding: 11px 18px; font-size: 13.5px; font-weight: 500; color: var(--text-2);
  border-bottom: 2px solid transparent; margin-bottom: -2px; transition: all 0.15s;
  display: inline-flex; align-items: center; gap: 7px;
}
.tab:hover { color: var(--text); }
.tab.active { color: var(--blue); font-weight: 600; border-bottom-color: var(--blue); }
.tab .count {
  font-size: 11px; background: var(--surface-2); border: 1px solid var(--border);
  border-radius: 100px; padding: 1px 7px; color: var(--text-2); font-weight: 500;
}
.tab.active .count { background: var(--blue-subtle); border-color: color-mix(in oklch, var(--blue) 25%, transparent); color: var(--blue); }
.tab-pane { display: none; }
.tab-pane.active { display: block; animation: fadeIn 0.2s ease; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }

.toolbar {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  padding: 10px 14px; background: var(--surface-2); border: 1px solid var(--border);
  border-radius: 8px; margin-bottom: 14px;
}
.toolbar .search {
  display: flex; align-items: center; gap: 7px; background: var(--surface);
  border: 1px solid var(--border); border-radius: 6px; padding: 5px 10px; flex: 1; min-width: 220px;
}
.toolbar .search input {
  border: none; outline: none; background: transparent; font-family: inherit;
  font-size: 13px; color: var(--text); flex: 1;
}
.toolbar .search input::placeholder { color: var(--text-3); }
.toolbar .search svg { color: var(--text-3); }
.toolbar .filter {
  display: inline-flex; border: 1px solid var(--border); border-radius: 6px;
  background: var(--surface); overflow: hidden;
}
.toolbar .filter button {
  padding: 5px 11px; font-size: 12px; font-weight: 500; color: var(--text-2);
  border-right: 1px solid var(--border); transition: all 0.15s;
}
.toolbar .filter button:last-child { border-right: none; }
.toolbar .filter button.active { background: var(--text); color: var(--surface); }
.toolbar .filter button:not(.active):hover { background: var(--surface-2); }
.expand-btn {
  display: inline-flex; align-items: center; gap: 6px; padding: 5px 11px;
  border: 1px solid var(--border); border-radius: 6px; background: var(--surface);
  font-size: 12px; font-weight: 500; color: var(--text-2); transition: all 0.15s;
}
.expand-btn:hover { border-color: var(--text-2); color: var(--text); }

.empty-state {
  text-align: center; padding: 48px 16px; color: var(--text-3); font-size: 14px;
}

@media print {
  .header, .tabs, .toolbar { display: none !important; }
  body { background: white; }
  .section, .hero { box-shadow: none; page-break-inside: avoid; }
  .tab-pane { display: block !important; }
  .diff-item-body { display: block !important; }
}
@media (max-width: 900px) {
  .stats { grid-template-columns: repeat(3, 1fr); }
  .doc-grid { grid-template-columns: 1fr; }
  .mapping-grid { grid-template-columns: repeat(4, 1fr); }
  .visual-grid { grid-template-columns: 1fr; }
}
`;

// ─── main export ─────────────────────────────────────────────────────────────

export function generateReportHtml(data: ReportData): string {
  const locale: Locale = data.locale ?? 'es';
  const t: T = (key, params) => translate(locale, key, params);
  const nlTag = locale === 'en' ? 'en-US' : 'es-ES';

  const summary      = data.summary;
  const totalPages   = data.pageCounts?.original ?? 0;
  const changedCount = summary?.changedPairs ?? 0;
  const textDiffCount = (data.textDiff ?? []).length;

  const textItems: TextDiffItem[] = (data.textDiff ?? []).map(e => buildTextDiffItem(e, t));

  const visualItems = data.visualDiffEntries.map(e => ({
    orig:   e.originalPage,
    mod:    e.modifiedPage,
    pixels: e.diffPixels,
    pixFmt: e.diffPixels.toLocaleString(nlTag),
    pctStr: (e.diffRatio * 100).toFixed(3),
    pct:    e.diffRatio * 100,
    tiny:   e.diffRatio * 100 < 0.05,
    thumb:  e.thumbnailDataUrl || null,
  }));

  const avgVisualPct = visualItems.length > 0
    ? visualItems.reduce((s, e) => s + e.pct, 0) / visualItems.length
    : 0;

  const mappingCellsHtml  = buildMappingCells(data.mapping);
  const mappingPairsCount = data.mapping.filter(e => e.originalPage > 0 && e.modifiedPage > 0).length;

  // Stats row
  const stats = [
    { cls: 'total',   label: t('report.stat.mapped'),    value: String(summary?.mappedPairs ?? 0) },
    { cls: 'changed', label: t('report.stat.changed'),   value: String(changedCount) },
    { cls: 'same',    label: t('report.stat.unchanged'), value: String(summary?.unchangedPairs ?? 0) },
    { cls: 'removed', label: t('report.stat.deleted'),   value: String(summary?.deletedPages ?? 0) },
    { cls: 'added',   label: t('report.stat.added'),     value: String(summary?.addedPages ?? 0) },
    { cls: 'neutral', label: t('report.stat.textCount'), value: String(textDiffCount) },
    { cls: 'neutral', label: t('report.stat.visualPct'),
      value: `${avgVisualPct.toFixed(3)}<span style="font-size:14px;color:var(--text-3);font-weight:500">%</span>` },
  ];

  const statsHtml = stats.map(({ cls, label, value }) =>
    `<div class="stat ${cls}"><div class="label">${escapeHtml(label)}</div><div class="value">${value}</div></div>`
  ).join('');

  // Options chips
  const optsData = [
    { key: 'report.opts.includeUnmapped' as MessageKey, val: data.options.includeUnmappedPages },
    { key: 'report.opts.ignoreCase'      as MessageKey, val: data.options.normalization.ignoreCase },
    { key: 'report.opts.ignoreWhitespace' as MessageKey, val: data.options.normalization.ignoreWhitespace },
    { key: 'report.opts.ignoreLineBreaks' as MessageKey, val: data.options.normalization.ignoreLineBreaks },
  ];

  const SVG_CHECK = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>`;
  const SVG_CROSS = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

  const optsHtml = optsData.map(({ key, val }) => {
    const label = t(key).replace(/:$/, '');
    return `<span class="opt-chip ${val ? 'on' : 'off'}">${val ? SVG_CHECK : SVG_CROSS} ${escapeHtml(label)}</span>`;
  }).join('');

  const pagePrefix = locale === 'en' ? 'p.' : 'Pág.';

  const SVG_ARROW    = `<svg class="arrow-icon" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>`;
  const SVG_CHEVRON  = `<svg class="toggle-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>`;
  const SVG_DOT      = `<svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="6"/></svg>`;

  const TYPE_LABEL: Record<DiffType, string> = {
    changed: t('report.kind.changed'),
    added:   t('report.kind.added'),
    removed: t('report.kind.deleted'),
  };

  // ── Static HTML for text diff items ─────────────────────────────────────────
  const textDiffListHtml = textItems.length === 0
    ? `<div class="empty-state">${escapeHtml(t('report.text.none'))}</div>`
    : textItems.map(item => {
        const origTag = item.orig > 0 ? `<span class="page-tag orig">${escapeHtml(pagePrefix)} ${item.orig}</span>` : '';
        const modTag  = item.mod  > 0 ? `<span class="page-tag mod">${escapeHtml(pagePrefix)} ${item.mod}</span>`  : '';
        const arrow   = (origTag && modTag) ? SVG_ARROW : '';
        return (
          `<div class="diff-item" data-type="${item.type}" data-search="${escapeHtml(item.searchKey)}">`
          + `<div class="diff-item-head" onclick="this.parentElement.classList.toggle('open')">`
          + `<div class="pages">${origTag}${arrow}${modTag}</div>`
          + `<span class="type-badge ${item.type}">${escapeHtml(TYPE_LABEL[item.type])}</span>`
          + SVG_CHEVRON
          + `</div>`
          + `<div class="diff-item-body"><div class="diff-changes">${item.blocksHtml}</div></div>`
          + `</div>`
        );
      }).join('');

  // ── Static HTML for visual diff items ───────────────────────────────────────
  const noThumbLabel = escapeHtml(t('report.visual.noThumb'));
  const visualDiffListHtml = visualItems.length === 0
    ? `<div class="empty-state">${escapeHtml(t('report.visual.none'))}</div>`
    : visualItems.map(item => {
        const pxCls  = item.tiny ? 'px-pill tiny' : 'px-pill';
        const barCls = item.tiny ? 'bar-fill tiny' : 'bar-fill';
        const barW   = Math.min(100, item.pct * 20).toFixed(1);
        const origTag = `<span class="page-tag orig">${escapeHtml(pagePrefix)} ${item.orig}</span>`;
        const modTag  = `<span class="page-tag mod">${escapeHtml(pagePrefix)} ${item.mod}</span>`;
        const ph = (pg: number) => `<div class="visual-placeholder">${escapeHtml(pagePrefix)} ${pg}</div>`;
        const diffImg = item.thumb
          ? `<img class="thumb" src="${item.thumb}" alt="diff p${item.orig}-${item.mod}"/>`
          : `<div class="visual-placeholder">${noThumbLabel}</div>`;
        return (
          `<div class="diff-item open">`
          + `<div class="diff-item-head" onclick="this.parentElement.classList.toggle('open')">`
          + `<div class="pages">${origTag}${SVG_ARROW}${modTag}</div>`
          + `<div class="pixel-info">`
          + `<span class="${pxCls}">${SVG_DOT} ${escapeHtml(item.pixFmt)} px</span>`
          + `<span class="pct">${escapeHtml(item.pctStr)}%</span>`
          + `<div class="bar"><div class="${barCls}" style="width:${barW}%"></div></div>`
          + `</div>`
          + SVG_CHEVRON
          + `</div>`
          + `<div class="diff-item-body"><div class="visual-grid">`
          + `<div class="visual-col"><div class="col-label" style="color:var(--blue)">${escapeHtml(t('report.colOrig'))}</div>${ph(item.orig)}</div>`
          + `<div class="visual-col"><div class="col-label" style="color:var(--accent)">${escapeHtml(t('report.colMod'))}</div>${ph(item.mod)}</div>`
          + `<div class="visual-col"><div class="col-label" style="color:var(--warn)">${escapeHtml(t('report.colDiff'))}</div>${diffImg}</div>`
          + `</div></div>`
          + `</div>`
        );
      }).join('');

  return `<!doctype html>
<html lang="${locale}">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>${escapeHtml(t('report.title'))}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet"/>
<style>${CSS}</style>
</head>
<body>

<header class="header">
  <div class="brand">
    <span class="logo-a">//A</span>
    <div class="divider"></div>
    <div class="app-title">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
      PDF Diff · ${escapeHtml(t('report.pageTitle'))}
    </div>
  </div>
  <div class="header-right">
    <button class="btn-action" onclick="window.print()">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
      ${escapeHtml(t('report.printBtn'))}
    </button>
    <div class="divider"></div>
    <button class="icon-btn" onclick="toggleTheme()" id="themeBtn" aria-label="Toggle theme">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
    </button>
  </div>
</header>

<main>

  <div class="page-title">
    <h1>${escapeHtml(t('report.pageTitle'))}</h1>
    <div class="meta">
      <span class="pill">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        ${escapeHtml(t('report.generated', { date: data.createdAt }))}
      </span>
      <span class="pill">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        ${escapeHtml(t('report.pagesLabel', { n: totalPages }))}
      </span>
    </div>
  </div>

  <div class="hero">
    <div class="hero-head">
      <div>
        <h2>${escapeHtml(t('report.summary.title'))}</h2>
        <div class="sub">${escapeHtml(t('report.hero.subtitle', { pages: totalPages, changed: changedCount }))}</div>
      </div>
    </div>
    <div class="stats">${statsHtml}</div>
  </div>

  <div class="section">
    <div class="section-head">
      <div class="title"><span class="title-num">1</span><h3>${escapeHtml(t('report.section.docs'))}</h3></div>
    </div>
    <div class="section-body">
      <div class="doc-grid">
        <div class="doc-card original">
          <div class="doc-label"><span class="dot"></span>${escapeHtml(t('report.doc.original'))}</div>
          <div class="doc-name">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            ${escapeHtml(data.originalFileName)}
          </div>
          <div class="doc-meta">
            <span class="k">${escapeHtml(t('report.doc.pages'))}</span><span class="v pages">${data.pageCounts?.original ?? '-'}</span>
            <span class="k">SHA-512</span><span class="v">${escapeHtml(data.hashes.original ?? '-')}</span>
          </div>
        </div>
        <div class="doc-card modified">
          <div class="doc-label"><span class="dot"></span>${escapeHtml(t('report.doc.modified'))}</div>
          <div class="doc-name">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            ${escapeHtml(data.modifiedFileName)}
          </div>
          <div class="doc-meta">
            <span class="k">${escapeHtml(t('report.doc.pages'))}</span><span class="v pages">${data.pageCounts?.modified ?? '-'}</span>
            <span class="k">SHA-512</span><span class="v">${escapeHtml(data.hashes.modified ?? '-')}</span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-head">
      <div class="title"><span class="title-num">2</span><h3>${escapeHtml(t('report.section.opts'))}</h3></div>
    </div>
    <div class="section-body">
      <div class="opts-grid">${optsHtml}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-head">
      <div class="title"><span class="title-num">3</span><h3>${escapeHtml(t('report.mapping.title'))}</h3></div>
      <span class="badge">${escapeHtml(t('report.mappingBadge', { n: mappingPairsCount }))}</span>
    </div>
    <div class="section-body">
      <div class="mapping-grid">${mappingCellsHtml}</div>
    </div>
  </div>

  <div class="tabs">
    <button class="tab active" onclick="switchTab('text')" id="tab-text">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M4 7V4h16v3"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>
      ${escapeHtml(t('report.text.title'))}
      <span class="count">${textDiffCount}</span>
    </button>
    <button class="tab" onclick="switchTab('visual')" id="tab-visual">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/></svg>
      ${escapeHtml(t('report.visual.title'))}
      <span class="count">${visualItems.length}</span>
    </button>
  </div>

  <div class="tab-pane active" id="pane-text">
    <div class="toolbar">
      <div class="search">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="text" placeholder="${escapeHtml(t('report.search.placeholder'))}" oninput="filterDiffs(this.value)"/>
      </div>
      <div class="filter">
        <button class="active" onclick="filterType(this,'all')">${escapeHtml(t('report.filter.all'))}</button>
        <button onclick="filterType(this,'changed')">${escapeHtml(t('report.filter.changed'))}</button>
        <button onclick="filterType(this,'added')">${escapeHtml(t('report.filter.added'))}</button>
        <button onclick="filterType(this,'removed')">${escapeHtml(t('report.filter.removed'))}</button>
      </div>
      <button class="expand-btn" onclick="toggleAll()">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="7 13 12 18 17 13"/><polyline points="7 6 12 11 17 6"/></svg>
        <span id="expandLabel">${escapeHtml(t('report.expandAll'))}</span>
      </button>
    </div>
    <div class="diff-list" id="diffList">
      ${textDiffListHtml}
    </div>
  </div>

  <div class="tab-pane" id="pane-visual">
    <div class="diff-list" id="visualList">
      ${visualDiffListHtml}
    </div>
  </div>

</main>

<script>
function switchTab(t) {
  document.querySelectorAll('.tab').forEach(function(x) { x.classList.remove('active'); });
  document.getElementById('tab-' + t).classList.add('active');
  document.querySelectorAll('.tab-pane').forEach(function(x) { x.classList.remove('active'); });
  document.getElementById('pane-' + t).classList.add('active');
}

function filterDiffs(q) {
  q = q.toLowerCase().trim();
  document.querySelectorAll('#diffList .diff-item').forEach(function(i) {
    i.style.display = (!q || (i.dataset.search || '').includes(q)) ? '' : 'none';
  });
}

function filterType(btn, type) {
  document.querySelectorAll('.toolbar .filter button').forEach(function(x) { x.classList.remove('active'); });
  btn.classList.add('active');
  document.querySelectorAll('#diffList .diff-item').forEach(function(i) {
    i.style.display = (type === 'all' || i.dataset.type === type) ? '' : 'none';
  });
}

var allOpen = false;
function toggleAll() {
  allOpen = !allOpen;
  document.querySelectorAll('#diffList .diff-item').forEach(function(i) {
    i.classList.toggle('open', allOpen);
  });
  document.getElementById('expandLabel').textContent = allOpen
    ? '${escapeHtml(t('report.collapseAll'))}'
    : '${escapeHtml(t('report.expandAll'))}';
}

function toggleTheme() {
  var cur  = document.documentElement.getAttribute('data-theme');
  var next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  document.getElementById('themeBtn').innerHTML = next === 'dark'
    ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>'
    : '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
}
</script>
</body>
</html>`;
}

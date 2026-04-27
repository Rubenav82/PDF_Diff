import React, { useState, useCallback, useEffect, useRef } from 'react';
import { FileUploader } from './components/ui/FileUploader';
import { ComparisonView } from './components/features/ComparisonView';
import { Spinner } from './components/ui/Spinner';
import { DocumentIcon, ArrowPathIcon, MoonIcon, SunIcon } from './components/ui/icons';
import { getPdfPageCount, extractTextFromPdf, calculateFileHash } from './lib/pdfService';
import type {
  ComparisonSummary,
  TextComparisonOptions,
  ViewMode,
  TextDiffResult,
  VisualDiffResult,
  PageMapping,
} from './types/types';
import { PageMapper } from './components/features/PageMapper';
import { buildTextComparisonAsync } from './lib/textDiffService';
import { suggestPageMapping } from './lib/pageMatcher';
import { pickPagesNeedingOcr, runOcrOnPages } from './lib/ocrService';
import { ComparisonSummaryPanel } from './components/features/ComparisonSummary';
import { downloadComparisonReport } from './lib/reportService';
import { buildVisualDiffReportEntries } from './lib/visualReportService';
import { useT } from './i18n/useT';
import { useLanguage } from './i18n/LanguageContext';
import { LanguageSelector } from './components/ui/LanguageSelector';
import { AccordionSection } from './components/ui/Accordion';

const CheckSmIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
);
const WarnSmIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

export default function App() {
  const t = useT();
  const { locale } = useLanguage();

  const isEs = locale === 'es';

  // ── Theme ──
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // ── Accordion state ──
  const [sectionOpen, setSectionOpen] = useState({ upload: true, mapping: true, options: false });

  // ── Simulated hash progress ──
  const [hashPct, setHashPct] = useState(0);
  const hashTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Core state ──
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [modifiedFile, setModifiedFile] = useState<File | null>(null);
  const [textDiff, setTextDiff] = useState<TextDiffResult[] | null>(null);
  const [visualDiff, setVisualDiff] = useState<VisualDiffResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isHashing, setIsHashing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('text');
  const [includeUnmappedPages, setIncludeUnmappedPages] = useState<boolean>(false);
  const [ignoreCase, setIgnoreCase] = useState<boolean>(false);
  const [ignoreWhitespace, setIgnoreWhitespace] = useState<boolean>(true);
  const [ignoreLineBreaks, setIgnoreLineBreaks] = useState<boolean>(true);
  const [enableOcr, setEnableOcr] = useState<boolean>(false);
  const [ocrStatus, setOcrStatus] = useState<string | null>(null);
  const [hashes, setHashes] = useState<{ original: string | null; modified: string | null }>({ original: null, modified: null });
  const [pageCounts, setPageCounts] = useState<{ original: number; modified: number } | null>(null);
  const [pageMapping, setPageMapping] = useState<PageMapping | null>(null);
  const [comparisonSummary, setComparisonSummary] = useState<ComparisonSummary | null>(null);
  const [isExportingReport, setIsExportingReport] = useState<boolean>(false);
  const [extractedTexts, setExtractedTexts] = useState<{ original: string[]; modified: string[] } | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);

  // Simulated hash progress bar
  useEffect(() => {
    if (isHashing) {
      setHashPct(0);
      let pct = 0;
      hashTimerRef.current = setInterval(() => {
        pct += Math.random() * 15 + 5;
        if (pct >= 90) { pct = 90; clearInterval(hashTimerRef.current!); }
        setHashPct(Math.round(pct));
      }, 120);
    } else {
      if (hashTimerRef.current) clearInterval(hashTimerRef.current);
      if (hashPct > 0) setHashPct(100);
    }
    return () => { if (hashTimerRef.current) clearInterval(hashTimerRef.current); };
  }, [isHashing]); // eslint-disable-line react-hooks/exhaustive-deps

  // Hash + page count when both files loaded
  useEffect(() => {
    if (originalFile && modifiedFile) {
      const processFiles = async () => {
        setIsHashing(true);
        try {
          const [originalCount, modifiedCount, hOriginal, hModified] = await Promise.all([
            getPdfPageCount(originalFile),
            getPdfPageCount(modifiedFile),
            calculateFileHash(originalFile),
            calculateFileHash(modifiedFile),
          ]);
          setPageCounts({ original: originalCount, modified: modifiedCount });
          setHashes({ original: hOriginal, modified: hModified });
          setError(null);
        } catch (err) {
          setError(t('app.errors.initialLoad'));
          console.error(err);
        } finally {
          setIsHashing(false);
        }
      };
      processFiles();
    } else {
      setPageCounts(null);
      setHashes({ original: null, modified: null });
    }
    setExtractedTexts(null);
  }, [originalFile, modifiedFile, t]);

  // Build default 1:1 page mapping when counts become available
  useEffect(() => {
    if (pageCounts) {
      const defaultMapping: PageMapping = [];
      for (let i = 1; i <= pageCounts.original; i++) {
        defaultMapping.push({ originalPage: i, modifiedPage: i <= pageCounts.modified ? i : 0 });
      }
      setPageMapping(defaultMapping);
    } else {
      setPageMapping(null);
    }
  }, [pageCounts]);

  const hasResults = textDiff !== null || visualDiff !== null;
  const filesAreIdentical = !!(hashes.original && hashes.modified && hashes.original === hashes.modified);
  const isDifferent = !!(pageCounts && !filesAreIdentical && !isHashing);

  // Unlock mapping section when verification completes
  useEffect(() => {
    if (isDifferent) setSectionOpen(prev => ({ ...prev, mapping: true }));
  }, [isDifferent]);

  const handleCompare = useCallback(async () => {
    if (!originalFile || !modifiedFile || !pageMapping) {
      setError(t('app.errors.missingInputs'));
      return;
    }
    setIsLoading(true);
    setError(null);
    setTextDiff(null);
    setVisualDiff(null);
    try {
      let [originalPages, modifiedPages] = extractedTexts
        ? [extractedTexts.original, extractedTexts.modified]
        : await Promise.all([extractTextFromPdf(originalFile), extractTextFromPdf(modifiedFile)]);

      if (enableOcr) {
        const pagesToOcrOriginal = pickPagesNeedingOcr(originalPages);
        const pagesToOcrModified = pickPagesNeedingOcr(modifiedPages);
        if (pagesToOcrOriginal.length || pagesToOcrModified.length) {
          setOcrStatus(t('app.ocr.running', { count: pagesToOcrOriginal.length + pagesToOcrModified.length }));
          const [origOcr, modOcr] = await Promise.all([
            runOcrOnPages(originalFile, pagesToOcrOriginal),
            runOcrOnPages(modifiedFile, pagesToOcrModified),
          ]);
          originalPages = originalPages.map((txt, i) => origOcr.get(i + 1) ?? txt);
          modifiedPages = modifiedPages.map((txt, i) => modOcr.get(i + 1) ?? txt);
        }
      }
      setExtractedTexts({ original: originalPages, modified: modifiedPages });
      setOcrStatus(null);

      const options: TextComparisonOptions = {
        includeUnmappedPages,
        normalization: { ignoreCase, ignoreWhitespace, ignoreLineBreaks },
      };
      setProgress({ current: 0, total: pageMapping.length });
      const comparison = await buildTextComparisonAsync(
        originalPages, modifiedPages, pageMapping, options,
        (p) => setProgress({ current: p.current, total: p.total })
      );
      setTextDiff(comparison.diffResults);
      setComparisonSummary(comparison.summary);
      setVisualDiff({ originalPageCount: originalPages.length, modifiedPageCount: modifiedPages.length });
    } catch (err) {
      console.error('Comparación fallida:', err);
      setError(t('app.errors.compareFailed'));
    } finally {
      setIsLoading(false);
      setProgress(null);
      setOcrStatus(null);
    }
  }, [originalFile, modifiedFile, pageMapping, includeUnmappedPages, ignoreCase, ignoreWhitespace, ignoreLineBreaks, extractedTexts, enableOcr, t]);

  const handleSuggestMapping = useCallback(async (): Promise<PageMapping | null> => {
    if (!originalFile || !modifiedFile) return null;
    let texts = extractedTexts;
    if (!texts) {
      const [originalPages, modifiedPages] = await Promise.all([
        extractTextFromPdf(originalFile),
        extractTextFromPdf(modifiedFile),
      ]);
      texts = { original: originalPages, modified: modifiedPages };
      setExtractedTexts(texts);
    }
    return suggestPageMapping(texts.original, texts.modified);
  }, [originalFile, modifiedFile, extractedTexts]);

  const handleReset = () => {
    setOriginalFile(null); setModifiedFile(null);
    setTextDiff(null); setVisualDiff(null);
    setError(null); setIsLoading(false); setIsHashing(false);
    setPageCounts(null); setPageMapping(null);
    setHashes({ original: null, modified: null });
    setComparisonSummary(null); setExtractedTexts(null);
    setSectionOpen({ upload: true, mapping: true, options: false });
  };

  const handleExportReport = useCallback(async () => {
    if (!originalFile || !modifiedFile || !pageMapping) return;
    const options: TextComparisonOptions = {
      includeUnmappedPages,
      normalization: { ignoreCase, ignoreWhitespace, ignoreLineBreaks },
    };
    setIsExportingReport(true);
    try {
      const visualDiffEntries = await buildVisualDiffReportEntries(originalFile, modifiedFile, pageMapping);
      const localeTag = locale === 'en' ? 'en-US' : 'es-ES';
      downloadComparisonReport({
        createdAt: new Date().toLocaleString(localeTag),
        locale, originalFileName: originalFile.name, modifiedFileName: modifiedFile.name,
        hashes, pageCounts, mapping: pageMapping, options,
        summary: comparisonSummary, textDiff, visualDiffEntries,
      });
    } catch (err) {
      console.error('Error exportando informe:', err);
      setError(t('app.errors.exportFailed'));
    } finally {
      setIsExportingReport(false);
    }
  }, [originalFile, modifiedFile, pageMapping, includeUnmappedPages, ignoreCase, ignoreWhitespace, ignoreLineBreaks, hashes, pageCounts, comparisonSummary, textDiff, t, locale]);

  const canCompare = isDifferent && !!pageMapping;

  const L = {
    s1: isEs ? 'Cargar archivos' : 'Upload files',
    s2: isEs ? 'Mapeo de páginas' : 'Page mapping',
    s3: isEs ? 'Opciones de comparación' : 'Comparison options',
    locked: isEs ? 'Disponible tras verificar los archivos' : 'Available after file verification',
    shaVerified: isEs ? 'SHA-512 verificado — los documentos son diferentes' : 'SHA-512 verified — documents are different',
    pages: isEs ? 'páginas' : 'pages',
    step1done: isEs ? 'Archivos cargados' : 'Files loaded',
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', transition: 'background 0.2s ease' }}>

      {/* ── HEADER ── */}
      <header style={{
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        padding: '0 24px', height: 56, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', boxShadow: 'var(--shadow-sm)',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 18, color: '#6B90D2', letterSpacing: '-0.02em', lineHeight: 1 }}>//A</div>
          <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <DocumentIcon style={{ width: 16, height: 16, color: 'var(--text-3)' }} />
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{t('app.title')}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {hasResults && (
            <button
              onClick={handleReset}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '6px 14px', borderRadius: 7,
                border: '1.5px solid var(--border-strong)',
                background: 'var(--surface)', color: 'var(--text-2)',
                fontSize: 13, fontWeight: 500, cursor: 'pointer',
                transition: 'all 0.2s ease', fontFamily: 'inherit',
              }}
            >
              <ArrowPathIcon style={{ width: 14, height: 14 }} />
              {t('app.newComparison')}
            </button>
          )}
          <LanguageSelector />
          <button
            type="button"
            onClick={() => setTheme(prev => prev === 'light' ? 'dark' : 'light')}
            aria-label="Toggle dark mode"
            style={{
              padding: 6, borderRadius: 6, background: 'var(--surface-2)',
              border: '1px solid var(--border)', color: 'var(--text-2)',
              display: 'flex', alignItems: 'center', cursor: 'pointer',
              transition: 'background 0.2s ease', fontFamily: 'inherit',
            }}
          >
            {theme === 'light' ? <MoonIcon /> : <SunIcon />}
          </button>
          <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
          <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--accent)', letterSpacing: '-0.01em' }}>izertis</span>
        </div>
      </header>

      {/* ── MAIN ── */}
      <main style={{ maxWidth: hasResults ? 1100 : 960, margin: '0 auto', padding: '32px 20px 60px' }}>

        {/* UPLOAD VIEW */}
        {!hasResults && !isLoading && (
          <>
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em', marginBottom: 8 }}>
                {t('app.heading')}
              </h1>
              <p style={{ fontSize: 14, color: 'var(--text-2)', maxWidth: 520, margin: '0 auto', lineHeight: 1.6 }}>
                {t('app.uploadHint')}
              </p>
            </div>

            {/* Step progress bar */}
            {isDifferent && (
              <div className="anim-in" style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
                {[L.step1done, L.s2, L.s3].map((label, i) => (
                  <React.Fragment key={i}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{
                        width: 22, height: 22, borderRadius: '50%',
                        border: `2px solid ${i === 0 ? 'var(--green)' : i === 1 ? 'var(--text)' : 'var(--border-strong)'}`,
                        background: i === 0 ? 'var(--green)' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, fontWeight: 700,
                        color: i === 0 ? '#fff' : i === 1 ? 'var(--text)' : 'var(--text-3)',
                        flexShrink: 0,
                      }}>
                        {i === 0 ? '✓' : i + 1}
                      </div>
                      <span style={{
                        fontSize: 12, whiteSpace: 'nowrap',
                        fontWeight: i === 1 ? 600 : 400,
                        color: i === 0 ? 'var(--green)' : i === 1 ? 'var(--text)' : 'var(--text-3)',
                      }}>
                        {label}
                      </span>
                    </div>
                    {i < 2 && (
                      <div style={{ flex: 1, height: 1.5, background: i === 0 ? 'var(--green)' : 'var(--border)', margin: '0 8px', minWidth: 16 }} />
                    )}
                  </React.Fragment>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

              {/* Section 1: Upload */}
              <AccordionSection
                num={1}
                title={L.s1}
                open={sectionOpen.upload}
                onToggle={() => setSectionOpen(s => ({ ...s, upload: !s.upload }))}
              >
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <FileUploader
                    file={originalFile}
                    onFileSelect={setOriginalFile}
                    label={t('app.uploadOriginal')}
                    id="original-file"
                    variant="original"
                  />
                  <FileUploader
                    file={modifiedFile}
                    onFileSelect={setModifiedFile}
                    label={t('app.uploadModified')}
                    id="modified-file"
                    variant="modified"
                  />
                </div>

                {isHashing && (
                  <div className="anim-in" style={{ marginTop: 14, padding: '10px 14px', background: 'var(--blue-subtle)', border: '1px solid rgba(37,99,235,0.2)', borderRadius: 7, display: 'flex', flexDirection: 'column', gap: 7 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: 'var(--blue)', fontWeight: 500 }}>
                        <div style={{ width: 13, height: 13, border: '2px solid var(--blue)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                        SHA-512 — {t('app.hashing')}
                      </div>
                      <span style={{ fontSize: 12, color: 'var(--text-3)', fontVariantNumeric: 'tabular-nums' }}>{hashPct}%</span>
                    </div>
                    <div style={{ height: 5, background: 'var(--surface-2)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${hashPct}%`, background: 'var(--blue)', borderRadius: 3, transition: 'width 0.15s linear' }} />
                    </div>
                  </div>
                )}

                {filesAreIdentical && !isHashing && (
                  <div className="anim-in" style={{ marginTop: 14, padding: '12px 16px', background: 'var(--warn-subtle)', border: '1.5px solid var(--warn-border)', borderRadius: 7, display: 'flex', gap: 12 }}>
                    <div style={{ color: 'var(--warn)', flexShrink: 0, marginTop: 1 }}><WarnSmIcon /></div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--warn)', marginBottom: 3 }}>{t('app.identicalTitle')}</div>
                      <div style={{ fontSize: 13, color: 'var(--warn)', lineHeight: 1.55, opacity: 0.85 }}>{t('app.identicalBody')}</div>
                    </div>
                  </div>
                )}

                {isDifferent && (
                  <div className="anim-in" style={{ marginTop: 14, padding: '9px 14px', background: 'var(--green-subtle)', border: '1px solid rgba(22,163,74,0.2)', borderRadius: 7, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ color: 'var(--green)' }}><CheckSmIcon /></div>
                    <span style={{ fontSize: 13, color: 'var(--green)', fontWeight: 500 }}>{L.shaVerified}</span>
                  </div>
                )}
              </AccordionSection>

              {/* Section 2: Page mapping */}
              <AccordionSection
                num={2}
                title={L.s2}
                badge={isDifferent && pageCounts ? `${pageCounts.original} ${L.pages}` : undefined}
                locked={!isDifferent}
                open={sectionOpen.mapping && isDifferent}
                onToggle={() => setSectionOpen(s => ({ ...s, mapping: !s.mapping }))}
                lockedLabel={L.locked}
              >
                {pageMapping && pageCounts && (
                  <PageMapper
                    pageCounts={pageCounts}
                    mapping={pageMapping}
                    onMappingChange={setPageMapping}
                    onSuggestMapping={handleSuggestMapping}
                  />
                )}
              </AccordionSection>

              {/* Section 3: Options */}
              <AccordionSection
                num={3}
                title={L.s3}
                locked={!isDifferent}
                open={sectionOpen.options && isDifferent}
                onToggle={() => setSectionOpen(s => ({ ...s, options: !s.options }))}
                lockedLabel={L.locked}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                      {t('app.settings.normalization')}
                    </div>
                    {[
                      { label: t('app.settings.ignoreCase'), checked: ignoreCase, onChange: setIgnoreCase },
                      { label: t('app.settings.ignoreWhitespace'), checked: ignoreWhitespace, onChange: setIgnoreWhitespace },
                      { label: t('app.settings.ignoreLineBreaks'), checked: ignoreLineBreaks, onChange: setIgnoreLineBreaks },
                    ].map(({ label, checked, onChange }) => (
                      <label key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', cursor: 'pointer' }}>
                        <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ width: 15, height: 15, flexShrink: 0 }} />
                        <span style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.5 }}>{label}</span>
                      </label>
                    ))}
                  </div>
                  <div style={{ height: 1, background: 'var(--border)', margin: '2px 0 10px' }} />
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '6px 0', cursor: 'pointer' }}>
                    <input type="checkbox" checked={includeUnmappedPages} onChange={e => setIncludeUnmappedPages(e.target.checked)} style={{ width: 15, height: 15, flexShrink: 0, marginTop: 2 }} />
                    <span>
                      <span style={{ display: 'block', fontSize: 14, color: 'var(--text)', lineHeight: 1.5 }}>{t('app.settings.includeUnmapped')}</span>
                      <span style={{ display: 'block', fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{t('app.settings.includeUnmappedBody')}</span>
                    </span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '6px 0', cursor: 'pointer' }}>
                    <input type="checkbox" checked={enableOcr} onChange={e => setEnableOcr(e.target.checked)} style={{ width: 15, height: 15, flexShrink: 0, marginTop: 2 }} />
                    <span>
                      <span style={{ display: 'block', fontSize: 14, color: 'var(--text)', lineHeight: 1.5 }}>{t('app.settings.enableOcr')}</span>
                      <span style={{ display: 'block', fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{t('app.settings.enableOcrBody')}</span>
                    </span>
                  </label>
                </div>
              </AccordionSection>

              {/* Error */}
              {error && (
                <p style={{ fontSize: 13, color: 'var(--red)', textAlign: 'center', marginTop: 4 }}>{error}</p>
              )}

              {/* CTA */}
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={handleCompare}
                  disabled={!canCompare}
                  style={{
                    padding: '13px 44px', borderRadius: 8,
                    background: canCompare ? 'var(--accent)' : 'var(--surface-2)',
                    border: `2px solid ${canCompare ? 'var(--accent-hover)' : 'var(--border)'}`,
                    color: canCompare ? '#fff' : 'var(--text-3)',
                    fontSize: 16, fontWeight: 600,
                    cursor: canCompare ? 'pointer' : 'not-allowed',
                    transition: 'all 0.2s ease', letterSpacing: '-0.01em', fontFamily: 'inherit',
                    boxShadow: canCompare ? '0 2px 8px rgba(224,90,58,0.27)' : 'none',
                  }}
                >
                  {t('app.compareButton')}
                </button>
                {canCompare && originalFile && modifiedFile && (
                  <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                    {originalFile.name} ↔ {modifiedFile.name} · {pageCounts?.original} {L.pages}
                  </span>
                )}
              </div>
            </div>
          </>
        )}

        {/* LOADING VIEW */}
        {isLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '16rem' }}>
            <Spinner />
            <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--text)', marginTop: 16 }}>{t('app.analyzing')}</p>
            {ocrStatus && <p style={{ marginTop: 8, fontSize: 13, color: 'var(--blue)' }}>{ocrStatus}</p>}
            {progress && progress.total > 0 && (
              <div style={{ width: 256, marginTop: 16 }}>
                <div style={{ height: 6, width: '100%', background: 'var(--surface-2)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.round((progress.current / progress.total) * 100)}%`,
                    background: 'var(--accent)', borderRadius: 3, transition: 'width 0.3s ease',
                  }} />
                </div>
                <p style={{ marginTop: 4, fontSize: 11, color: 'var(--text-3)', textAlign: 'center' }}>
                  {t('app.progressPage', { current: progress.current, total: progress.total })}
                </p>
              </div>
            )}
          </div>
        )}

        {/* RESULTS VIEW */}
        {hasResults && originalFile && modifiedFile && pageMapping && (
          <>
            {comparisonSummary && (
              <ComparisonSummaryPanel
                summary={comparisonSummary}
                onExport={handleExportReport}
                isExporting={isExportingReport}
              />
            )}
            <ComparisonView
              textDiff={textDiff}
              visualDiff={visualDiff}
              originalFile={originalFile}
              modifiedFile={modifiedFile}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              pageMapping={pageMapping}
            />
          </>
        )}
      </main>
    </div>
  );
}

import React, { useState, useCallback, useEffect } from 'react';
import { FileUploader } from './components/ui/FileUploader';
import { ComparisonView } from './components/features/ComparisonView';
import { Spinner } from './components/ui/Spinner';
import { DocumentIcon, ArrowPathIcon } from './components/ui/icons';
import { LogoIzertis, LogoAbanca } from './components/ui/Logo';
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

export default function App() {
  const t = useT();
  const { locale } = useLanguage();
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

  // Efecto para obtener conteo de páginas y hashes
  useEffect(() => {
    if (originalFile && modifiedFile) {
      const processFiles = async () => {
        setIsHashing(true);
        try {
          const [originalCount, modifiedCount, hOriginal, hModified] = await Promise.all([
            getPdfPageCount(originalFile),
            getPdfPageCount(modifiedFile),
            calculateFileHash(originalFile),
            calculateFileHash(modifiedFile)
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
    // Los textos extraídos dependen de los archivos; invalidamos la caché cuando cambian.
    setExtractedTexts(null);
  }, [originalFile, modifiedFile, t]);

  useEffect(() => {
    if (pageCounts) {
      const defaultMapping: PageMapping = [];
      for (let i = 1; i <= pageCounts.original; i++) {
        if (i <= pageCounts.modified) {
          defaultMapping.push({ originalPage: i, modifiedPage: i });
        } else {
          // Convention: modifiedPage: 0 means this page was deleted (unmapped)
          defaultMapping.push({ originalPage: i, modifiedPage: 0 });
        }
      }
      setPageMapping(defaultMapping);
    } else {
      setPageMapping(null);
    }
  }, [pageCounts]);


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
        : await Promise.all([
            extractTextFromPdf(originalFile),
            extractTextFromPdf(modifiedFile),
          ]);

      if (enableOcr) {
        const pagesToOcrOriginal = pickPagesNeedingOcr(originalPages);
        const pagesToOcrModified = pickPagesNeedingOcr(modifiedPages);
        if (pagesToOcrOriginal.length || pagesToOcrModified.length) {
          setOcrStatus(
            t('app.ocr.running', { count: pagesToOcrOriginal.length + pagesToOcrModified.length })
          );
          const [origOcr, modOcr] = await Promise.all([
            runOcrOnPages(originalFile, pagesToOcrOriginal),
            runOcrOnPages(modifiedFile, pagesToOcrModified),
          ]);
          originalPages = originalPages.map((t, i) => origOcr.get(i + 1) ?? t);
          modifiedPages = modifiedPages.map((t, i) => modOcr.get(i + 1) ?? t);
        }
      }

      setExtractedTexts({ original: originalPages, modified: modifiedPages });
      setOcrStatus(null);

      const options: TextComparisonOptions = {
        includeUnmappedPages,
        normalization: {
          ignoreCase,
          ignoreWhitespace,
          ignoreLineBreaks,
        },
      };

      setProgress({ current: 0, total: pageMapping.length });
      const comparison = await buildTextComparisonAsync(
        originalPages,
        modifiedPages,
        pageMapping,
        options,
        (p) => setProgress({ current: p.current, total: p.total })
      );

      setTextDiff(comparison.diffResults);
      setComparisonSummary(comparison.summary);
      setVisualDiff({
        originalPageCount: originalPages.length,
        modifiedPageCount: modifiedPages.length,
      });

    } catch (err) {
      console.error('Comparación fallida:', err);
      setError(t('app.errors.compareFailed'));
    } finally {
      setIsLoading(false);
      setProgress(null);
      setOcrStatus(null);
    }
  }, [
    originalFile,
    modifiedFile,
    pageMapping,
    includeUnmappedPages,
    ignoreCase,
    ignoreWhitespace,
    ignoreLineBreaks,
    extractedTexts,
    enableOcr,
    t,
  ]);

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
    setOriginalFile(null);
    setModifiedFile(null);
    setTextDiff(null);
    setVisualDiff(null);
    setError(null);
    setIsLoading(false);
    setIsHashing(false);
    setPageCounts(null);
    setPageMapping(null);
    setHashes({ original: null, modified: null });
    setComparisonSummary(null);
    setExtractedTexts(null);
  };

  const hasResults = textDiff !== null || visualDiff !== null;
  const filesAreIdentical = !!(hashes.original && hashes.modified && hashes.original === hashes.modified);

  const handleExportReport = useCallback(async () => {
    if (!originalFile || !modifiedFile || !pageMapping) return;

    const options: TextComparisonOptions = {
      includeUnmappedPages,
      normalization: {
        ignoreCase,
        ignoreWhitespace,
        ignoreLineBreaks,
      },
    };

    setIsExportingReport(true);
    try {
      const visualDiffEntries = await buildVisualDiffReportEntries(
        originalFile,
        modifiedFile,
        pageMapping
      );

      const localeTag = locale === 'en' ? 'en-US' : 'es-ES';
      downloadComparisonReport({
        createdAt: new Date().toLocaleString(localeTag),
        locale,
        originalFileName: originalFile.name,
        modifiedFileName: modifiedFile.name,
        hashes,
        pageCounts,
        mapping: pageMapping,
        options,
        summary: comparisonSummary,
        textDiff,
        visualDiffEntries,
      });
    } catch (err) {
      console.error('Error exportando informe:', err);
      setError(t('app.errors.exportFailed'));
    } finally {
      setIsExportingReport(false);
    }
  }, [
    originalFile,
    modifiedFile,
    pageMapping,
    includeUnmappedPages,
    ignoreCase,
    ignoreWhitespace,
    ignoreLineBreaks,
    hashes,
    pageCounts,
    comparisonSummary,
    textDiff,
    t,
    locale,
  ]);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 antialiased">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center space-x-4">
              <a href="https://www.abanca.com/es/" target='_blank' rel="noopener noreferrer" className="flex items-center">
                <LogoAbanca className="h-8 w-auto" />
              </a>
              <div className="h-8 w-px bg-gray-200 hidden sm:block"></div>
              <div className="flex items-center space-x-2">
                <DocumentIcon className="h-7 w-7 text-indigo-600" />
                <h1 className="text-xl font-bold text-gray-900 tracking-tight">{t('app.title')}</h1>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {hasResults && (
                <button
                  onClick={handleReset}
                  className="flex items-center space-x-2 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-md hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                >
                  <ArrowPathIcon className="h-5 w-5" />
                  <span>{t('app.newComparison')}</span>
                </button>
              )}
              <LanguageSelector />
              <a href="https://www.izertis.com/es/" target='_blank'>
                <LogoIzertis className="h-10 w-auto" />
              </a>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-4 sm:p-6 lg:p-8">
        {!hasResults && !isLoading && (
          <div className="max-w-4xl mx-auto bg-white p-8 rounded-lg shadow-md">
            <h2 className="text-2xl font-semibold text-center mb-2">{t('app.heading')}</h2>
            <p className="text-center text-gray-600 mb-8">{t('app.uploadHint')}</p>
            <div className="grid md:grid-cols-2 gap-8 mb-8">
              <FileUploader
                file={originalFile}
                onFileSelect={setOriginalFile}
                label={t('app.uploadOriginal')}
                id="original-file"
              />
              <FileUploader
                file={modifiedFile}
                onFileSelect={setModifiedFile}
                label={t('app.uploadModified')}
                id="modified-file"
              />
            </div>
            
            {isHashing && (
              <div className="flex items-center justify-center p-4 mb-4 bg-indigo-50 rounded-lg text-indigo-700">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-700 mr-3"></div>
                <span className="text-sm font-medium">{t('app.hashing')}</span>
              </div>
            )}

            {filesAreIdentical && !isHashing && (
              <div className="p-4 mb-6 bg-amber-50 border-l-4 border-amber-400 rounded-r-md">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-amber-700 font-semibold">{t('app.identicalTitle')}</p>
                    <p className="text-sm text-amber-600">{t('app.identicalBody')}</p>
                  </div>
                </div>
              </div>
            )}

            {pageMapping && pageCounts && !filesAreIdentical && (
              <>
                <PageMapper
                  pageCounts={pageCounts}
                  mapping={pageMapping}
                  onMappingChange={setPageMapping}
                  onSuggestMapping={handleSuggestMapping}
                />

                <div className="mb-6 p-4 bg-white border border-gray-200 rounded-lg">
                  <label className="inline-flex items-start gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={includeUnmappedPages}
                      onChange={(e) => setIncludeUnmappedPages(e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-gray-800">{t('app.settings.includeUnmapped')}</span>
                      <span className="block text-sm text-gray-600">{t('app.settings.includeUnmappedBody')}</span>
                    </span>
                  </label>

                  <div className="mt-4 border-t border-gray-200 pt-4">
                    <p className="text-sm font-semibold text-gray-800 mb-2">{t('app.settings.normalization')}</p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={ignoreCase}
                          onChange={(e) => setIgnoreCase(e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        {t('app.settings.ignoreCase')}
                      </label>
                      <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={ignoreWhitespace}
                          onChange={(e) => setIgnoreWhitespace(e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        {t('app.settings.ignoreWhitespace')}
                      </label>
                      <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={ignoreLineBreaks}
                          onChange={(e) => setIgnoreLineBreaks(e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        {t('app.settings.ignoreLineBreaks')}
                      </label>
                    </div>
                  </div>

                  <div className="mt-4 border-t border-gray-200 pt-4">
                    <label className="inline-flex items-start gap-3 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={enableOcr}
                        onChange={(e) => setEnableOcr(e.target.checked)}
                        className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>
                        <span className="block text-sm font-semibold text-gray-800">{t('app.settings.enableOcr')}</span>
                        <span className="block text-sm text-gray-600">{t('app.settings.enableOcrBody')}</span>
                      </span>
                    </label>
                  </div>
                </div>
              </>
            )}

            {error && <p className="text-red-600 text-center mb-4">{error}</p>}
            
            <div className="text-center">
              <button
                onClick={handleCompare}
                disabled={!originalFile || !modifiedFile || isLoading || isHashing || !pageMapping || filesAreIdentical}
                className="w-full md:w-auto px-8 py-3 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-transform transform hover:scale-105"
              >
                {isLoading ? t('app.comparing') : isHashing ? t('app.verifying') : t('app.compareButton')}
              </button>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="flex flex-col items-center justify-center h-64">
            <Spinner />
            <p className="text-lg font-medium text-gray-700 mt-4">{t('app.analyzing')}</p>
            {ocrStatus && <p className="mt-2 text-sm text-indigo-700">{ocrStatus}</p>}
            {progress && progress.total > 0 && (
              <div className="w-64 mt-4">
                <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-600 transition-all"
                    style={{ width: `${Math.round((progress.current / progress.total) * 100)}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500 text-center">
                  {t('app.progressPage', { current: progress.current, total: progress.total })}
                </p>
              </div>
            )}
          </div>
        )}

        {hasResults && originalFile && modifiedFile && pageMapping && (
          <>
            {comparisonSummary && <ComparisonSummaryPanel summary={comparisonSummary} />}
            <div className="mb-4 flex justify-end">
              <button
                onClick={handleExportReport}
                disabled={isExportingReport}
                className="px-4 py-2 text-sm font-semibold rounded-md border border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isExportingReport ? t('app.exportingReport') : t('app.exportReport')}
              </button>
            </div>
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

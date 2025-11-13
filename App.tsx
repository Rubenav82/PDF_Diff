import React, { useState, useCallback, useEffect } from 'react';
import { diffChars } from 'diff';
import { FileUploader } from './components/FileUploader';
import { ComparisonView } from './components/ComparisonView';
import { Spinner } from './components/Spinner';
import { DocumentIcon, ArrowPathIcon } from './components/icons';
import { getPdfPageCount, extractTextFromPdf } from './services/pdfService';
import type { ViewMode, TextDiffResult, VisualDiffResult, PageMapping } from './types';
import { PageMapper } from './components/PageMapper';

export default function App() {
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [modifiedFile, setModifiedFile] = useState<File | null>(null);
  const [textDiff, setTextDiff] = useState<TextDiffResult[] | null>(null);
  const [visualDiff, setVisualDiff] = useState<VisualDiffResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('text');

  const [pageCounts, setPageCounts] = useState<{ original: number; modified: number } | null>(null);
  const [pageMapping, setPageMapping] = useState<PageMapping | null>(null);

  useEffect(() => {
    if (originalFile && modifiedFile) {
      const fetchCounts = async () => {
        try {
          // No mostrar el spinner principal para esta carga inicial de conteo
          const [original, modified] = await Promise.all([
            getPdfPageCount(originalFile),
            getPdfPageCount(modifiedFile),
          ]);
          setPageCounts({ original, modified });
          setError(null);
        } catch (err) {
          setError('No se pudo leer el número de páginas de uno de los PDF.');
          console.error(err);
        }
      };
      fetchCounts();
    } else {
      setPageCounts(null);
    }
  }, [originalFile, modifiedFile]);

  useEffect(() => {
    if (pageCounts) {
      const defaultMapping: PageMapping = [];
      for (let i = 1; i <= pageCounts.original; i++) {
        // Mapeo 1 a 1 por defecto donde sea posible
        if (i <= pageCounts.modified) {
          defaultMapping.push({ originalPage: i, modifiedPage: i });
        } else {
          // La página original no tiene una página modificada correspondiente (eliminada)
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
      setError('Por favor, seleccione los PDF y configure el mapeo de páginas.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setTextDiff(null);
    setVisualDiff(null);

    try {
      const [originalPages, modifiedPages] = await Promise.all([
        extractTextFromPdf(originalFile),
        extractTextFromPdf(modifiedFile),
      ]);

      const diffResults: TextDiffResult[] = [];

      for (const mapping of pageMapping) {
        // Solo comparar si hay una página modificada válida asignada
        if (mapping.modifiedPage > 0 && mapping.modifiedPage <= modifiedPages.length) {
          const originalText = originalPages[mapping.originalPage - 1] || '';
          const modifiedText = modifiedPages[mapping.modifiedPage - 1] || '';
          
          if (originalText !== modifiedText) {
            const pageDiff = diffChars(originalText, modifiedText);
            // La 'página' en el resultado se refiere a la página del documento original
            diffResults.push({ page: mapping.originalPage, diff: pageDiff });
          }
        }
      }
      
      setTextDiff(diffResults);
      setVisualDiff({
        originalPageCount: originalPages.length,
        modifiedPageCount: modifiedPages.length,
      });

    } catch (err) {
      console.error('Comparación fallida:', err);
      setError('Ocurrió un error al procesar los PDF. Por favor, asegúrese de que sean archivos válidos.');
    } finally {
      setIsLoading(false);
    }
  }, [originalFile, modifiedFile, pageMapping]);

  const handleReset = () => {
    setOriginalFile(null);
    setModifiedFile(null);
    setTextDiff(null);
    setVisualDiff(null);
    setError(null);
    setIsLoading(false);
    setPageCounts(null);
    setPageMapping(null);
  };

  const hasResults = textDiff !== null || visualDiff !== null;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 antialiased">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <DocumentIcon className="h-8 w-8 text-indigo-600" />
              <h1 className="text-xl font-bold text-gray-900">PDF Diferencias Documentos</h1>
            </div>
            {hasResults && (
              <button
                onClick={handleReset}
                className="flex items-center space-x-2 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-md hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
              >
                <ArrowPathIcon className="h-5 w-5" />
                <span>Comenzar Nueva Comparación</span>
              </button>
            )}
            <img className="h-16 w-auto" alt="Izertis" id="logoIzertis" loading="lazy" src="/public/img/izertis.png"/>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-4 sm:p-6 lg:p-8">
        {!hasResults && !isLoading && (
          <div className="max-w-4xl mx-auto bg-white p-8 rounded-lg shadow-md">
            <h2 className="text-2xl font-semibold text-center mb-2">Comparar 2 Documentos PDF</h2>
            <p className="text-center text-gray-600 mb-8">
              Carga una versión original y una modificada de tu PDF para ver una comparación detallada de los cambios en el texto y el diseño.
            </p>
            <div className="grid md:grid-cols-2 gap-8 mb-8">
              <FileUploader
                file={originalFile}
                onFileSelect={setOriginalFile}
                label="Documento Original"
                id="original-file"
              />
              <FileUploader
                file={modifiedFile}
                onFileSelect={setModifiedFile}
                label="Documento Modificado"
                id="modified-file"
              />
            </div>
            
            {pageMapping && pageCounts && (
              <PageMapper
                pageCounts={pageCounts}
                mapping={pageMapping}
                onMappingChange={setPageMapping}
              />
            )}

            {error && <p className="text-red-600 text-center mb-4">{error}</p>}
            <div className="text-center">
              <button
                onClick={handleCompare}
                disabled={!originalFile || !modifiedFile || isLoading || !pageMapping}
                className="w-full md:w-auto px-8 py-3 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-transform transform hover:scale-105"
              >
                {isLoading ? 'Comparando...' : 'Comparar Documentos'}
              </button>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="flex flex-col items-center justify-center h-64">
            <Spinner />
            <p className="text-lg font-medium text-gray-700 mt-4">Analizando tus documentos...</p>
          </div>
        )}

        {hasResults && originalFile && modifiedFile && pageMapping && (
          <ComparisonView
            textDiff={textDiff}
            visualDiff={visualDiff}
            originalFile={originalFile}
            modifiedFile={modifiedFile}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            pageMapping={pageMapping}
          />
        )}
      </main>
    </div>
  );
}
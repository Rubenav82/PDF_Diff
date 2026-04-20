import React, { useState, useEffect, useRef, useCallback } from 'react';
import { renderPageToCanvas } from '../../lib/pdfService';
import { runPixelDiff } from '../../lib/workerClients';
import { Spinner } from '../ui/Spinner';
import { useSyncedZoom } from '../../hooks/useSyncedZoom';
import type { PageMapping } from '../../types/types';
import { useT } from '../../i18n/useT';

interface VisualDiffViewProps {
  originalFile: File;
  modifiedFile: File;
  pageMapping: PageMapping;
}

interface RenderTaskCancellable {
    cancel: () => void;
}

export const VisualDiffView: React.FC<VisualDiffViewProps> = ({ originalFile, modifiedFile, pageMapping }) => {
  const t = useT();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diffPixels, setDiffPixels] = useState(0);

  const originalCanvasRef = useRef<HTMLCanvasElement>(null);
  const modifiedCanvasRef = useRef<HTMLCanvasElement>(null);
  const diffCanvasRef = useRef<HTMLCanvasElement>(null);
  const activeRenderTasks = useRef<RenderTaskCancellable[]>([]);
  const requestIdRef = useRef(0);

  const zoom = useSyncedZoom();
  const { reset: resetZoom } = zoom;

  const currentMapEntry = pageMapping[currentIndex];

  const drawDiff = useCallback(async (originalPageNum: number, modifiedPageNum: number) => {
    // Track request ID to prevent stale renders from updating state if user navigates away
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;

    // Cancel any in-flight render tasks from the previous page view
    activeRenderTasks.current.forEach(task => task.cancel());
    activeRenderTasks.current = [];

    setIsLoading(true);
    setError(null);
    setDiffPixels(0);

    const originalCanvas = originalCanvasRef.current;
    const modifiedCanvas = modifiedCanvasRef.current;
    const diffCanvas = diffCanvasRef.current;

    if (!originalCanvas || !modifiedCanvas || !diffCanvas) {
      setIsLoading(false);
      return;
    }

    // Limpiar lienzos previos
    const canvases = [originalCanvas, modifiedCanvas, diffCanvas];
    canvases.forEach(c => {
        const ctx = c.getContext('2d');
        if (ctx) {
            ctx.clearRect(0, 0, c.width, c.height);
        }
        c.width = 1; // Restablecer para evitar mostrar imagen anterior
        c.height = 1;
    });

    try {
        const originalRender = renderPageToCanvas(originalFile, originalPageNum, originalCanvas);
        const modifiedRender = renderPageToCanvas(modifiedFile, modifiedPageNum, modifiedCanvas);
        
        activeRenderTasks.current.push(originalRender, modifiedRender);

        await Promise.all([
            originalRender.promise,
            modifiedRender.promise,
        ]);

      // If user navigated to a different page while renders were in progress, abort stale render
      if (requestId !== requestIdRef.current) {
        return;
      }
      
      const width = Math.max(originalCanvas.width, modifiedCanvas.width);
      const height = Math.max(originalCanvas.height, modifiedCanvas.height);

      if (width <= 1 || height <= 1) { // width/height pueden ser 1 por el reseteo
        setDiffPixels(0);
        return;
      }

      diffCanvas.width = width;
      diffCanvas.height = height;
      const diffCtx = diffCanvas.getContext('2d');
      if (!diffCtx) {
        throw new Error('No se pudo obtener el contexto del lienzo de diferencias.');
      }
      
      const tempOriginalCanvas = document.createElement('canvas');
      tempOriginalCanvas.width = width;
      tempOriginalCanvas.height = height;
      const tempOriginalCtx = tempOriginalCanvas.getContext('2d');
      if (!tempOriginalCtx) throw new Error("No se pudo obtener temporalmente contexto del lienzo.");
      tempOriginalCtx.drawImage(originalCanvas, 0, 0);
      const originalImageData = tempOriginalCtx.getImageData(0, 0, width, height);

      const tempModifiedCanvas = document.createElement('canvas');
      tempModifiedCanvas.width = width;
      tempModifiedCanvas.height = height;
      const tempModifiedCtx = tempModifiedCanvas.getContext('2d');
      if (!tempModifiedCtx) throw new Error("No se pudo obtener temporalmente contexto del lienzo.");
      tempModifiedCtx.drawImage(modifiedCanvas, 0, 0);
      const modifiedImageData = tempModifiedCtx.getImageData(0, 0, width, height);
      
      const { diffPixels: numDiffPixels, diffImageData } = await runPixelDiff(
        originalImageData.data,
        modifiedImageData.data,
        width,
        height,
        { threshold: 0.1, includeAA: true }
      );

      if (requestId !== requestIdRef.current) {
        return;
      }

      const canvasImageData = diffCtx.createImageData(width, height);
      canvasImageData.data.set(diffImageData);
      diffCtx.putImageData(canvasImageData, 0, 0);
      setDiffPixels(numDiffPixels);

    } catch (err: unknown) {
        if (
          err instanceof Error &&
          err.name !== 'RenderingCancelledException' &&
          err.name !== 'AbortError' &&
          requestId === requestIdRef.current
        ) {
          setError(`Error renderizando par de páginas (${originalPageNum}, ${modifiedPageNum}): ${err.message}`);
          console.error(err);
        }
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [originalFile, modifiedFile]);

  useEffect(() => {
    if (currentMapEntry) {
        drawDiff(currentMapEntry.originalPage, currentMapEntry.modifiedPage);
    }
    resetZoom();

    // Función de limpieza para cancelar renderizados en curso
    return () => {
        activeRenderTasks.current.forEach(task => task.cancel());
        activeRenderTasks.current = [];
    };
  }, [currentMapEntry, drawDiff, resetZoom]);
  
  if (pageMapping.length === 0) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-gray-900">{t('visual.noPagesTitle')}</h3>
        <p className="mt-1 text-sm text-gray-500">{t('visual.noPagesBody')}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between mb-4 bg-gray-50 p-3 rounded-md gap-4">
        <h3 className="text-lg font-medium text-gray-900">
            {t('visual.comparingHeader', { original: currentMapEntry.originalPage, modified: currentMapEntry.modifiedPage })}
            <span className="text-sm font-normal text-gray-600 ml-2">{t('visual.progressCount', { current: currentIndex + 1, total: pageMapping.length })}</span>
        </h3>
        <div className="flex items-center space-x-2">
            <button
                onClick={() => setCurrentIndex(p => Math.max(0, p - 1))}
                disabled={currentIndex === 0 || isLoading}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
                {t('visual.prev')}
            </button>
            <button
                onClick={() => setCurrentIndex(p => Math.min(pageMapping.length - 1, p + 1))}
                disabled={currentIndex === pageMapping.length - 1 || isLoading}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
                {t('visual.next')}
            </button>
        </div>
      </div>

      {isLoading && (
          <div className="flex items-center justify-center h-96">
            <Spinner />
            <p className="ml-4">{t('visual.loading')}</p>
          </div>
        )
      }
      {error && <p className="text-red-600">{error}</p>}

      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <p className="text-xs text-gray-500">{t('visual.zoomHint')}</p>
        <div className="flex items-center space-x-1">
          <button
            type="button"
            onClick={zoom.zoomOut}
            className="px-3 py-1 text-sm font-medium bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            aria-label={t('visual.zoomOut')}
          >
            −
          </button>
          <span className="text-xs font-mono text-gray-600 w-14 text-center tabular-nums">
            {Math.round(zoom.zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={zoom.zoomIn}
            className="px-3 py-1 text-sm font-medium bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            aria-label={t('visual.zoomIn')}
          >
            +
          </button>
          <button
            type="button"
            onClick={zoom.reset}
            className="ml-2 px-3 py-1 text-sm font-medium bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            {t('visual.zoomReset')}
          </button>
        </div>
      </div>

      <div
        ref={zoom.containerRef}
        className={`grid lg:grid-cols-3 gap-6 transition-opacity ${isLoading ? 'opacity-50' : 'opacity-100'}`}
        onMouseDown={zoom.dragHandlers.onMouseDown}
        onMouseMove={zoom.dragHandlers.onMouseMove}
        onMouseUp={zoom.dragHandlers.onMouseUp}
        onMouseLeave={zoom.dragHandlers.onMouseLeave}
        style={{ cursor: zoom.isDragging ? 'grabbing' : zoom.zoom > 1 ? 'grab' : 'default' }}
      >
        <div className="border rounded-lg p-2 shadow-sm">
            <h4 className="font-bold text-center mb-2">{t('visual.originalPage', { page: currentMapEntry.originalPage })}</h4>
            <div className="overflow-hidden">
              <canvas
                ref={originalCanvasRef}
                className="w-full h-auto select-none"
                style={{ transform: zoom.transform, transformOrigin: '0 0' }}
              />
            </div>
        </div>
        <div className="border rounded-lg p-2 shadow-sm">
            <h4 className="font-bold text-center mb-2">{t('visual.modifiedPage', { page: currentMapEntry.modifiedPage })}</h4>
            <div className="overflow-hidden">
              <canvas
                ref={modifiedCanvasRef}
                className="w-full h-auto select-none"
                style={{ transform: zoom.transform, transformOrigin: '0 0' }}
              />
            </div>
        </div>
        <div className="border rounded-lg p-2 shadow-sm bg-gray-50">
            <h4 className="font-bold text-center mb-2">{t('visual.diff')}</h4>
            <div className="mb-2 text-center text-sm p-2 rounded-md bg-yellow-100 text-yellow-800">
              {diffPixels > 0 ? t('visual.diffPixels', { count: diffPixels }) : t('visual.noVisualDiff')}
            </div>
            <div className="overflow-hidden">
              <canvas
                ref={diffCanvasRef}
                className="w-full h-auto select-none"
                style={{ transform: zoom.transform, transformOrigin: '0 0' }}
              />
            </div>
        </div>
      </div>
    </div>
  );
};
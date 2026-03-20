import React, { useState, useEffect, useRef, useCallback } from 'react';
import pixelmatch from 'pixelmatch';
import { renderPageToCanvas } from '../../lib/pdfService';
import { Spinner } from '../ui/Spinner';
import type { PageMapping } from '../../types/types';

interface VisualDiffViewProps {
  originalFile: File;
  modifiedFile: File;
  pageMapping: PageMapping;
}

interface RenderTaskCancellable {
    cancel: () => void;
}

export const VisualDiffView: React.FC<VisualDiffViewProps> = ({ originalFile, modifiedFile, pageMapping }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diffPixels, setDiffPixels] = useState(0);

  const originalCanvasRef = useRef<HTMLCanvasElement>(null);
  const modifiedCanvasRef = useRef<HTMLCanvasElement>(null);
  const diffCanvasRef = useRef<HTMLCanvasElement>(null);
  const activeRenderTasks = useRef<RenderTaskCancellable[]>([]);

  const currentMapEntry = pageMapping[currentIndex];

  const drawDiff = useCallback(async (originalPageNum: number, modifiedPageNum: number) => {
    setIsLoading(true);
    setError(null);
    setDiffPixels(0);

    const originalCanvas = originalCanvasRef.current;
    const modifiedCanvas = modifiedCanvasRef.current;
    const diffCanvas = diffCanvasRef.current;

    if (!originalCanvas || !modifiedCanvas || !diffCanvas) return;

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
      
      const diffImageData = diffCtx.createImageData(width, height);
      
      const numDiffPixels = pixelmatch(
        originalImageData.data,
        modifiedImageData.data,
        diffImageData.data,
        width,
        height,
        { threshold: 0.1, includeAA: true }
      );
      
      diffCtx.putImageData(diffImageData, 0, 0);
      setDiffPixels(numDiffPixels);

    } catch (err: unknown) {
        if (err instanceof Error && err.name !== 'RenderingCancelledException') {
            setError(`Error renderizando par de páginas (${originalPageNum}, ${modifiedPageNum}): ${err.message}`);
            console.error(err);
        }
    } finally {
      setIsLoading(false);
    }
  }, [originalFile, modifiedFile]);

  useEffect(() => {
    if (currentMapEntry) {
        drawDiff(currentMapEntry.originalPage, currentMapEntry.modifiedPage);
    }
    
    // Función de limpieza para cancelar renderizados en curso
    return () => {
        activeRenderTasks.current.forEach(task => task.cancel());
        activeRenderTasks.current = [];
    };
  }, [currentMapEntry, drawDiff]);
  
  if (pageMapping.length === 0) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-gray-900">Sin páginas para la comparación visual</h3>
        <p className="mt-1 text-sm text-gray-500">No se definieron mapeos de páginas válidos (p. ej., todas las páginas originales fueron marcadas como eliminadas).</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between mb-4 bg-gray-50 p-3 rounded-md gap-4">
        <h3 className="text-lg font-medium text-gray-900">
            Comparando: Original Pág. {currentMapEntry.originalPage} vs. Modificada Pág. {currentMapEntry.modifiedPage}
            <span className="text-sm font-normal text-gray-600 ml-2">({currentIndex + 1} de {pageMapping.length})</span>
        </h3>
        <div className="flex items-center space-x-2">
            <button
                onClick={() => setCurrentIndex(p => Math.max(0, p - 1))}
                disabled={currentIndex === 0 || isLoading}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
                Anterior
            </button>
            <button
                onClick={() => setCurrentIndex(p => Math.min(pageMapping.length - 1, p + 1))}
                disabled={currentIndex === pageMapping.length - 1 || isLoading}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
                Siguiente
            </button>
        </div>
      </div>

      {isLoading && (
          <div className="flex items-center justify-center h-96">
            <Spinner />
            <p className="ml-4">Renderizando y comparando páginas...</p>
          </div>
        )
      }
      {error && <p className="text-red-600">{error}</p>}
      
      <div className={`grid lg:grid-cols-3 gap-6 transition-opacity ${isLoading ? 'opacity-50' : 'opacity-100'}`}>
        <div className="border rounded-lg p-2 shadow-sm">
            <h4 className="font-bold text-center mb-2">Original (Pág. {currentMapEntry.originalPage})</h4>
            <canvas ref={originalCanvasRef} className="w-full h-auto" />
        </div>
        <div className="border rounded-lg p-2 shadow-sm">
            <h4 className="font-bold text-center mb-2">Modificado (Pág. {currentMapEntry.modifiedPage})</h4>
            <canvas ref={modifiedCanvasRef} className="w-full h-auto" />
        </div>
        <div className="border rounded-lg p-2 shadow-sm bg-gray-50">
            <h4 className="font-bold text-center mb-2">Diferencias</h4>
            <div className="mb-2 text-center text-sm p-2 rounded-md bg-yellow-100 text-yellow-800">
              {diffPixels > 0 ? `${diffPixels} píxeles diferentes.` : 'No se detectaron diferencias visuales.'}
            </div>
            <canvas ref={diffCanvasRef} className="w-full h-auto" />
        </div>
      </div>
    </div>
  );
};
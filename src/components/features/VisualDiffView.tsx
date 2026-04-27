import React, { useState, useEffect, useRef, useCallback } from 'react';
import { renderPageToCanvas } from '../../lib/pdfService';
import { runPixelDiff } from '../../lib/workerClients';
import { Spinner } from '../ui/Spinner';
import { useSyncedZoom } from '../../hooks/useSyncedZoom';
import type { PageMapping } from '../../types/types';
import { useT } from '../../i18n/useT';
import { ChevronLeftIcon, ChevronRightIcon } from '../ui/icons';

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
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;

    activeRenderTasks.current.forEach(task => task.cancel());
    activeRenderTasks.current = [];

    setIsLoading(true);
    setError(null);
    setDiffPixels(0);

    const originalCanvas = originalCanvasRef.current;
    const modifiedCanvas = modifiedCanvasRef.current;
    const diffCanvas = diffCanvasRef.current;
    if (!originalCanvas || !modifiedCanvas || !diffCanvas) { setIsLoading(false); return; }

    [originalCanvas, modifiedCanvas, diffCanvas].forEach(c => {
      const ctx = c.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, c.width, c.height);
      c.width = 1; c.height = 1;
    });

    try {
      const originalRender = renderPageToCanvas(originalFile, originalPageNum, originalCanvas);
      const modifiedRender = renderPageToCanvas(modifiedFile, modifiedPageNum, modifiedCanvas);
      activeRenderTasks.current.push(originalRender, modifiedRender);
      await Promise.all([originalRender.promise, modifiedRender.promise]);

      if (requestId !== requestIdRef.current) return;

      const width = Math.max(originalCanvas.width, modifiedCanvas.width);
      const height = Math.max(originalCanvas.height, modifiedCanvas.height);
      if (width <= 1 || height <= 1) { setDiffPixels(0); return; }

      diffCanvas.width = width; diffCanvas.height = height;
      const diffCtx = diffCanvas.getContext('2d');
      if (!diffCtx) throw new Error('No se pudo obtener el contexto del lienzo de diferencias.');

      const tempOrig = document.createElement('canvas'); tempOrig.width = width; tempOrig.height = height;
      const ctxOrig = tempOrig.getContext('2d')!;
      ctxOrig.drawImage(originalCanvas, 0, 0);
      const origData = ctxOrig.getImageData(0, 0, width, height);

      const tempMod = document.createElement('canvas'); tempMod.width = width; tempMod.height = height;
      const ctxMod = tempMod.getContext('2d')!;
      ctxMod.drawImage(modifiedCanvas, 0, 0);
      const modData = ctxMod.getImageData(0, 0, width, height);

      const { diffPixels: numDiff, diffImageData } = await runPixelDiff(
        origData.data, modData.data, width, height, { threshold: 0.1, includeAA: true }
      );

      if (requestId !== requestIdRef.current) return;

      const canvasData = diffCtx.createImageData(width, height);
      canvasData.data.set(diffImageData);
      diffCtx.putImageData(canvasData, 0, 0);
      setDiffPixels(numDiff);
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'RenderingCancelledException' && err.name !== 'AbortError' && requestId === requestIdRef.current) {
        setError(`Error renderizando par de páginas (${originalPageNum}, ${modifiedPageNum}): ${err.message}`);
        console.error(err);
      }
    } finally {
      if (requestId === requestIdRef.current) setIsLoading(false);
    }
  }, [originalFile, modifiedFile]);

  useEffect(() => {
    if (currentMapEntry) drawDiff(currentMapEntry.originalPage, currentMapEntry.modifiedPage);
    resetZoom();
    return () => { activeRenderTasks.current.forEach(task => task.cancel()); activeRenderTasks.current = []; };
  }, [currentMapEntry, drawDiff, resetZoom]);

  if (pageMapping.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 16px' }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>{t('visual.noPagesTitle')}</h3>
        <p style={{ fontSize: 14, color: 'var(--text-3)' }}>{t('visual.noPagesBody')}</p>
      </div>
    );
  }

  const navBtnStyle = (disabled: boolean) => ({
    display: 'flex', alignItems: 'center', gap: 5,
    padding: '6px 12px', borderRadius: 6,
    border: '1.5px solid var(--border-strong)',
    background: disabled ? 'var(--surface-2)' : 'var(--surface)',
    color: disabled ? 'var(--text-3)' : 'var(--text)',
    fontSize: 13, fontWeight: 500 as const,
    cursor: disabled ? 'not-allowed' as const : 'pointer' as const,
    fontFamily: 'inherit', transition: 'background 0.2s ease',
  });

  return (
    <div>
      {/* Nav row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
          {t('visual.comparingHeader', { original: currentMapEntry.originalPage, modified: currentMapEntry.modifiedPage })}
          {' '}
          <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-3)' }}>
            {t('visual.progressCount', { current: currentIndex + 1, total: pageMapping.length })}
          </span>
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setCurrentIndex(p => Math.max(0, p - 1))} disabled={currentIndex === 0 || isLoading} style={navBtnStyle(currentIndex === 0 || isLoading)}>
            <ChevronLeftIcon />{t('visual.prev')}
          </button>
          <button onClick={() => setCurrentIndex(p => Math.min(pageMapping.length - 1, p + 1))} disabled={currentIndex === pageMapping.length - 1 || isLoading} style={navBtnStyle(currentIndex === pageMapping.length - 1 || isLoading)}>
            {t('visual.next')}<ChevronRightIcon />
          </button>
        </div>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 14 }}>{t('visual.zoomHint')}</p>

      {/* Zoom controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginBottom: 12 }}>
        <button type="button" onClick={zoom.zoomOut} aria-label={t('visual.zoomOut')} style={{ width: 28, height: 28, borderRadius: 5, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text)', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontFamily: 'inherit' }}>−</button>
        <span style={{ fontSize: 12, color: 'var(--text-2)', minWidth: 40, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{Math.round(zoom.zoom * 100)}%</span>
        <button type="button" onClick={zoom.zoomIn} aria-label={t('visual.zoomIn')} style={{ width: 28, height: 28, borderRadius: 5, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text)', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontFamily: 'inherit' }}>+</button>
        <button type="button" onClick={zoom.reset} style={{ padding: '5px 10px', borderRadius: 5, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-2)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>{t('visual.zoomReset')}</button>
      </div>

      {isLoading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '24rem' }}>
          <Spinner />
          <p style={{ marginLeft: 16, color: 'var(--text-2)' }}>{t('visual.loading')}</p>
        </div>
      )}
      {error && <p style={{ color: 'var(--red)', fontSize: 13 }}>{error}</p>}

      {/* Three-column canvas grid */}
      <div
        ref={zoom.containerRef}
        style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14,
          opacity: isLoading ? 0.5 : 1, transition: 'opacity 0.2s ease',
          cursor: zoom.isDragging ? 'grabbing' : zoom.zoom > 1 ? 'grab' : 'default',
        }}
        onMouseDown={zoom.dragHandlers.onMouseDown}
        onMouseMove={zoom.dragHandlers.onMouseMove}
        onMouseUp={zoom.dragHandlers.onMouseUp}
        onMouseLeave={zoom.dragHandlers.onMouseLeave}
      >
        {[
          { ref: originalCanvasRef, label: t('visual.originalPage', { page: currentMapEntry.originalPage }), extra: null },
          { ref: modifiedCanvasRef, label: t('visual.modifiedPage', { page: currentMapEntry.modifiedPage }), extra: null },
          {
            ref: diffCanvasRef, label: t('visual.diff'),
            extra: (
              <div style={{ marginBottom: 8, padding: '6px 10px', background: '#fef9c3', border: '1px solid #fcd34d', borderRadius: 5, fontSize: 12, color: '#92400e', fontWeight: 500, textAlign: 'center' as const }}>
                {diffPixels > 0 ? t('visual.diffPixels', { count: diffPixels }) : t('visual.noVisualDiff')}
              </div>
            ),
          },
        ].map(({ ref, label, extra }) => (
          <div key={label}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', textAlign: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
              {label}
            </div>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 4, padding: '14px 16px', minHeight: 320 }}>
              {extra}
              <div style={{ overflow: 'hidden' }}>
                <canvas ref={ref} className="w-full h-auto select-none" style={{ transform: zoom.transform, transformOrigin: '0 0' }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

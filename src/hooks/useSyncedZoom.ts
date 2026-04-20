import { useCallback, useEffect, useRef, useState } from 'react';

export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 8;
export const ZOOM_STEP = 1.15;

export interface ZoomState {
  zoom: number;
  panX: number;
  panY: number;
}

export const INITIAL_ZOOM_STATE: ZoomState = { zoom: 1, panX: 0, panY: 0 };

export function clampZoom(z: number): number {
  if (!Number.isFinite(z)) return 1;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
}

export function zoomAroundPoint(
  prev: ZoomState,
  nextZoom: number,
  focalX: number,
  focalY: number
): ZoomState {
  const clamped = clampZoom(nextZoom);
  if (clamped === prev.zoom) return prev;
  const ratio = clamped / prev.zoom;
  return {
    zoom: clamped,
    panX: focalX - (focalX - prev.panX) * ratio,
    panY: focalY - (focalY - prev.panY) * ratio,
  };
}

export function applyPan(prev: ZoomState, dx: number, dy: number): ZoomState {
  return { ...prev, panX: prev.panX + dx, panY: prev.panY + dy };
}

export function zoomAboutCenter(prev: ZoomState, nextZoom: number): ZoomState {
  const clamped = clampZoom(nextZoom);
  if (clamped === prev.zoom) return prev;
  return { ...prev, zoom: clamped };
}

export interface SyncedZoom extends ZoomState {
  containerRef: React.RefObject<HTMLDivElement | null>;
  transform: string;
  isDragging: boolean;
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
  dragHandlers: {
    onMouseDown: (e: React.MouseEvent<HTMLElement>) => void;
    onMouseMove: (e: React.MouseEvent<HTMLElement>) => void;
    onMouseUp: () => void;
    onMouseLeave: () => void;
  };
}

export function useSyncedZoom(): SyncedZoom {
  const [state, setState] = useState<ZoomState>(INITIAL_ZOOM_STATE);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastMouse = useRef<{ x: number; y: number } | null>(null);

  const zoomIn = useCallback(() => {
    setState((prev) => zoomAboutCenter(prev, prev.zoom * ZOOM_STEP));
  }, []);

  const zoomOut = useCallback(() => {
    setState((prev) => zoomAboutCenter(prev, prev.zoom / ZOOM_STEP));
  }, []);

  const reset = useCallback(() => {
    setState(INITIAL_ZOOM_STATE);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const focalX = e.clientX - rect.left;
      const focalY = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
      setState((prev) => zoomAroundPoint(prev, prev.zoom * factor, focalX, focalY));
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  const onMouseDown = useCallback((e: React.MouseEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    lastMouse.current = { x: e.clientX, y: e.clientY };
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLElement>) => {
    if (!lastMouse.current) return;
    const dx = e.clientX - lastMouse.current.x;
    const dy = e.clientY - lastMouse.current.y;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    setState((prev) => applyPan(prev, dx, dy));
  }, []);

  const endDrag = useCallback(() => {
    setIsDragging(false);
    lastMouse.current = null;
  }, []);

  const transform = `translate(${state.panX}px, ${state.panY}px) scale(${state.zoom})`;

  return {
    ...state,
    containerRef,
    transform,
    isDragging,
    zoomIn,
    zoomOut,
    reset,
    dragHandlers: {
      onMouseDown,
      onMouseMove,
      onMouseUp: endDrag,
      onMouseLeave: endDrag,
    },
  };
}

import { describe, it, expect } from 'vitest';
import {
  clampZoom,
  zoomAroundPoint,
  zoomAboutCenter,
  applyPan,
  INITIAL_ZOOM_STATE,
  MIN_ZOOM,
  MAX_ZOOM,
} from '../useSyncedZoom';

describe('clampZoom', () => {
  it('keeps values within the allowed range untouched', () => {
    expect(clampZoom(1)).toBe(1);
    expect(clampZoom(2.5)).toBe(2.5);
  });

  it('clamps values below the minimum', () => {
    expect(clampZoom(0.1)).toBe(MIN_ZOOM);
  });

  it('clamps values above the maximum', () => {
    expect(clampZoom(9999)).toBe(MAX_ZOOM);
  });

  it('returns 1 for non-finite inputs', () => {
    expect(clampZoom(Number.NaN)).toBe(1);
    expect(clampZoom(Number.POSITIVE_INFINITY)).toBe(1);
  });
});

describe('zoomAroundPoint', () => {
  it('returns the same state when the clamped zoom does not change', () => {
    const result = zoomAroundPoint(INITIAL_ZOOM_STATE, 10 * MAX_ZOOM, 100, 100);
    const boundary = { ...INITIAL_ZOOM_STATE, zoom: MAX_ZOOM };
    // First bump to MAX_ZOOM, then zoom beyond — should be a no-op
    const again = zoomAroundPoint(boundary, MAX_ZOOM * 2, 100, 100);
    expect(again).toBe(boundary);
    // From initial, zoom goes to MAX_ZOOM
    expect(result.zoom).toBe(MAX_ZOOM);
  });

  it('keeps the focal point stationary on screen', () => {
    // Start at zoom 1, pan (0,0). Zoom to 2 around (200, 150).
    // At zoom 1: focal point in image coords = (200, 150)
    // After zoom to 2: panX' = 200 - (200 - 0) * 2 = -200. Check: image (200,150) * 2 = (400,300); on screen = (400-200, 300-150) = (200, 150). ✓
    const next = zoomAroundPoint(INITIAL_ZOOM_STATE, 2, 200, 150);
    expect(next).toEqual({ zoom: 2, panX: -200, panY: -150 });
  });

  it('applies inverse transform when zooming out from a focal point', () => {
    const state = { zoom: 2, panX: -200, panY: -150 };
    const next = zoomAroundPoint(state, 1, 200, 150);
    expect(next.zoom).toBe(1);
    expect(next.panX).toBeCloseTo(0);
    expect(next.panY).toBeCloseTo(0);
  });
});

describe('zoomAboutCenter', () => {
  it('changes zoom without altering pan', () => {
    const state = { zoom: 1, panX: 50, panY: 20 };
    const next = zoomAboutCenter(state, 2);
    expect(next).toEqual({ zoom: 2, panX: 50, panY: 20 });
  });

  it('respects clamp bounds', () => {
    const state = { zoom: MAX_ZOOM, panX: 0, panY: 0 };
    expect(zoomAboutCenter(state, MAX_ZOOM * 2)).toBe(state);
  });
});

describe('applyPan', () => {
  it('accumulates deltas', () => {
    const first = applyPan(INITIAL_ZOOM_STATE, 10, 5);
    const second = applyPan(first, -3, 2);
    expect(second).toEqual({ zoom: 1, panX: 7, panY: 7 });
  });
});

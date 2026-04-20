// @vitest-environment jsdom
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { LanguageProvider, useLanguage, detectInitialLocale } from '../LanguageContext';

interface Handle {
  current: ReturnType<typeof useLanguage>;
  root: Root;
}

function renderWithProvider(): Handle {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const ref: Handle = { current: undefined as unknown as Handle['current'], root };

  const Capture: React.FC = () => {
    ref.current = useLanguage();
    return null;
  };

  act(() => {
    root.render(
      React.createElement(LanguageProvider, null, React.createElement(Capture))
    );
  });

  return ref;
}

describe('LanguageProvider', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('provides a locale and a setter', () => {
    const h = renderWithProvider();
    expect(['es', 'en']).toContain(h.current.locale);
    expect(typeof h.current.setLocale).toBe('function');
    act(() => h.root.unmount());
  });

  it('persists locale changes to localStorage', () => {
    const h = renderWithProvider();
    act(() => h.current.setLocale('en'));
    expect(localStorage.getItem('pdf-diff-locale')).toBe('en');
    expect(h.current.locale).toBe('en');
    act(() => h.root.unmount());
  });

  it('updates document.documentElement.lang', () => {
    const h = renderWithProvider();
    act(() => h.current.setLocale('en'));
    expect(document.documentElement.lang).toBe('en');
    act(() => h.root.unmount());
  });
});

describe('detectInitialLocale', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns the stored locale when valid', () => {
    localStorage.setItem('pdf-diff-locale', 'en');
    expect(detectInitialLocale()).toBe('en');
  });

  it('falls back when the stored value is not a supported locale', () => {
    localStorage.setItem('pdf-diff-locale', 'fr');
    expect(['es', 'en']).toContain(detectInitialLocale());
  });
});

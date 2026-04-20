import { describe, it, expect } from 'vitest';
import { translate, interpolate, messages, LOCALES } from '../messages';
import type { MessageKey } from '../messages';

describe('interpolate', () => {
  it('returns the template unchanged when no params are provided', () => {
    expect(interpolate('hello world')).toBe('hello world');
  });

  it('substitutes a single named parameter', () => {
    expect(interpolate('hello {name}', { name: 'world' })).toBe('hello world');
  });

  it('substitutes numeric parameters', () => {
    expect(interpolate('page {current} of {total}', { current: 2, total: 10 })).toBe('page 2 of 10');
  });

  it('leaves unknown placeholders as-is', () => {
    expect(interpolate('hello {name}', { other: 'x' })).toBe('hello {name}');
  });

  it('handles repeated placeholders', () => {
    expect(interpolate('{x}-{x}', { x: 'a' })).toBe('a-a');
  });
});

describe('translate', () => {
  it('returns the Spanish message for the given key', () => {
    expect(translate('es', 'tabs.text')).toBe('Comparación Texto');
  });

  it('returns the English message for the given key', () => {
    expect(translate('en', 'tabs.text')).toBe('Text Comparison');
  });

  it('interpolates params', () => {
    expect(translate('en', 'app.progressPage', { current: 1, total: 5 })).toBe('Page 1 of 5');
  });

  it('falls back to ES when key is missing in locale (defensive)', () => {
    // Force a missing key by casting — runtime fallback path.
    const missing = 'nonexistent.key' as unknown as MessageKey;
    expect(translate('en', missing)).toBe('nonexistent.key');
  });

  it('covers every key in EN that exists in ES', () => {
    const esKeys = Object.keys(messages.es);
    const enKeys = Object.keys(messages.en);
    expect(enKeys.sort()).toEqual(esKeys.sort());
  });

  it('exposes both locales', () => {
    expect(LOCALES).toEqual(['es', 'en']);
  });
});

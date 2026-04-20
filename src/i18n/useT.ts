import { useCallback } from 'react';
import { useLanguage } from './LanguageContext';
import { translate } from './messages';
import type { MessageKey } from './messages';

export function useT() {
  const { locale } = useLanguage();
  return useCallback(
    (key: MessageKey, params?: Record<string, string | number>) => translate(locale, key, params),
    [locale]
  );
}

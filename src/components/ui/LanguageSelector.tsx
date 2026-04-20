import React from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { useT } from '../../i18n/useT';
import type { Locale } from '../../i18n/messages';

export const LanguageSelector: React.FC = () => {
  const { locale, setLocale } = useLanguage();
  const t = useT();

  return (
    <label className="flex items-center gap-2 text-sm text-gray-700">
      <span className="sr-only md:not-sr-only">{t('lang.label')}</span>
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
        className="text-sm border border-gray-300 rounded-md py-1 pl-2 pr-7 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        aria-label={t('lang.label')}
      >
        <option value="es">{t('lang.es')}</option>
        <option value="en">{t('lang.en')}</option>
      </select>
    </label>
  );
};

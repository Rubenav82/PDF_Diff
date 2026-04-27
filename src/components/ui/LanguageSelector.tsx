import React from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { useT } from '../../i18n/useT';
import type { Locale } from '../../i18n/messages';

export const LanguageSelector: React.FC = () => {
  const { locale, setLocale } = useLanguage();
  const t = useT();

  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-2)' }}>
      <span className="sr-only md:not-sr-only">{t('lang.label')}</span>
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
        aria-label={t('lang.label')}
        style={{
          padding: '3px 6px', borderRadius: 5, border: '1px solid var(--border)',
          background: 'var(--surface)', color: 'var(--text)', fontSize: 13,
          cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        <option value="es">{t('lang.es')}</option>
        <option value="en">{t('lang.en')}</option>
      </select>
    </label>
  );
};

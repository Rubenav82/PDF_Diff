import React from 'react';
import type { ComparisonSummary } from '../../types/types';
import { useT } from '../../i18n/useT';

interface ComparisonSummaryProps {
  summary: ComparisonSummary;
  onExport?: () => void;
  isExporting?: boolean;
}

const DownloadIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);

export const ComparisonSummaryPanel: React.FC<ComparisonSummaryProps> = ({ summary, onExport, isExporting }) => {
  const t = useT();

  const stats = [
    { label: t('summary.mappedPairs'),        value: summary.mappedPairs,        color: 'var(--text)' },
    { label: t('summary.changedPairs'),       value: summary.changedPairs,       color: 'var(--accent)' },
    { label: t('summary.unchangedPairs'),     value: summary.unchangedPairs,     color: 'var(--text-3)' },
    { label: t('summary.deletedPages'),       value: summary.deletedPages,       color: 'var(--red)' },
    { label: t('summary.addedPages'),         value: summary.addedPages,         color: 'var(--green)' },
    { label: t('summary.totalOriginalPages'), value: summary.totalOriginalPages, color: 'var(--blue)' },
    { label: t('summary.totalModifiedPages'), value: summary.totalModifiedPages, color: 'var(--blue)' },
  ];

  return (
    <div style={{
      background: 'var(--blue-subtle)', border: '1px solid rgba(37,99,235,0.13)',
      borderRadius: 10, padding: '18px 22px 16px', marginBottom: 20,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 3 }}>
            {t('summary.title')}
          </h2>
          <p style={{ fontSize: 13, color: 'var(--blue)', lineHeight: 1.5 }}>
            {t('summary.subtitle')}
          </p>
        </div>
        {onExport && (
          <button
            onClick={onExport}
            disabled={isExporting}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
              borderRadius: 7, border: '1.5px solid rgba(37,99,235,0.33)',
              background: 'var(--surface)', color: 'var(--blue)',
              fontSize: 13, fontWeight: 500, cursor: isExporting ? 'not-allowed' : 'pointer',
              flexShrink: 0, marginLeft: 16, fontFamily: 'inherit',
              opacity: isExporting ? 0.6 : 1, transition: 'opacity 0.2s ease',
            }}
          >
            <DownloadIcon />
            {isExporting ? t('app.exportingReport') : t('app.exportReport')}
          </button>
        )}
      </div>

      <div style={{ textAlign:'center', display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
        {stats.map(({ label, value, color }) => (
          <div key={label} style={{
            background: 'var(--surface)', borderRadius: 7, padding: '10px 12px',
            boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border)',
            display: 'flex', flexDirection: 'column',
          }}>
            <div style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.35, marginBottom: 5, flex: 1 }}>{label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

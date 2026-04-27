import React from 'react';
import type { TextDiffResult } from '../../types/types';
import { useT } from '../../i18n/useT';

interface TextDiffViewProps {
  diffResults: TextDiffResult[] | null;
}

export const TextDiffView: React.FC<TextDiffViewProps> = ({ diffResults }) => {
  const t = useT();

  const getTitle = (page: number, modifiedPage: number | undefined, kind: TextDiffResult['kind']) => {
    if (kind === 'deleted') return t('textDiff.deleted', { page });
    if (kind === 'added') return t('textDiff.added', { page: modifiedPage ?? '-' });
    if (modifiedPage && modifiedPage !== page) return t('textDiff.comparedWith', { page, modified: modifiedPage });
    return t('textDiff.pageHeader', { page });
  };

  if (!diffResults || diffResults.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 16px' }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
          {t('textDiff.emptyTitle')}
        </h3>
        <p style={{ fontSize: 14, color: 'var(--text-3)' }}>{t('textDiff.emptyBody')}</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {/* Legend */}
      <div style={{
        display: 'flex', gap: 16, padding: '10px 14px',
        background: 'var(--surface-2)', borderRadius: 7,
        border: '1px solid var(--border)', flexWrap: 'wrap',
      }}>
        {[
          { cls: 'diff-del', label: t('textDiff.legendDel') },
          { cls: 'diff-ins', label: t('textDiff.legendIns') },
        ].map(({ cls, label }) => (
          <div key={cls} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12 }}>
            <span className={cls} style={{ padding: '1px 8px' }}>Aa</span>
            <span style={{ color: 'var(--text-2)' }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Pages */}
      {diffResults.map(({ page, modifiedPage, kind, diff }, index) => (
        <div key={`${kind ?? 'changed'}-${page}-${modifiedPage ?? 0}-${index}`}>
          <div style={{
            fontSize: 16, fontWeight: 700, color: 'var(--text)',
            paddingBottom: 8, borderBottom: '1.5px solid var(--border)', marginBottom: 12,
          }}>
            {getTitle(page, modifiedPage, kind)}
          </div>
          <p style={{ fontSize: 13.5, lineHeight: 1.75, color: 'var(--text-2)' }}>
            {diff.map((part, i) => {
              const cls = part.added ? 'diff-ins' : part.removed ? 'diff-del' : undefined;
              return cls
                ? <span key={i} className={cls}>{part.value}</span>
                : <span key={i}>{part.value}</span>;
            })}
          </p>
        </div>
      ))}
    </div>
  );
};

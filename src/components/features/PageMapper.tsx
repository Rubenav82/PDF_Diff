import React, { useState } from 'react';
import type { PageMapping } from '../../types/types';
import { useT } from '../../i18n/useT';

interface PageMapperProps {
  pageCounts: { original: number; modified: number };
  mapping: PageMapping;
  onMappingChange: (mapping: PageMapping) => void;
  onSuggestMapping?: () => Promise<PageMapping | null>;
}

export const PageMapper: React.FC<PageMapperProps> = ({ pageCounts, mapping, onMappingChange, onSuggestMapping }) => {
  const t = useT();
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);

  const handleMapChange = (originalPage: number, newModifiedPageStr: string) => {
    const newModifiedPage = parseInt(newModifiedPageStr, 10);
    const valueToSet = isNaN(newModifiedPage) ? 0 : newModifiedPage;
    onMappingChange(mapping.map(e => e.originalPage === originalPage ? { ...e, modifiedPage: valueToSet } : e));
  };

  const getUnmappedModifiedPages = () => {
    const mappedSet = new Set(mapping.map(m => m.modifiedPage).filter(p => p > 0));
    return Array.from({ length: pageCounts.modified }, (_, i) => i + 1).filter(p => !mappedSet.has(p));
  };

  const getDuplicatedModifiedPages = () => {
    const counts = new Map<number, number>();
    mapping.forEach(e => { if (e.modifiedPage > 0) counts.set(e.modifiedPage, (counts.get(e.modifiedPage) ?? 0) + 1); });
    return new Set(Array.from(counts.entries()).filter(([, c]) => c > 1).map(([p]) => p));
  };

  const handleAutoMapOneToOne = () => {
    onMappingChange(mapping.map(e => ({ ...e, modifiedPage: e.originalPage <= pageCounts.modified ? e.originalPage : 0 })));
  };

  const handleShiftMapping = (offset: number) => {
    onMappingChange(mapping.map(e => {
      const shifted = e.originalPage + offset;
      return { ...e, modifiedPage: shifted >= 1 && shifted <= pageCounts.modified ? shifted : 0 };
    }));
  };

  const handleSetAllDeleted = () => {
    onMappingChange(mapping.map(e => ({ ...e, modifiedPage: 0 })));
  };

  const handleSuggestMapping = async () => {
    if (!onSuggestMapping) return;
    setIsSuggesting(true); setSuggestError(null);
    try {
      const suggested = await onSuggestMapping();
      if (suggested) onMappingChange(suggested);
    } catch (err) {
      console.error('Fallo al sugerir mapeo automático:', err);
      setSuggestError(t('mapper.suggestError'));
    } finally {
      setIsSuggesting(false);
    }
  };

  const unmappedPages = getUnmappedModifiedPages();
  const duplicatedPages = getDuplicatedModifiedPages();

  const btnStyle = (color?: string) => ({
    padding: '5px 11px', borderRadius: 5,
    border: `1.5px solid ${color ? `${color}44` : 'var(--border)'}`,
    background: color === 'var(--green)' ? 'var(--green-subtle)' : color === '#b45309' ? 'var(--warn-subtle)' : 'var(--surface-2)',
    color: color ?? 'var(--text)',
    fontSize: 12, fontWeight: 500 as const, cursor: 'pointer' as const,
    transition: 'background 0.2s ease', fontFamily: 'inherit',
    opacity: isSuggesting ? 0.6 : 1,
  });

  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 12, lineHeight: 1.55 }}>
        {t('mapper.instructions')}
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6, marginBottom: 14 }}>
        {onSuggestMapping && (
          <button type="button" onClick={handleSuggestMapping} disabled={isSuggesting} style={btnStyle('var(--green)')}>
            {isSuggesting ? t('mapper.analyzing') : t('mapper.suggest')}
          </button>
        )}
        <button type="button" onClick={handleAutoMapOneToOne} style={btnStyle()}>{t('mapper.oneToOne')}</button>
        <button type="button" onClick={() => handleShiftMapping(-1)} style={btnStyle()}>{t('mapper.shiftMinus')}</button>
        <button type="button" onClick={() => handleShiftMapping(1)} style={btnStyle()}>{t('mapper.shiftPlus')}</button>
        <button type="button" onClick={handleSetAllDeleted} style={btnStyle('#b45309')}>{t('mapper.markAllDeleted')}</button>
      </div>

      {suggestError && (
        <div style={{ marginBottom: 12, padding: '8px 12px', background: 'var(--red-subtle)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 6 }}>
          <p style={{ fontSize: 13, color: 'var(--red)' }}>{suggestError}</p>
        </div>
      )}

      <div className="map-scroll">
        <div className="map-grid">
          {mapping.map(({ originalPage, modifiedPage }) => (
            <div className="map-cell" key={originalPage}>
              <span style={{ fontSize: 12, color: 'var(--text-2)', whiteSpace: 'nowrap' as const, minWidth: 72, fontFamily: 'monospace' }}>
                {t('mapper.originalPageLabel', { n: originalPage })}
              </span>
              <select
                value={modifiedPage}
                onChange={e => handleMapChange(originalPage, e.target.value)}
                aria-label={t('mapper.selectAria', { n: originalPage })}
                style={duplicatedPages.has(modifiedPage) && modifiedPage > 0
                  ? { flex: 1, minWidth: 0, padding: '3px 6px', fontSize: 12, background: 'var(--warn-subtle)', border: '1px solid var(--warn-border)', borderRadius: 4, color: 'var(--text)', fontFamily: 'inherit' }
                  : undefined
                }
              >
                <option value={0}>{t('mapper.deletedOption')}</option>
                {Array.from({ length: pageCounts.modified }, (_, i) => i + 1).map(page => (
                  <option key={page} value={page}>{t('mapper.pageOption', { n: page })}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      {duplicatedPages.size > 0 && (
        <div style={{ marginTop: 12, padding: '8px 12px', background: 'var(--warn-subtle)', border: '1px solid var(--warn-border)', borderRadius: 6 }}>
          <p style={{ fontSize: 13, color: 'var(--warn)' }}>
            <span style={{ fontWeight: 600 }}>{t('mapper.duplicates')}</span>{' '}
            {Array.from(duplicatedPages).join(', ')}
          </p>
        </div>
      )}

      {unmappedPages.length > 0 && (
        <div style={{ marginTop: 8, padding: '8px 12px', background: 'var(--blue-subtle)', border: '1px solid rgba(37,99,235,0.2)', borderRadius: 6 }}>
          <p style={{ fontSize: 13, color: 'var(--blue)' }}>
            <span style={{ fontWeight: 600 }}>{t('mapper.newPages')}</span>{' '}
            {unmappedPages.join(', ')}
          </p>
        </div>
      )}
    </div>
  );
};

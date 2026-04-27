import React from 'react';
import { TextDiffView } from './TextDiffView';
import { VisualDiffView } from './VisualDiffView';
import type { ViewMode, TextDiffResult, VisualDiffResult, PageMapping } from '../../types/types';
import { useT } from '../../i18n/useT';

interface ComparisonViewProps {
  textDiff: TextDiffResult[] | null;
  visualDiff: VisualDiffResult | null;
  originalFile: File;
  modifiedFile: File;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  pageMapping: PageMapping | null;
}

export const ComparisonView: React.FC<ComparisonViewProps> = ({
  textDiff, visualDiff, originalFile, modifiedFile,
  viewMode, onViewModeChange, pageMapping,
}) => {
  const t = useT();

  const tabs: { id: ViewMode; label: string }[] = [
    { id: 'text',   label: t('tabs.text') },
    { id: 'visual', label: t('tabs.visual') },
  ];

  const renderContent = () => {
    if (viewMode === 'text') return <TextDiffView diffResults={textDiff} />;
    if (viewMode === 'visual' && visualDiff && pageMapping) {
      const validMapping = pageMapping.filter(m => m.modifiedPage > 0);
      return <VisualDiffView originalFile={originalFile} modifiedFile={modifiedFile} pageMapping={validMapping} />;
    }
    return null;
  };

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 10, padding: '22px 24px', boxShadow: 'var(--shadow)' }}>
      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '2px solid var(--border)', marginBottom: 24 }}>
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => onViewModeChange(id)}
            style={{
              padding: '11px 20px', fontSize: 14, fontWeight: viewMode === id ? 600 : 400,
              color: viewMode === id ? 'var(--blue)' : 'var(--text-3)',
              background: 'none', border: 'none',
              borderBottom: `2px solid ${viewMode === id ? 'var(--blue)' : 'transparent'}`,
              marginBottom: -2, transition: 'color 0.15s, border-color 0.15s',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {renderContent()}
    </div>
  );
};

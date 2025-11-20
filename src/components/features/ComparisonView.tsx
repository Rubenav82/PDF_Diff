import React from 'react';
import { TextDiffView } from './TextDiffView';
import { VisualDiffView } from './VisualDiffView';
import type { ViewMode, TextDiffResult, VisualDiffResult, PageMapping } from '../../types/types';

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
  textDiff,
  visualDiff,
  originalFile,
  modifiedFile,
  viewMode,
  onViewModeChange,
  pageMapping,
}) => {
  const renderContent = () => {
    if (viewMode === 'text') {
      return <TextDiffView diffResults={textDiff} />;
    }
    if (viewMode === 'visual' && visualDiff && pageMapping) {
      // Filtrar para comparar solo páginas que han sido mapeadas explícitamente a una página válida.
      const validMapping = pageMapping.filter(m => m.modifiedPage > 0);
      return (
        <VisualDiffView
          originalFile={originalFile}
          modifiedFile={modifiedFile}
          pageMapping={validMapping}
        />
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8 px-6" aria-label="Tabs">
          <button
            onClick={() => onViewModeChange('text')}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              viewMode === 'text'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Comparación Texto
          </button>
          <button
            onClick={() => onViewModeChange('visual')}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              viewMode === 'visual'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Comparación Visual
          </button>
        </nav>
      </div>
      <div className="p-4 sm:p-6 lg:p-8">{renderContent()}</div>
    </div>
  );
};

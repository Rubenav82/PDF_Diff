import React from 'react';
import type { TextDiffResult } from '../../types/types';
import { useT } from '../../i18n/useT';

interface TextDiffViewProps {
  diffResults: TextDiffResult[] | null;
}

export const TextDiffView: React.FC<TextDiffViewProps> = ({ diffResults }) => {
  const t = useT();

  const getTitle = (page: number, modifiedPage: number | undefined, kind: TextDiffResult['kind']) => {
    if (kind === 'deleted') {
      return t('textDiff.deleted', { page });
    }
    if (kind === 'added') {
      return t('textDiff.added', { page: modifiedPage ?? '-' });
    }
    if (modifiedPage && modifiedPage !== page) {
      return t('textDiff.comparedWith', { page, modified: modifiedPage });
    }
    return t('textDiff.pageHeader', { page });
  };

  if (!diffResults || diffResults.length === 0) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-gray-900">{t('textDiff.emptyTitle')}</h3>
        <p className="mt-1 text-sm text-gray-500">{t('textDiff.emptyBody')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {diffResults.map(({ page, modifiedPage, kind, diff }, index) => (
        <div key={`${kind ?? 'changed'}-${page}-${modifiedPage ?? 0}-${index}`} className="border border-gray-200 rounded-lg">
          <h3 className="bg-gray-50 px-4 py-2 text-lg font-semibold border-b border-gray-200">
            {getTitle(page, modifiedPage, kind)}
          </h3>
          <pre className="p-4 text-sm whitespace-pre-wrap font-sans break-words leading-relaxed">
            {diff.map((part, index) => {
              const style = part.added
                ? 'bg-green-100 text-green-800'
                : part.removed
                ? 'bg-red-100 text-red-800 line-through'
                : 'text-gray-700';
              return (
                <span key={index} className={style}>
                  {part.value}
                </span>
              );
            })}
          </pre>
        </div>
      ))}
    </div>
  );
};

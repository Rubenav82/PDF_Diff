import React from 'react';
import type { ComparisonSummary } from '../../types/types';
import { useT } from '../../i18n/useT';

interface ComparisonSummaryProps {
  summary: ComparisonSummary;
}

interface MetricCardProps {
  label: string;
  value: number;
}

const MetricCard: React.FC<MetricCardProps> = ({ label, value }) => {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-sm text-gray-600">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
    </div>
  );
};

export const ComparisonSummaryPanel: React.FC<ComparisonSummaryProps> = ({ summary }) => {
  const t = useT();
  return (
    <div className="mb-6 rounded-lg border border-indigo-100 bg-indigo-50 p-5">
      <h3 className="text-lg font-semibold text-indigo-900">{t('summary.title')}</h3>
      <p className="mt-1 text-sm text-indigo-800">{t('summary.subtitle')}</p>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
        <MetricCard label={t('summary.mappedPairs')} value={summary.mappedPairs} />
        <MetricCard label={t('summary.changedPairs')} value={summary.changedPairs} />
        <MetricCard label={t('summary.unchangedPairs')} value={summary.unchangedPairs} />
        <MetricCard label={t('summary.deletedPages')} value={summary.deletedPages} />
        <MetricCard label={t('summary.addedPages')} value={summary.addedPages} />
        <MetricCard label={t('summary.totalOriginalPages')} value={summary.totalOriginalPages} />
        <MetricCard label={t('summary.totalModifiedPages')} value={summary.totalModifiedPages} />
      </div>
    </div>
  );
};

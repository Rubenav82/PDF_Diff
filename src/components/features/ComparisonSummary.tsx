import React from 'react';
import type { ComparisonSummary } from '../../types/types';

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
  return (
    <div className="mb-6 rounded-lg border border-indigo-100 bg-indigo-50 p-5">
      <h3 className="text-lg font-semibold text-indigo-900">Resumen ejecutivo</h3>
      <p className="mt-1 text-sm text-indigo-800">
        Vista rápida del resultado antes de entrar en el detalle de texto o visual.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
        <MetricCard label="Pares mapeados" value={summary.mappedPairs} />
        <MetricCard label="Pares con cambios" value={summary.changedPairs} />
        <MetricCard label="Pares sin cambios" value={summary.unchangedPairs} />
        <MetricCard label="Páginas eliminadas" value={summary.deletedPages} />
        <MetricCard label="Páginas añadidas" value={summary.addedPages} />
        <MetricCard label="Total páginas original" value={summary.totalOriginalPages} />
        <MetricCard label="Total páginas modificado" value={summary.totalModifiedPages} />
      </div>
    </div>
  );
};

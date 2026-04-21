import type { Locale } from '../i18n/messages';
import { generateReportHtml } from '@pdf-diff/core';

export type { ReportData } from '@pdf-diff/core';
export { generateReportHtml } from '@pdf-diff/core';

export function downloadComparisonReport(data: Parameters<typeof generateReportHtml>[0] & { locale?: Locale }): void {
  const html = generateReportHtml(data);

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const fileName = `informe-pdf-diff-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.html`;

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

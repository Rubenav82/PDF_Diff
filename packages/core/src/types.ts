import { Change } from 'diff';

export type ViewMode = 'text' | 'visual';
export type TextDiffKind = 'changed' | 'deleted' | 'added';

export interface TextDiffResult {
  page: number;
  modifiedPage?: number;
  kind?: TextDiffKind;
  diff: Change[];
}

export interface TextNormalizationOptions {
  ignoreCase: boolean;
  ignoreWhitespace: boolean;
  ignoreLineBreaks: boolean;
}

export interface TextComparisonOptions {
  includeUnmappedPages: boolean;
  normalization: TextNormalizationOptions;
}

export interface ComparisonSummary {
  mappedPairs: number;
  changedPairs: number;
  unchangedPairs: number;
  deletedPages: number;
  addedPages: number;
  totalOriginalPages: number;
  totalModifiedPages: number;
}

export interface VisualDiffResult {
  originalPageCount: number;
  modifiedPageCount: number;
}

export interface VisualDiffReportEntry {
  originalPage: number;
  modifiedPage: number;
  diffPixels: number;
  totalPixels: number;
  diffRatio: number;
  thumbnailDataUrl: string;
}

export interface PageMapEntry {
  originalPage: number;
  modifiedPage: number;
}

export type PageMapping = PageMapEntry[];

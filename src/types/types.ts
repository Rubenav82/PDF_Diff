import { Change } from 'diff';

export type ViewMode = 'text' | 'visual';
export type TextDiffKind = 'changed' | 'deleted' | 'added';

export interface TextDiffResult {
  // page: original page number (0 if added page)
  // modifiedPage: modified page number (undefined if deleted/unmapped page)
  // kind: 'changed' = both pages exist and differ
  //       'deleted' = original page has no mapping
  //       'added' = modified page has no mapping
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
  // modifiedPage: 0 means this original page was deleted (no mapping to modified version)
  modifiedPage: number;
}

export type PageMapping = PageMapEntry[];
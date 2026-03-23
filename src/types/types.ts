import { Change } from 'diff';

export type ViewMode = 'text' | 'visual';
export type TextDiffKind = 'changed' | 'deleted' | 'added';

export interface TextDiffResult {
  page: number; // Esto se referirá al número de página del documento original
  modifiedPage?: number;
  kind?: TextDiffKind;
  diff: Change[];
}

export interface VisualDiffResult {
  originalPageCount: number;
  modifiedPageCount: number;
}

export interface PageMapEntry {
  originalPage: number;
  modifiedPage: number;
}

export type PageMapping = PageMapEntry[];
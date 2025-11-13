// Fix: The 'diff' library exports the 'Change' type for diff parts, not 'Part'.
import { Change } from 'diff';

export type ViewMode = 'text' | 'visual';

export interface TextDiffResult {
  page: number; // Esto se referirá al número de página del documento original
  // Fix: Updated the diff property to use the correct 'Change' type.
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
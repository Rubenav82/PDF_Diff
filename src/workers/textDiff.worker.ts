import { diffChars, diffWords, diffLines, type Change } from 'diff';

export type TextDiffMode = 'chars' | 'words' | 'lines';

export interface TextDiffRequest {
  id: number;
  original: string;
  modified: string;
  mode: TextDiffMode;
}

export type TextDiffResponse =
  | { id: number; ok: true; result: Change[] }
  | { id: number; ok: false; error: string };

const ctx = self as unknown as Worker;

ctx.onmessage = (event: MessageEvent<TextDiffRequest>) => {
  const { id, original, modified, mode } = event.data;
  try {
    const fn = mode === 'words' ? diffWords : mode === 'lines' ? diffLines : diffChars;
    const result = fn(original, modified);
    ctx.postMessage({ id, ok: true, result } satisfies TextDiffResponse);
  } catch (err) {
    ctx.postMessage({
      id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    } satisfies TextDiffResponse);
  }
};

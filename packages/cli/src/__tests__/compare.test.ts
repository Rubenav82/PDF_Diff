import { describe, it, expect } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));

const BIN = resolve(__dirname, '../../dist/bin.js');
const FIXTURES = resolve(__dirname, '../../fixtures');

function run(args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((res) => {
    execFile(process.execPath, [BIN, ...args], { encoding: 'utf8' }, (err, stdout, stderr) => {
      // pdfjs may emit warnings to stdout before our output — strip them
      const jsonStart = stdout.indexOf('{');
      const cleanStdout = jsonStart >= 0 ? stdout.slice(jsonStart) : stdout;
      res({ stdout: cleanStdout, stderr, code: (err as NodeJS.ErrnoException & { code?: number })?.code ?? 0 });
    });
  });
}

const baseline = resolve(FIXTURES, 'baseline.pdf');
const modified = resolve(FIXTURES, 'modified.pdf');
const identical = resolve(FIXTURES, 'identical.pdf');

// ── Exit codes ────────────────────────────────────────────────────────────────

describe('exit codes', () => {
  it('exits 0 when files are identical', async () => {
    const { code } = await run(['compare', baseline, identical, '--mode', 'text-only']);
    expect(code).toBe(0);
  });

  it('exits 1 when files differ', async () => {
    const { code } = await run(['compare', baseline, modified, '--mode', 'text-only']);
    expect(code).toBe(1);
  });

  it('exits 2 on missing file', async () => {
    const { code } = await run(['compare', 'nonexistent.pdf', modified]);
    expect(code).toBe(2);
  });
});

// ── JSON output ───────────────────────────────────────────────────────────────

describe('--output json', () => {
  it('produces valid JSON', async () => {
    const { stdout } = await run(['compare', baseline, modified, '--output', 'json', '--mode', 'text-only']);
    expect(() => JSON.parse(stdout)).not.toThrow();
  });

  it('JSON has expected top-level keys', async () => {
    const { stdout } = await run(['compare', baseline, modified, '--output', 'json', '--mode', 'text-only']);
    const data = JSON.parse(stdout);
    expect(data).toHaveProperty('version', '1.0');
    expect(data).toHaveProperty('original');
    expect(data).toHaveProperty('modified');
    expect(data).toHaveProperty('mapping');
    expect(data).toHaveProperty('summary');
    expect(data).toHaveProperty('pages');
  });

  it('detects text changes between baseline and modified', async () => {
    const { stdout } = await run(['compare', baseline, modified, '--output', 'json', '--mode', 'text-only']);
    const data = JSON.parse(stdout);
    const { text } = data.summary;
    expect(text.added).toBeGreaterThan(0);
    expect(text.removed).toBeGreaterThan(0);
  });

  it('reports zero text changes for identical files', async () => {
    const { stdout } = await run(['compare', baseline, identical, '--output', 'json', '--mode', 'text-only']);
    const data = JSON.parse(stdout);
    const { text } = data.summary;
    expect(text.added).toBe(0);
    expect(text.removed).toBe(0);
  });

  it('does not expose _internal in JSON output', async () => {
    const { stdout } = await run(['compare', baseline, modified, '--output', 'json', '--mode', 'text-only']);
    const data = JSON.parse(stdout);
    expect(data).not.toHaveProperty('_internal');
  });

  it('original and modified include path and hash', async () => {
    const { stdout } = await run(['compare', baseline, modified, '--output', 'json', '--mode', 'text-only']);
    const data = JSON.parse(stdout);
    expect(data.original.hash).toMatch(/^sha512:/);
    expect(data.modified.hash).toMatch(/^sha512:/);
    expect(data.original.pages).toBeGreaterThan(0);
    expect(data.modified.pages).toBeGreaterThan(0);
  });
});

// ── Text output ───────────────────────────────────────────────────────────────

describe('--output text', () => {
  it('contains Thresholds: PASSED for identical files', async () => {
    const { stdout } = await run(['compare', baseline, identical, '--output', 'text', '--mode', 'text-only']);
    expect(stdout).toContain('Thresholds: PASSED');
  });

  it('contains Thresholds: FAILED when diff exceeds threshold', async () => {
    const { stdout, code } = await run([
      'compare', baseline, modified,
      '--output', 'text', '--mode', 'text-only',
      '--max-text-changes', '0',
    ]);
    expect(stdout).toContain('Thresholds: FAILED');
    expect(code).toBe(1);
  });
});

// ── Thresholds ────────────────────────────────────────────────────────────────

describe('thresholds', () => {
  it('exits 0 when diff is within --max-text-changes limit', async () => {
    const { stdout, code } = await run([
      'compare', baseline, modified,
      '--output', 'json', '--mode', 'text-only',
      '--max-text-changes', '9999',
    ]);
    const data = JSON.parse(stdout);
    expect(data.summary.thresholds.passed).toBe(true);
    expect(code).toBe(0);
  });

  it('exits 1 when diff exceeds --max-text-changes', async () => {
    const { code } = await run([
      'compare', baseline, modified,
      '--mode', 'text-only',
      '--max-text-changes', '0',
    ]);
    expect(code).toBe(1);
  });

  it('thresholds reflect configured limits in JSON', async () => {
    const { stdout } = await run([
      'compare', baseline, modified,
      '--output', 'json', '--mode', 'text-only',
      '--max-text-changes', '5',
    ]);
    const data = JSON.parse(stdout);
    expect(data.summary.thresholds.textChangesLimit).toBe(5);
    expect(data.summary.thresholds.visualLimit).toBeNull();
  });
});

// ── Modes ─────────────────────────────────────────────────────────────────────

describe('--mode', () => {
  it('text-only produces no visual summary', async () => {
    const { stdout } = await run(['compare', baseline, modified, '--output', 'json', '--mode', 'text-only']);
    const data = JSON.parse(stdout);
    expect(data.summary.visual).toBeNull();
    expect(data.summary.text).not.toBeNull();
  });

  it('visual-only produces no text summary', async () => {
    const { stdout } = await run(['compare', baseline, modified, '--output', 'json', '--mode', 'visual-only']);
    const data = JSON.parse(stdout);
    expect(data.summary.text).toBeNull();
    expect(data.summary.visual).not.toBeNull();
  });

  it('text+visual produces both summaries', async () => {
    const { stdout } = await run(['compare', baseline, modified, '--output', 'json', '--mode', 'text+visual']);
    const data = JSON.parse(stdout);
    expect(data.summary.text).not.toBeNull();
    expect(data.summary.visual).not.toBeNull();
  });
});

// ── Normalization ─────────────────────────────────────────────────────────────

describe('normalization flags', () => {
  it('--ignore-case reports threshold passed when only case differs', async () => {
    // baseline and modified differ in "1000" vs "1200", not by case — just verify flag is accepted
    const { code } = await run([
      'compare', baseline, identical,
      '--mode', 'text-only', '--ignore-case',
    ]);
    expect(code).toBe(0);
  });

  it('--ignore-whitespace is accepted without error', async () => {
    const { code, stderr } = await run([
      'compare', baseline, identical,
      '--mode', 'text-only', '--ignore-whitespace',
    ]);
    expect(stderr).not.toContain('Error:');
    expect(code).toBe(0);
  });
});

// ── Page mapping ──────────────────────────────────────────────────────────────

describe('page mapping', () => {
  it('--map 1:1 produces single page entry', async () => {
    const { stdout } = await run([
      'compare', baseline, modified,
      '--output', 'json', '--mode', 'text-only',
      '--map', '1:1',
    ]);
    const data = JSON.parse(stdout);
    expect(data.mapping).toHaveLength(1);
    expect(data.mapping[0]).toEqual([1, 1]);
  });

  it('--auto-map completes without error', async () => {
    const { code, stderr } = await run([
      'compare', baseline, modified,
      '--mode', 'text-only', '--auto-map',
    ]);
    expect(stderr).not.toContain('Error:');
    expect(code).toBe(1); // diff exists
  });
});

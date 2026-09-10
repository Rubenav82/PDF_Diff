import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { APP_VERSION } from './version';
import { RELEASE_NOTES } from './releaseNotes';
import { LOCALES } from './i18n/messages';

const SEMVER = /^\d+\.\d+\.\d+$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function compareSemver(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i];
  }
  return 0;
}

describe('version sync', () => {
  it('APP_VERSION is valid semver', () => {
    expect(APP_VERSION).toMatch(SEMVER);
  });

  it('package.json version matches APP_VERSION', () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf-8'));
    expect(pkg.version).toBe(APP_VERSION);
  });

  it('latest release note matches APP_VERSION', () => {
    expect(RELEASE_NOTES[0]?.version).toBe(APP_VERSION);
  });
});

describe('release notes', () => {
  it('has at least one entry', () => {
    expect(RELEASE_NOTES.length).toBeGreaterThan(0);
  });

  it('every entry has valid semver, ISO date and non-empty changes in every locale', () => {
    for (const note of RELEASE_NOTES) {
      expect(note.version, `version of ${note.version}`).toMatch(SEMVER);
      expect(note.date, `date of ${note.version}`).toMatch(ISO_DATE);
      expect(Number.isNaN(Date.parse(note.date)), `parsable date of ${note.version}`).toBe(false);
      for (const locale of LOCALES) {
        const changes = note.changes[locale];
        expect(changes.length, `${locale} changes of ${note.version}`).toBeGreaterThan(0);
        for (const change of changes) {
          expect(change.trim().length, `${locale} change text of ${note.version}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it('is ordered newest first with no duplicate versions', () => {
    for (let i = 1; i < RELEASE_NOTES.length; i++) {
      const prev = RELEASE_NOTES[i - 1].version;
      const curr = RELEASE_NOTES[i].version;
      expect(compareSemver(prev, curr), `${prev} should be newer than ${curr}`).toBeGreaterThan(0);
    }
  });
});

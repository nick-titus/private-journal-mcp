// ABOUTME: Unit tests for migration script pure functions
// ABOUTME: Tests extractProjectFromPath and expandHome utilities

import { extractProjectFromPath, expandHome } from '../scripts/migrate-entries';

describe('Migration Script Functions', () => {
  describe('extractProjectFromPath', () => {
    test('extracts project name from ~/Dev/betterpack/.private-journal', () => {
      const result = extractProjectFromPath('~/Dev/betterpack/.private-journal');
      expect(result).toBe('betterpack');
    });

    test('returns general for ~/.private-journal', () => {
      const result = extractProjectFromPath('~/.private-journal');
      expect(result).toBe('general');
    });

    test('returns general for ~/Dev/.private-journal (Dev is not a project)', () => {
      const result = extractProjectFromPath('~/Dev/.private-journal');
      expect(result).toBe('general');
    });

    test('extracts deepest project name from nested path ~/Dev/trainingpeaks/Mars/.private-journal', () => {
      const result = extractProjectFromPath('~/Dev/trainingpeaks/Mars/.private-journal');
      expect(result).toBe('Mars');
    });
  });

  describe('expandHome', () => {
    let originalHome: string | undefined;

    beforeEach(() => {
      originalHome = process.env.HOME;
      process.env.HOME = '/Users/testuser';
    });

    afterEach(() => {
      if (originalHome !== undefined) {
        process.env.HOME = originalHome;
      } else {
        delete process.env.HOME;
      }
    });

    test('expands ~ to HOME value', () => {
      const result = expandHome('~/.private-journal');
      expect(result).toBe('/Users/testuser/.private-journal');
    });

    test('handles paths without ~', () => {
      const result = expandHome('/absolute/path/to/journal');
      expect(result).toBe('/absolute/path/to/journal');
    });
  });
});

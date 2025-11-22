// ABOUTME: Unit tests for path resolution utilities
// ABOUTME: Tests centralized path resolution and project detection

import * as path from 'path';
import {
  detectProjectName,
  resolveJournalBasePath,
  resolveEntriesPath,
  resolveProjectSummaryPath,
  resolveJournalPath,
  resolveUserJournalPath,
  resolveProjectJournalPath
} from '../src/paths.js';

describe('detectProjectName', () => {
  it('should extract project name from git repo root', () => {
    // When in /Users/ntitus/Dev/private-journal-mcp (the current repo)
    // Should return the git repo basename
    const result = detectProjectName('/Users/ntitus/Dev/mcp-servers/private-journal-mcp/src');
    expect(result).toBe('private-journal-mcp');
  });

  it('should return directory basename when not in git repo', () => {
    const result = detectProjectName('/tmp/random-folder');
    expect(result).toBe('random-folder');
  });

  it('should return "general" for home directory', () => {
    const result = detectProjectName(process.env.HOME || '/Users/ntitus');
    expect(result).toBe('general');
  });

  it('should return "general" for root directory', () => {
    const result = detectProjectName('/');
    expect(result).toBe('general');
  });

  it('should return "general" for /tmp', () => {
    const result = detectProjectName('/tmp');
    expect(result).toBe('general');
  });
});

describe('resolveJournalBasePath', () => {
  it('should return ~/.claude/.private-journal/', () => {
    const result = resolveJournalBasePath();
    const expected = path.join(process.env.HOME || '', '.claude', '.private-journal');
    expect(result).toBe(expected);
  });
});

describe('resolveEntriesPath', () => {
  it('should return entries subdirectory', () => {
    const result = resolveEntriesPath();
    const expected = path.join(process.env.HOME || '', '.claude', '.private-journal', 'entries');
    expect(result).toBe(expected);
  });
});

describe('resolveProjectSummaryPath', () => {
  it('should return project summary path', () => {
    const result = resolveProjectSummaryPath('betterpack');
    const expected = path.join(process.env.HOME || '', '.claude', '.private-journal', 'projects', 'betterpack');
    expect(result).toBe(expected);
  });
});

describe('Legacy path exports (backwards compatibility)', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test('resolveJournalPath returns base path', () => {
    const result = resolveJournalPath('.private-journal', true);
    const expected = path.join(process.env.HOME || '', '.claude', '.private-journal');
    expect(result).toBe(expected);
  });

  test('resolveUserJournalPath returns base path', () => {
    const result = resolveUserJournalPath();
    const expected = path.join(process.env.HOME || '', '.claude', '.private-journal');
    expect(result).toBe(expected);
  });

  test('resolveProjectJournalPath returns base path', () => {
    const result = resolveProjectJournalPath();
    const expected = path.join(process.env.HOME || '', '.claude', '.private-journal');
    expect(result).toBe(expected);
  });
});

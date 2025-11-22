// ABOUTME: Path resolution utilities for centralized journal storage
// ABOUTME: All entries stored in ~/.claude/.private-journal/ with project tagging

import * as path from 'path';
import { execSync } from 'child_process';

/**
 * Returns the centralized journal storage path
 */
export function resolveJournalBasePath(): string {
  const home = process.env.HOME || process.env.USERPROFILE || '/tmp';
  return path.join(home, '.claude', '.private-journal');
}

/**
 * Detects project name from a directory path
 * Tries git root first, falls back to directory basename
 */
export function detectProjectName(dirPath: string): string {
  const home = process.env.HOME || process.env.USERPROFILE || '';

  // Don't tag home directory or system paths as projects
  if (dirPath === home || dirPath === '/' || dirPath === '/tmp') {
    return 'general';
  }

  // Try to get git repo root
  try {
    const gitRoot = execSync('git rev-parse --show-toplevel', {
      cwd: dirPath,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim();
    return path.basename(gitRoot);
  } catch {
    // Not in a git repo, use directory basename
    return path.basename(dirPath) || 'general';
  }
}

/**
 * Returns path to entries directory
 */
export function resolveEntriesPath(): string {
  return path.join(resolveJournalBasePath(), 'entries');
}

/**
 * Returns path to a project's summary directory
 */
export function resolveProjectSummaryPath(projectName: string): string {
  return path.join(resolveJournalBasePath(), 'projects', projectName);
}

// Legacy exports for backwards compatibility during migration
export function resolveJournalPath(subdirectory: string = '.private-journal', includeCurrentDirectory: boolean = true): string {
  return resolveJournalBasePath();
}

export function resolveUserJournalPath(): string {
  return resolveJournalBasePath();
}

export function resolveProjectJournalPath(): string {
  return resolveJournalBasePath();
}

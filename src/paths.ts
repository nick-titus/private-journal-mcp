// ABOUTME: Path resolution utilities for centralized journal storage
// ABOUTME: All entries stored in ~/.claude/.private-journal/ with project tagging

import * as path from 'path';
import { execSync } from 'child_process';

// Regex to validate safe path characters (alphanumeric, slash, dash, underscore, dot, space)
const SAFE_PATH_REGEX = /^[a-zA-Z0-9/_\-.\s]+$/;

/**
 * Validates that a path contains only safe characters
 * Prevents command injection by rejecting paths with shell metacharacters
 */
export function isValidPath(dirPath: string): boolean {
  return SAFE_PATH_REGEX.test(dirPath);
}

/**
 * Returns the centralized journal storage path
 */
export function resolveJournalBasePath(): string {
  const home = process.env.HOME || process.env.USERPROFILE;
  if (!home) {
    console.warn('Warning: HOME and USERPROFILE environment variables are not set. Journal data will be stored in /tmp which may be cleared on reboot.');
    return path.join('/tmp', '.claude', '.private-journal');
  }
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

  // Validate path to prevent command injection
  if (!isValidPath(dirPath)) {
    console.warn(`Warning: Path contains potentially unsafe characters, skipping git detection: ${dirPath}`);
    return path.basename(dirPath) || 'general';
  }

  // Try to get git repo root
  try {
    const gitRoot = execSync('git rev-parse --show-toplevel', {
      cwd: dirPath,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 5000 // 5 second timeout to prevent hanging
    }).trim();
    return path.basename(gitRoot);
  } catch (error: unknown) {
    // Exit code 128 means "not a git repository" - this is expected and handled silently
    if (error instanceof Error && 'status' in error && (error as { status: number }).status === 128) {
      return path.basename(dirPath) || 'general';
    }
    // Log unexpected errors (network issues, permission problems, timeouts, etc.)
    console.error('Unexpected error detecting git root:', error instanceof Error ? error.message : error);
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
// These now point to the entries directory for search compatibility
export function resolveJournalPath(subdirectory: string = '.private-journal', includeCurrentDirectory: boolean = true): string {
  return resolveEntriesPath();
}

export function resolveUserJournalPath(): string {
  return resolveEntriesPath();
}

export function resolveProjectJournalPath(): string {
  return resolveEntriesPath();
}

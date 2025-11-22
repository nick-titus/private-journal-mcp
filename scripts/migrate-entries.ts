#!/usr/bin/env npx tsx

/**
 * Migration script: Consolidate journal entries to ~/.claude/.private-journal/
 *
 * Usage: npx tsx scripts/migrate-entries.ts [--dry-run]
 */

import * as fs from 'fs/promises';
import * as path from 'path';

const OLD_PROJECT_JOURNALS = [
  '~/Dev/episodic-memory/.private-journal',
  '~/Dev/tpf-website/.private-journal',
  '~/Dev/.private-journal',
  '~/Dev/betterpack/.private-journal',
  '~/Dev/health-tracker/.private-journal',
  '~/Dev/trainingpeaks/.private-journal',
  '~/Dev/trainingpeaks/tpv-data/.private-journal',
  '~/Dev/trainingpeaks/Mars/.private-journal',
  '~/Dev/mcp-servers/private-journal-mcp/.private-journal',
];

const OLD_USER_JOURNAL = '~/.private-journal';
const NEW_BASE_PATH = '~/.claude/.private-journal';

function expandHome(p: string): string {
  return p.replace(/^~/, process.env.HOME || '');
}

function extractProjectFromPath(sourcePath: string): string {
  // ~/Dev/betterpack/.private-journal -> betterpack
  // ~/.private-journal -> general
  // ~/Dev/.private-journal -> general
  const parts = sourcePath.split('/');
  const journalIdx = parts.findIndex(p => p === '.private-journal');
  if (journalIdx > 0) {
    const projectDir = parts[journalIdx - 1];
    // If parent is Dev, home (~), or username, treat as general
    if (projectDir === 'Dev' || projectDir === '~' || projectDir === process.env.USER) {
      return 'general';
    }
    return projectDir;
  }
  return 'general';
}

async function migrateEntry(
  sourcePath: string,
  destDir: string,
  projectName: string,
  dryRun: boolean
): Promise<void> {
  const content = await fs.readFile(sourcePath, 'utf8');

  // Add project to frontmatter if not present
  let newContent = content;
  if (content.startsWith('---')) {
    const endOfFrontmatter = content.indexOf('---', 3);
    if (endOfFrontmatter > 0 && !content.slice(0, endOfFrontmatter).includes('project:')) {
      newContent = content.slice(0, endOfFrontmatter) +
                   `project: ${projectName}\n` +
                   content.slice(endOfFrontmatter);
    }
  }

  const fileName = path.basename(sourcePath);
  const dateDir = path.basename(path.dirname(sourcePath));
  const destPath = path.join(destDir, 'entries', dateDir, fileName);

  if (dryRun) {
    console.log(`[DRY RUN] Would migrate: ${sourcePath} -> ${destPath}`);
    return;
  }

  await fs.mkdir(path.dirname(destPath), { recursive: true });
  await fs.writeFile(destPath, newContent, 'utf8');
  console.log(`Migrated: ${sourcePath} -> ${destPath}`);
}

async function migrateEmbedding(
  sourcePath: string,
  destDir: string,
  projectName: string,
  dryRun: boolean
): Promise<void> {
  const content = await fs.readFile(sourcePath, 'utf8');
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(content);
  } catch (parseError) {
    throw new Error(`Corrupted embedding file (invalid JSON): ${sourcePath}`);
  }

  // Add project field
  data.project = projectName;

  // Update path field to new location
  const fileName = path.basename(sourcePath);
  const dateDir = path.basename(path.dirname(sourcePath));
  const newMdPath = path.join(destDir, 'entries', dateDir, fileName.replace('.embedding', '.md'));
  data.path = newMdPath;

  const destPath = path.join(destDir, 'entries', dateDir, fileName);

  if (dryRun) {
    console.log(`[DRY RUN] Would migrate embedding: ${sourcePath}`);
    return;
  }

  await fs.mkdir(path.dirname(destPath), { recursive: true });
  await fs.writeFile(destPath, JSON.stringify(data, null, 2), 'utf8');
}

interface MigrationResult {
  migrated: number;
  failed: number;
  errors: string[];
}

async function migrateJournalDirectory(
  sourceDir: string,
  destDir: string,
  dryRun: boolean
): Promise<MigrationResult> {
  const expandedSource = expandHome(sourceDir);
  const projectName = extractProjectFromPath(sourceDir);
  const result: MigrationResult = { migrated: 0, failed: 0, errors: [] };

  let dateDirs: string[];
  try {
    dateDirs = await fs.readdir(expandedSource);
  } catch (error: unknown) {
    const err = error as NodeJS.ErrnoException;
    if (err.code !== 'ENOENT') {
      result.failed++;
      result.errors.push(`Failed to read directory ${sourceDir}: ${err.message}`);
    }
    return result;
  }

  for (const dateDir of dateDirs) {
    if (!dateDir.match(/^\d{4}-\d{2}-\d{2}$/)) continue;

    const datePath = path.join(expandedSource, dateDir);
    let files: string[];
    try {
      files = await fs.readdir(datePath);
    } catch (error: unknown) {
      const err = error as NodeJS.ErrnoException;
      result.failed++;
      result.errors.push(`Failed to read date directory ${datePath}: ${err.message}`);
      continue;
    }

    for (const file of files) {
      const filePath = path.join(datePath, file);

      try {
        if (file.endsWith('.md')) {
          await migrateEntry(filePath, destDir, projectName, dryRun);
          result.migrated++;
        } else if (file.endsWith('.embedding')) {
          await migrateEmbedding(filePath, destDir, projectName, dryRun);
        }
      } catch (error: unknown) {
        const err = error as Error;
        result.failed++;
        result.errors.push(`Failed to migrate ${filePath}: ${err.message}`);
      }
    }
  }

  return result;
}

async function main(): Promise<number> {
  const dryRun = process.argv.includes('--dry-run');
  const destDir = expandHome(NEW_BASE_PATH);

  console.log(`Migration ${dryRun ? '(DRY RUN)' : ''}`);
  console.log(`Destination: ${destDir}\n`);

  // Create destination structure
  if (!dryRun) {
    await fs.mkdir(path.join(destDir, 'entries'), { recursive: true });
    await fs.mkdir(path.join(destDir, 'projects'), { recursive: true });
  }

  let totalMigrated = 0;
  let totalFailed = 0;
  const allErrors: string[] = [];

  // Migrate user journal
  console.log(`\nMigrating user journal from ${OLD_USER_JOURNAL}...`);
  const userResult = await migrateJournalDirectory(OLD_USER_JOURNAL, destDir, dryRun);
  totalMigrated += userResult.migrated;
  totalFailed += userResult.failed;
  allErrors.push(...userResult.errors);

  // Migrate project journals
  for (const projectJournal of OLD_PROJECT_JOURNALS) {
    console.log(`\nMigrating ${projectJournal}...`);
    const result = await migrateJournalDirectory(projectJournal, destDir, dryRun);
    totalMigrated += result.migrated;
    totalFailed += result.failed;
    allErrors.push(...result.errors);
  }

  console.log(`\n${dryRun ? 'Would migrate' : 'Migrated'} ${totalMigrated} entries total.`);

  if (totalFailed > 0) {
    console.error(`\nFailed to migrate ${totalFailed} entries:`);
    for (const error of allErrors) {
      console.error(`  - ${error}`);
    }
    return 1;
  }

  return 0;
}

main()
  .then((exitCode) => {
    if (exitCode !== 0) {
      process.exit(exitCode);
    }
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });

// Export pure functions for testing
export { extractProjectFromPath, expandHome };

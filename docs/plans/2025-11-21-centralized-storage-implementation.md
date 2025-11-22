# Centralized Storage Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Consolidate all journal entries into `~/.claude/.private-journal/` with explicit project tagging and simplified 3-section schema.

**Architecture:** Single storage location with project field in frontmatter/embeddings. Entry sections simplified from 5 to 3 (nick, project, reflections). Summary docs generated separately via `/synthesize` command.

**Tech Stack:** TypeScript, Node.js, @xenova/transformers for embeddings

---

## Phase 1: Schema Updates

### Task 1: Update EmbeddingData interface

**Files:**
- Modify: `src/embeddings.ts:7-14`
- Test: `tests/embeddings.test.ts`

**Step 1: Write the failing test**

Add to `tests/embeddings.test.ts`:

```typescript
describe('EmbeddingData schema', () => {
  it('should support optional project field', () => {
    const data: EmbeddingData = {
      embedding: [0.1, 0.2],
      text: 'test',
      sections: ['nick'],
      timestamp: Date.now(),
      path: '/test/path.md',
      project: 'betterpack'
    };
    expect(data.project).toBe('betterpack');
  });

  it('should allow project to be undefined', () => {
    const data: EmbeddingData = {
      embedding: [0.1, 0.2],
      text: 'test',
      sections: ['nick'],
      timestamp: Date.now(),
      path: '/test/path.md'
    };
    expect(data.project).toBeUndefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/ntitus/Dev/mcp-servers/private-journal-mcp && npm test -- --testPathPattern=embeddings`

Expected: FAIL - property 'project' does not exist on type 'EmbeddingData'

**Step 3: Write minimal implementation**

Update `src/embeddings.ts`:

```typescript
export interface EmbeddingData {
  embedding: number[];
  text: string;
  sections: string[];
  timestamp: number;
  path: string;
  project?: string;  // NEW: explicit project tag
}
```

**Step 4: Run test to verify it passes**

Run: `cd /Users/ntitus/Dev/mcp-servers/private-journal-mcp && npm test -- --testPathPattern=embeddings`

Expected: PASS

**Step 5: Commit**

```bash
cd /Users/ntitus/Dev/mcp-servers/private-journal-mcp
git add src/embeddings.ts tests/embeddings.test.ts
git commit -m "feat: add project field to EmbeddingData interface"
```

---

### Task 2: Update ProcessThoughtsRequest with new sections

**Files:**
- Modify: `src/types.ts:18-24`

**Step 1: Update the interface**

Replace `ProcessThoughtsRequest` in `src/types.ts`:

```typescript
export interface ProcessThoughtsRequest {
  nick?: string;         // Understanding Nick - preferences, values, style, domains
  project?: string;      // Project learnings - architecture, decisions, gotchas
  reflections?: string;  // Session retrospective - what worked, what didn't
}
```

**Step 2: Build to verify types compile**

Run: `cd /Users/ntitus/Dev/mcp-servers/private-journal-mcp && npm run build`

Expected: Build succeeds (will have runtime errors until journal.ts updated)

**Step 3: Commit**

```bash
cd /Users/ntitus/Dev/mcp-servers/private-journal-mcp
git add src/types.ts
git commit -m "feat: simplify ProcessThoughtsRequest to 3 sections (nick, project, reflections)"
```

---

## Phase 2: Path Resolution

### Task 3: Create project detection utility

**Files:**
- Modify: `src/paths.ts`
- Test: `tests/paths.test.ts` (create)

**Step 1: Write the failing test**

Create `tests/paths.test.ts`:

```typescript
import { detectProjectName, resolveJournalBasePath } from '../src/paths.js';
import * as path from 'path';

describe('detectProjectName', () => {
  it('should extract project name from git repo root', () => {
    // When in /Users/ntitus/Dev/betterpack/src/components
    // Should return 'betterpack'
    const result = detectProjectName('/Users/ntitus/Dev/betterpack/src/components');
    expect(result).toBe('betterpack');
  });

  it('should return directory basename when not in git repo', () => {
    const result = detectProjectName('/tmp/random-folder');
    expect(result).toBe('random-folder');
  });

  it('should return "general" for home directory', () => {
    const result = detectProjectName(process.env.HOME || '/Users/ntitus');
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
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/ntitus/Dev/mcp-servers/private-journal-mcp && npm test -- --testPathPattern=paths`

Expected: FAIL - functions not exported

**Step 3: Write minimal implementation**

Replace `src/paths.ts`:

```typescript
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
```

**Step 4: Run test to verify it passes**

Run: `cd /Users/ntitus/Dev/mcp-servers/private-journal-mcp && npm test -- --testPathPattern=paths`

Expected: PASS

**Step 5: Commit**

```bash
cd /Users/ntitus/Dev/mcp-servers/private-journal-mcp
git add src/paths.ts tests/paths.test.ts
git commit -m "feat: centralize path resolution to ~/.claude/.private-journal/"
```

---

## Phase 3: Journal Manager Updates

### Task 4: Update JournalManager for new schema

**Files:**
- Modify: `src/journal.ts`
- Test: `tests/journal.test.ts`

**Step 1: Write the failing test**

Add to `tests/journal.test.ts`:

```typescript
describe('writeThoughts with new schema', () => {
  it('should write entry with nick section', async () => {
    const manager = new JournalManager();
    await manager.writeThoughts({
      nick: 'Prefers concise communication, values explicit control'
    });

    // Verify file was created in centralized location
    const basePath = resolveJournalBasePath();
    const entries = await fs.readdir(path.join(basePath, 'entries'));
    expect(entries.length).toBeGreaterThan(0);
  });

  it('should include project tag in frontmatter', async () => {
    const manager = new JournalManager();
    await manager.writeThoughts({
      project: 'Architecture uses React Query for data fetching'
    });

    // Read the created file and check frontmatter
    const basePath = resolveJournalBasePath();
    const dateDir = new Date().toISOString().split('T')[0];
    const dayPath = path.join(basePath, 'entries', dateDir);
    const files = await fs.readdir(dayPath);
    const content = await fs.readFile(path.join(dayPath, files[0]), 'utf8');

    expect(content).toContain('project:');
  });

  it('should write reflections section', async () => {
    const manager = new JournalManager();
    await manager.writeThoughts({
      reflections: 'Session went well. TDD approach helped catch bugs early.'
    });

    const basePath = resolveJournalBasePath();
    const dateDir = new Date().toISOString().split('T')[0];
    const dayPath = path.join(basePath, 'entries', dateDir);
    const files = await fs.readdir(dayPath);
    const content = await fs.readFile(path.join(dayPath, files[0]), 'utf8');

    expect(content).toContain('## Reflections');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/ntitus/Dev/mcp-servers/private-journal-mcp && npm test -- --testPathPattern=journal`

Expected: FAIL - old section names don't match

**Step 3: Write implementation**

Update `src/journal.ts` - key changes:

1. Remove split between project/user paths
2. Update `writeThoughts` to use new section names
3. Add project detection and tagging
4. Update `formatThoughts` for new sections

```typescript
// Key method updates in journal.ts:

async writeThoughts(thoughts: {
  nick?: string;
  project?: string;
  reflections?: string;
}): Promise<void> {
  const timestamp = new Date();
  const projectName = detectProjectName(process.cwd());

  const dateString = this.formatDate(timestamp);
  const timeString = this.formatTimestamp(timestamp);

  const entriesPath = resolveEntriesPath();
  const dayDirectory = path.join(entriesPath, dateString);
  const fileName = `${timeString}.md`;
  const filePath = path.join(dayDirectory, fileName);

  await this.ensureDirectoryExists(dayDirectory);

  const formattedEntry = this.formatThoughts(thoughts, timestamp, projectName);
  await fs.writeFile(filePath, formattedEntry, 'utf8');

  // Generate and save embedding with project tag
  await this.generateEmbeddingForEntry(filePath, formattedEntry, timestamp, projectName);
}

private formatThoughts(thoughts: {
  nick?: string;
  project?: string;
  reflections?: string;
}, timestamp: Date, projectName: string): string {
  const timeDisplay = timestamp.toLocaleTimeString('en-US', {
    hour12: true,
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit'
  });
  const dateDisplay = timestamp.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const sections = [];

  if (thoughts.nick) {
    sections.push(`## Nick\n\n${thoughts.nick}`);
  }

  if (thoughts.project) {
    sections.push(`## Project\n\n${thoughts.project}`);
  }

  if (thoughts.reflections) {
    sections.push(`## Reflections\n\n${thoughts.reflections}`);
  }

  return `---
title: "${timeDisplay} - ${dateDisplay}"
date: ${timestamp.toISOString()}
timestamp: ${timestamp.getTime()}
project: ${projectName}
---

${sections.join('\n\n')}
`;
}

private async generateEmbeddingForEntry(
  filePath: string,
  content: string,
  timestamp: Date,
  projectName: string
): Promise<void> {
  try {
    const { text, sections } = this.embeddingService.extractSearchableText(content);

    if (text.trim().length === 0) {
      return;
    }

    const embedding = await this.embeddingService.generateEmbedding(text);

    const embeddingData: EmbeddingData = {
      embedding,
      text,
      sections,
      timestamp: timestamp.getTime(),
      path: filePath,
      project: projectName  // NEW
    };

    await this.embeddingService.saveEmbedding(filePath, embeddingData);
  } catch (error) {
    console.error(`Failed to generate embedding for ${filePath}:`, error);
  }
}
```

**Step 4: Run test to verify it passes**

Run: `cd /Users/ntitus/Dev/mcp-servers/private-journal-mcp && npm test -- --testPathPattern=journal`

Expected: PASS

**Step 5: Commit**

```bash
cd /Users/ntitus/Dev/mcp-servers/private-journal-mcp
git add src/journal.ts tests/journal.test.ts
git commit -m "feat: update JournalManager for centralized storage and new sections"
```

---

## Phase 4: Search Updates

### Task 5: Update SearchService for project filtering

**Files:**
- Modify: `src/search.ts`
- Test: `tests/search.test.ts` (create if not exists)

**Step 1: Write the failing test**

```typescript
describe('SearchService with project filtering', () => {
  it('should filter results by project', async () => {
    const service = new SearchService();
    const results = await service.search('architecture', {
      project: 'betterpack'
    });

    results.forEach(result => {
      expect(result.project).toBe('betterpack');
    });
  });

  it('should return all projects when no filter specified', async () => {
    const service = new SearchService();
    const results = await service.search('learnings');

    // Should include entries from multiple projects
    const projects = new Set(results.map(r => r.project));
    expect(projects.size).toBeGreaterThanOrEqual(1);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/ntitus/Dev/mcp-servers/private-journal-mcp && npm test -- --testPathPattern=search`

Expected: FAIL - project not in SearchOptions or SearchResult

**Step 3: Write implementation**

Update `src/search.ts`:

```typescript
export interface SearchResult {
  path: string;
  score: number;
  text: string;
  sections: string[];
  timestamp: number;
  excerpt: string;
  project?: string;  // CHANGED: from type to project
}

export interface SearchOptions {
  limit?: number;
  minScore?: number;
  sections?: string[];
  dateRange?: {
    start?: Date;
    end?: Date;
  };
  project?: string;  // NEW: filter by project name
}

// In search() method, add project filtering:
const filtered = allEmbeddings.filter(embedding => {
  // Filter by project if specified
  if (options.project && embedding.project !== options.project) {
    return false;
  }

  // ... existing section and date filtering
});
```

**Step 4: Run test to verify it passes**

Run: `cd /Users/ntitus/Dev/mcp-servers/private-journal-mcp && npm test -- --testPathPattern=search`

Expected: PASS

**Step 5: Commit**

```bash
cd /Users/ntitus/Dev/mcp-servers/private-journal-mcp
git add src/search.ts tests/search.test.ts
git commit -m "feat: add project filtering to SearchService"
```

---

## Phase 5: Server Tool Updates

### Task 6: Update process_thoughts tool parameters

**Files:**
- Modify: `src/server.ts`

**Step 1: Update tool definition**

Find the `process_thoughts` tool definition in `src/server.ts` and update:

```typescript
{
  name: 'process_thoughts',
  description: `Write to your private journal. Use this to capture learnings and build context for future sessions.

Sections:
- nick: Understanding Nick - his preferences, values, communication style, domains (TrainingPeaks, cycling, TPV)
- project: Project-specific learnings - architecture, decisions, gotchas, things tried and failed
- reflections: Session retrospective - what worked, what didn't, what to do differently next time

Write to any combination of sections. Entries are automatically tagged with the current project.`,
  inputSchema: {
    type: 'object',
    properties: {
      nick: {
        type: 'string',
        description: 'Observations about Nick - preferences, values, style, domain context'
      },
      project: {
        type: 'string',
        description: 'Project learnings - architecture, decisions, gotchas, failures'
      },
      reflections: {
        type: 'string',
        description: 'Session retrospective - what worked, what didn\'t, learnings'
      }
    }
  }
}
```

**Step 2: Update search tool to support project filter**

```typescript
{
  name: 'search_journal',
  // ... existing description
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query' },
      limit: { type: 'number', description: 'Max results (default 10)' },
      sections: {
        type: 'array',
        items: { type: 'string' },
        description: 'Filter by sections: nick, project, reflections'
      },
      project: {
        type: 'string',
        description: 'Filter by project name (e.g., "betterpack")'
      }
    },
    required: ['query']
  }
}
```

**Step 3: Build and verify**

Run: `cd /Users/ntitus/Dev/mcp-servers/private-journal-mcp && npm run build`

Expected: Build succeeds

**Step 4: Commit**

```bash
cd /Users/ntitus/Dev/mcp-servers/private-journal-mcp
git add src/server.ts
git commit -m "feat: update MCP tool definitions for new schema"
```

---

## Phase 6: Migration Script

### Task 7: Create migration script

**Files:**
- Create: `scripts/migrate-entries.ts`

**Step 1: Write migration script**

Create `scripts/migrate-entries.ts`:

```typescript
#!/usr/bin/env npx ts-node

/**
 * Migration script: Consolidate journal entries to ~/.claude/.private-journal/
 *
 * Usage: npx ts-node scripts/migrate-entries.ts [--dry-run]
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
  const parts = sourcePath.split('/');
  const journalIdx = parts.findIndex(p => p === '.private-journal');
  if (journalIdx > 0) {
    const projectDir = parts[journalIdx - 1];
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
  const data = JSON.parse(content);

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

async function migrateJournalDirectory(
  sourceDir: string,
  destDir: string,
  dryRun: boolean
): Promise<number> {
  const expandedSource = expandHome(sourceDir);
  const projectName = extractProjectFromPath(sourceDir);
  let count = 0;

  try {
    const dateDirs = await fs.readdir(expandedSource);

    for (const dateDir of dateDirs) {
      if (!dateDir.match(/^\d{4}-\d{2}-\d{2}$/)) continue;

      const datePath = path.join(expandedSource, dateDir);
      const files = await fs.readdir(datePath);

      for (const file of files) {
        const filePath = path.join(datePath, file);

        if (file.endsWith('.md')) {
          await migrateEntry(filePath, destDir, projectName, dryRun);
          count++;
        } else if (file.endsWith('.embedding')) {
          await migrateEmbedding(filePath, destDir, projectName, dryRun);
        }
      }
    }
  } catch (error: any) {
    if (error.code !== 'ENOENT') {
      console.error(`Error migrating ${sourceDir}:`, error.message);
    }
  }

  return count;
}

async function main() {
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

  // Migrate user journal
  console.log(`\nMigrating user journal from ${OLD_USER_JOURNAL}...`);
  totalMigrated += await migrateJournalDirectory(OLD_USER_JOURNAL, destDir, dryRun);

  // Migrate project journals
  for (const projectJournal of OLD_PROJECT_JOURNALS) {
    console.log(`\nMigrating ${projectJournal}...`);
    totalMigrated += await migrateJournalDirectory(projectJournal, destDir, dryRun);
  }

  console.log(`\n${dryRun ? 'Would migrate' : 'Migrated'} ${totalMigrated} entries total.`);
}

main().catch(console.error);
```

**Step 2: Add script to package.json**

Add to `package.json` scripts:

```json
{
  "scripts": {
    "migrate": "npx ts-node scripts/migrate-entries.ts",
    "migrate:dry-run": "npx ts-node scripts/migrate-entries.ts --dry-run"
  }
}
```

**Step 3: Test dry run**

Run: `cd /Users/ntitus/Dev/mcp-servers/private-journal-mcp && npm run migrate:dry-run`

Expected: Lists all entries that would be migrated without making changes

**Step 4: Commit**

```bash
cd /Users/ntitus/Dev/mcp-servers/private-journal-mcp
git add scripts/migrate-entries.ts package.json
git commit -m "feat: add migration script for consolidating journal entries"
```

---

## Phase 7: Build and Integration Test

### Task 8: Full build and manual test

**Step 1: Build everything**

Run: `cd /Users/ntitus/Dev/mcp-servers/private-journal-mcp && npm run build`

Expected: Build succeeds with no errors

**Step 2: Run all tests**

Run: `cd /Users/ntitus/Dev/mcp-servers/private-journal-mcp && npm test`

Expected: All tests pass

**Step 3: Run migration (actual)**

Run: `cd /Users/ntitus/Dev/mcp-servers/private-journal-mcp && npm run migrate`

Expected: All entries migrated to ~/.claude/.private-journal/

**Step 4: Manual test - write entry**

Start Claude with journal MCP and test:
- Write entry with `nick` section
- Write entry with `project` section
- Verify entries appear in ~/.claude/.private-journal/entries/

**Step 5: Manual test - search**

Test search with project filter:
- Search all entries
- Search with project filter
- Verify results match expected

**Step 6: Final commit**

```bash
cd /Users/ntitus/Dev/mcp-servers/private-journal-mcp
git add -A
git commit -m "chore: complete centralized storage implementation"
```

---

## Phase 8: Slash Commands (Future)

> Note: Slash commands (`/reflect`, `/synthesize`) are implemented as Claude Code commands, not MCP tools. This is a separate task to be done in `~/.claude/commands/`.

### Task 9: Create /reflect command

**Files:**
- Create: `~/.claude/commands/reflect.md`

**Content:**

```markdown
---
description: End-of-session reflection - capture learnings to journal
---

Use the private-journal MCP to write a session reflection.

Think about this session and write to the journal with:

1. **nick section**: Any new observations about Nick's preferences, communication style, or how he likes to work

2. **project section**: Any learnings about the current project - architecture decisions, gotchas discovered, patterns established

3. **reflections section**: Session retrospective - what went well, what could have been better, what you'd do differently

Be specific and actionable. These entries help future Claude instances work better with Nick.
```

### Task 10: Create /synthesize command

**Files:**
- Create: `~/.claude/commands/synthesize.md`

**Content:**

```markdown
---
description: Generate summary documents from journal entries
---

Generate/update the USER-SUMMARY.md and PROJECT-SUMMARY.md documents.

1. First, list recent journal entries to understand what's available
2. Read all relevant entries (last 90 days for user, all for current project)
3. Synthesize into summary documents:

**USER-SUMMARY.md** (~/.claude/.private-journal/USER-SUMMARY.md):
- Communication preferences
- Working style
- Technical preferences
- Pet peeves / anti-patterns
- What works well
- Domain context

**PROJECT-SUMMARY.md** (~/.claude/.private-journal/projects/{project}/PROJECT-SUMMARY.md):
- Architecture overview
- Key patterns/conventions
- Gotchas / landmines
- Decisions made and why

Write the updated summaries to their respective locations.
```

---

## Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| 1 | 1-2 | Schema updates (EmbeddingData, ProcessThoughtsRequest) |
| 2 | 3 | Path resolution centralization |
| 3 | 4 | JournalManager updates |
| 4 | 5 | SearchService project filtering |
| 5 | 6 | MCP tool definition updates |
| 6 | 7 | Migration script |
| 7 | 8 | Build and integration test |
| 8 | 9-10 | Slash commands (separate from MCP) |

**Estimated time:** 2-3 hours focused implementation

**After completion:** Push branch to origin, run `/reflect` to capture learnings about this implementation session.

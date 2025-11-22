// ABOUTME: Unit tests for journal writing functionality
// ABOUTME: Tests file system operations, timestamps, and formatting

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { JournalManager } from '../src/journal';
import { resolveJournalBasePath } from '../src/paths';

function getFormattedDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

describe('JournalManager', () => {
  let tempDir: string;
  let journalManager: JournalManager;
  let originalHome: string | undefined;
  let entriesPath: string;

  beforeEach(async () => {
    // Create temp dir structure that mimics ~/.claude/.private-journal/entries
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'journal-test-'));

    // Mock HOME environment so resolveJournalBasePath uses our temp dir
    originalHome = process.env.HOME;
    process.env.HOME = tempDir;

    // The entries will go to ~/.claude/.private-journal/entries
    entriesPath = path.join(tempDir, '.claude', '.private-journal', 'entries');

    journalManager = new JournalManager();
  });

  afterEach(async () => {
    // Restore original HOME
    if (originalHome !== undefined) {
      process.env.HOME = originalHome;
    } else {
      delete process.env.HOME;
    }

    await fs.rm(tempDir, { recursive: true, force: true });
  });

  test('writes journal entry to centralized location', async () => {
    const content = 'This is a test journal entry.';

    await journalManager.writeEntry(content);

    const today = new Date();
    const dateString = getFormattedDate(today);
    const dayDir = path.join(entriesPath, dateString);

    const files = await fs.readdir(dayDir);
    expect(files).toHaveLength(2); // .md and .embedding files

    const mdFile = files.find(f => f.endsWith('.md'));
    const embeddingFile = files.find(f => f.endsWith('.embedding'));

    expect(mdFile).toBeDefined();
    expect(embeddingFile).toBeDefined();
    expect(mdFile).toMatch(/^\d{2}-\d{2}-\d{2}-\d{6}\.md$/);
  });

  test('creates directory structure automatically', async () => {
    const content = 'Test entry';

    await journalManager.writeEntry(content);

    const today = new Date();
    const dateString = getFormattedDate(today);
    const dayDir = path.join(entriesPath, dateString);

    const stats = await fs.stat(dayDir);
    expect(stats.isDirectory()).toBe(true);
  });

  test('formats entry content correctly with project tag', async () => {
    const content = 'This is my journal entry content.';

    await journalManager.writeEntry(content);

    const today = new Date();
    const dateString = getFormattedDate(today);
    const dayDir = path.join(entriesPath, dateString);
    const files = await fs.readdir(dayDir);
    const mdFile = files.find(f => f.endsWith('.md'));
    expect(mdFile).toBeDefined();
    const filePath = path.join(dayDir, mdFile!);

    const fileContent = await fs.readFile(filePath, 'utf8');

    expect(fileContent).toContain('---');
    expect(fileContent).toContain('title: "');
    expect(fileContent).toContain('date: ');
    expect(fileContent).toContain('timestamp: ');
    expect(fileContent).toContain('project: '); // New: should include project tag
    expect(fileContent).toContain(' - ');
    expect(fileContent).toContain(content);

    // Check YAML frontmatter structure
    const lines = fileContent.split('\n');
    expect(lines[0]).toBe('---');
    expect(lines[1]).toMatch(/^title: ".*"$/);
    expect(lines[2]).toMatch(/^date: \d{4}-\d{2}-\d{2}T/);
    expect(lines[3]).toMatch(/^timestamp: \d+$/);
    expect(lines[4]).toMatch(/^project: .+$/);
    expect(lines[5]).toBe('---');
    expect(lines[6]).toBe('');
    expect(lines[7]).toBe(content);
  });

  test('handles multiple entries on same day', async () => {
    await journalManager.writeEntry('First entry');
    await journalManager.writeEntry('Second entry');

    const today = new Date();
    const dateString = getFormattedDate(today);
    const dayDir = path.join(entriesPath, dateString);
    const files = await fs.readdir(dayDir);

    expect(files).toHaveLength(4); // 2 .md files + 2 .embedding files
    const mdFiles = files.filter(f => f.endsWith('.md'));
    expect(mdFiles).toHaveLength(2);
    expect(mdFiles[0]).not.toEqual(mdFiles[1]);
  });

  test('handles empty content', async () => {
    const content = '';

    await journalManager.writeEntry(content);

    const today = new Date();
    const dateString = getFormattedDate(today);
    const dayDir = path.join(entriesPath, dateString);
    const files = await fs.readdir(dayDir);

    // Empty content only creates .md file, no .embedding (can't embed empty text)
    expect(files).toHaveLength(1);

    const filePath = path.join(dayDir, files[0]);
    const fileContent = await fs.readFile(filePath, 'utf8');

    expect(fileContent).toContain('---');
    expect(fileContent).toContain('title: "');
    expect(fileContent).toContain(' - ');
    expect(fileContent).toMatch(/date: \d{4}-\d{2}-\d{2}T/);
    expect(fileContent).toMatch(/timestamp: \d+/);
    expect(fileContent).toContain('project: ');
  });

  test('handles large content', async () => {
    const content = 'A'.repeat(10000);

    await journalManager.writeEntry(content);

    const today = new Date();
    const dateString = getFormattedDate(today);
    const dayDir = path.join(entriesPath, dateString);
    const files = await fs.readdir(dayDir);
    const filePath = path.join(dayDir, files[0]);

    const fileContent = await fs.readFile(filePath, 'utf8');
    expect(fileContent).toContain(content);
  });

  describe('writeThoughts with new schema', () => {
    test('writes entry with user section', async () => {
      await journalManager.writeThoughts({
        user: 'Prefers concise communication, values explicit control'
      });

      const today = new Date();
      const dateString = getFormattedDate(today);
      const dayDir = path.join(entriesPath, dateString);

      const files = await fs.readdir(dayDir);
      expect(files.length).toBeGreaterThan(0);

      const mdFile = files.find(f => f.endsWith('.md'));
      expect(mdFile).toBeDefined();
      const content = await fs.readFile(path.join(dayDir, mdFile!), 'utf8');

      expect(content).toContain('## User');
      expect(content).toContain('Prefers concise communication, values explicit control');
    });

    test('includes project tag in frontmatter', async () => {
      await journalManager.writeThoughts({
        project: 'Architecture uses React Query for data fetching'
      });

      const today = new Date();
      const dateString = getFormattedDate(today);
      const dayDir = path.join(entriesPath, dateString);
      const files = await fs.readdir(dayDir);
      const mdFile = files.find(f => f.endsWith('.md'));
      const content = await fs.readFile(path.join(dayDir, mdFile!), 'utf8');

      expect(content).toContain('project:');
      // Project tag should be in frontmatter
      const frontmatter = content.split('---')[1];
      expect(frontmatter).toContain('project:');
    });

    test('writes reflections section', async () => {
      await journalManager.writeThoughts({
        reflections: 'Session went well. TDD approach helped catch bugs early.'
      });

      const today = new Date();
      const dateString = getFormattedDate(today);
      const dayDir = path.join(entriesPath, dateString);
      const files = await fs.readdir(dayDir);
      const mdFile = files.find(f => f.endsWith('.md'));
      const content = await fs.readFile(path.join(dayDir, mdFile!), 'utf8');

      expect(content).toContain('## Reflections');
      expect(content).toContain('Session went well. TDD approach helped catch bugs early.');
    });

    test('writes all sections when provided', async () => {
      await journalManager.writeThoughts({
        user: 'Likes TypeScript strict mode',
        project: 'Uses centralized state management',
        reflections: 'Good progress today'
      });

      const today = new Date();
      const dateString = getFormattedDate(today);
      const dayDir = path.join(entriesPath, dateString);
      const files = await fs.readdir(dayDir);
      const mdFile = files.find(f => f.endsWith('.md'));
      const content = await fs.readFile(path.join(dayDir, mdFile!), 'utf8');

      expect(content).toContain('## User');
      expect(content).toContain('Likes TypeScript strict mode');
      expect(content).toContain('## Project');
      expect(content).toContain('Uses centralized state management');
      expect(content).toContain('## Reflections');
      expect(content).toContain('Good progress today');
    });

    test('writes to centralized location regardless of section type', async () => {
      // All entries should go to the centralized location
      await journalManager.writeThoughts({
        user: 'User context data'
      });

      await journalManager.writeThoughts({
        project: 'Project specific data'
      });

      const today = new Date();
      const dateString = getFormattedDate(today);
      const dayDir = path.join(entriesPath, dateString);

      // Both entries should be in the same centralized location
      const files = await fs.readdir(dayDir);
      const mdFiles = files.filter(f => f.endsWith('.md'));
      expect(mdFiles).toHaveLength(2);
    });

    test('includes project in embedding data', async () => {
      await journalManager.writeThoughts({
        user: 'Test embedding project field'
      });

      const today = new Date();
      const dateString = getFormattedDate(today);
      const dayDir = path.join(entriesPath, dateString);
      const files = await fs.readdir(dayDir);
      const embeddingFile = files.find(f => f.endsWith('.embedding'));
      expect(embeddingFile).toBeDefined();

      const embeddingContent = await fs.readFile(path.join(dayDir, embeddingFile!), 'utf8');
      const embeddingData = JSON.parse(embeddingContent);

      expect(embeddingData).toHaveProperty('project');
      expect(typeof embeddingData.project).toBe('string');
    });
  });

  describe('generateMissingEmbeddings', () => {
    test('generates embeddings for entries without them', async () => {
      // Create an entry without embedding
      const today = new Date();
      const dateString = getFormattedDate(today);
      const dayDir = path.join(entriesPath, dateString);
      await fs.mkdir(dayDir, { recursive: true });

      const mdContent = `---
title: "Test Entry"
date: ${today.toISOString()}
timestamp: ${today.getTime()}
project: test-project
---

## User

Test content for embedding generation
`;
      await fs.writeFile(path.join(dayDir, '12-00-00-000000.md'), mdContent, 'utf8');

      const count = await journalManager.generateMissingEmbeddings();

      expect(count).toBe(1);

      // Verify embedding file was created
      const files = await fs.readdir(dayDir);
      expect(files).toContain('12-00-00-000000.embedding');
    });
  });
});

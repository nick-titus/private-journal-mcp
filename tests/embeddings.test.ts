// ABOUTME: Unit tests for embedding functionality and search capabilities
// ABOUTME: Tests embedding generation, storage, and semantic search operations

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

import { EmbeddingService, EmbeddingData } from '../src/embeddings';
import { SearchService } from '../src/search';
import { JournalManager } from '../src/journal';

describe('EmbeddingData schema', () => {
  it('should support optional project field', () => {
    const data: EmbeddingData = {
      embedding: [0.1, 0.2],
      text: 'test',
      sections: ['user'],
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
      sections: ['user'],
      timestamp: Date.now(),
      path: '/test/path.md'
    };
    expect(data.project).toBeUndefined();
  });
});

describe('Embedding and Search functionality', () => {
  let tempDir: string;
  let journalManager: JournalManager;
  let searchService: SearchService;
  let originalHome: string | undefined;
  let entriesPath: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'journal-embed-test-'));

    // Mock HOME environment so all paths use our temp dir
    originalHome = process.env.HOME;
    process.env.HOME = tempDir;

    // Entries will go to ~/.claude/.private-journal/entries
    entriesPath = path.join(tempDir, '.claude', '.private-journal', 'entries');

    journalManager = new JournalManager();
    searchService = new SearchService();
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

  test('embedding service initializes and generates embeddings', async () => {
    const embeddingService = EmbeddingService.getInstance();

    const text = 'This is a test journal entry about TypeScript programming.';
    const embedding = await embeddingService.generateEmbedding(text);

    expect(embedding).toBeDefined();
    expect(Array.isArray(embedding)).toBe(true);
    expect(embedding.length).toBeGreaterThan(0);
    expect(typeof embedding[0]).toBe('number');
  }, 30000); // 30 second timeout for model loading

  test('embedding service extracts searchable text from markdown', async () => {
    const embeddingService = EmbeddingService.getInstance();

    const markdown = `---
title: "Test Entry"
date: 2025-05-31T12:00:00.000Z
timestamp: 1717056000000
project: test-project
---

## User

User prefers explicit control over implicit behavior.

## Reflections

TypeScript interfaces are really powerful for maintaining code quality.`;

    const { text, sections } = embeddingService.extractSearchableText(markdown);

    expect(text).toContain('User prefers explicit control over implicit behavior');
    expect(text).toContain('TypeScript interfaces are really powerful');
    expect(text).not.toContain('title: "Test Entry"');
    expect(sections).toEqual(['User', 'Reflections']);
  });

  test('cosine similarity calculation works correctly', async () => {
    const embeddingService = EmbeddingService.getInstance();

    const vector1 = [1, 0, 0];
    const vector2 = [1, 0, 0];
    const vector3 = [0, 1, 0];

    const similarity1 = embeddingService.cosineSimilarity(vector1, vector2);
    const similarity2 = embeddingService.cosineSimilarity(vector1, vector3);

    expect(similarity1).toBeCloseTo(1.0, 5); // Identical vectors
    expect(similarity2).toBeCloseTo(0.0, 5); // Orthogonal vectors
  });

  test('journal manager generates embeddings when writing thoughts', async () => {
    const thoughts = {
      user: 'User prefers concise code and explicit control flow',
      reflections: 'Vector embeddings provide semantic understanding of text'
    };

    await journalManager.writeThoughts(thoughts);

    // Check that embedding files were created in centralized location
    const today = new Date();
    const dateString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const dayDir = path.join(entriesPath, dateString);
    const files = await fs.readdir(dayDir);

    const mdFile = files.find(f => f.endsWith('.md'));
    const embeddingFile = files.find(f => f.endsWith('.embedding'));

    expect(mdFile).toBeDefined();
    expect(embeddingFile).toBeDefined();

    if (embeddingFile) {
      const embeddingContent = await fs.readFile(path.join(dayDir, embeddingFile), 'utf8');
      const embeddingData = JSON.parse(embeddingContent);

      expect(embeddingData.embedding).toBeDefined();
      expect(Array.isArray(embeddingData.embedding)).toBe(true);
      expect(embeddingData.text).toContain('concise code');
      expect(embeddingData.sections).toContain('User');
      expect(embeddingData.sections).toContain('Reflections');
      expect(embeddingData.project).toBeDefined();
    }
  }, 60000);

  test('search service finds semantically similar entries', async () => {
    // Write some test entries with new section names
    await journalManager.writeThoughts({
      user: 'I feel frustrated with debugging TypeScript errors'
    });

    await journalManager.writeThoughts({
      reflections: 'JavaScript async patterns can be tricky to understand'
    });

    await journalManager.writeThoughts({
      projectNotes: 'The React component architecture is working well'
    });

    // Wait a moment for embeddings to be generated
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Search for similar entries
    const results = await searchService.search('feeling upset about TypeScript problems');

    expect(results.length).toBeGreaterThan(0);

    // One of the top results should be about TypeScript frustration
    // (exact ordering can vary with embedding models, so we check top 3)
    const topResults = results.slice(0, Math.min(3, results.length));
    const frustratedEntry = topResults.find(r => r.text.includes('frustrated') && r.text.includes('TypeScript'));

    expect(frustratedEntry).toBeDefined();
    expect(frustratedEntry!.score).toBeGreaterThan(0.1);
  }, 90000);

  test('search service can filter by sections', async () => {
    // Add entries with different sections
    await journalManager.writeThoughts({
      projectNotes: 'This project uses React and TypeScript'
    });

    await journalManager.writeThoughts({
      user: 'I enjoy working with modern JavaScript frameworks'
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Search with section filter
    const projectResults = await searchService.search('React TypeScript', { sections: ['Project'] });
    const userResults = await searchService.search('React TypeScript', { sections: ['User'] });

    // Project results should contain entries with Project section
    if (projectResults.length > 0) {
      expect(projectResults[0].sections).toContain('Project');
    }

    // User results should contain entries with User section
    if (userResults.length > 0) {
      expect(userResults[0].sections).toContain('User');
    }
  }, 90000);
});

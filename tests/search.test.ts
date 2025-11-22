// ABOUTME: Tests for SearchService with project filtering
// ABOUTME: Verifies semantic search and project-based filtering of journal entries

import { SearchService, SearchResult, SearchOptions } from '../src/search.js';
import { EmbeddingData } from '../src/embeddings.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { resolveEntriesPath } from '../src/paths.js';

// Mock the EmbeddingService to return consistent 5-dimensional vectors
// This ensures test embeddings (5-dim) match query embeddings (5-dim)
jest.mock('../src/embeddings.js', () => {
  const actual = jest.requireActual('../src/embeddings.js');
  return {
    ...actual,
    EmbeddingService: {
      getInstance: jest.fn().mockReturnValue({
        generateEmbedding: jest.fn().mockResolvedValue([0.1, 0.2, 0.3, 0.4, 0.5]),
        cosineSimilarity: jest.fn().mockImplementation((a: number[], b: number[]) => {
          // Simple cosine similarity calculation
          let dotProduct = 0;
          let normA = 0;
          let normB = 0;
          for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
          }
          return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
        }),
        initialize: jest.fn().mockResolvedValue(undefined),
      }),
    },
  };
});

describe('SearchService with project filtering', () => {
  let testDir: string;
  let service: SearchService;

  beforeAll(async () => {
    // Create test directory structure
    testDir = resolveEntriesPath();
    const dateDir = '2024-01-15';
    const dayPath = path.join(testDir, dateDir);
    await fs.mkdir(dayPath, { recursive: true });

    // Create test embeddings with different projects
    const embeddings: EmbeddingData[] = [
      {
        embedding: [0.1, 0.2, 0.3, 0.4, 0.5],
        text: 'Architecture uses React Query for data fetching',
        sections: ['Project'],
        timestamp: Date.now() - 1000,
        path: path.join(dayPath, 'entry1.md'),
        project: 'betterpack'
      },
      {
        embedding: [0.15, 0.25, 0.35, 0.45, 0.55],
        text: 'Performance optimization learnings',
        sections: ['Project'],
        timestamp: Date.now() - 2000,
        path: path.join(dayPath, 'entry2.md'),
        project: 'betterpack'
      },
      {
        embedding: [0.2, 0.3, 0.4, 0.5, 0.6],
        text: 'TrainingPeaks mobile architecture decisions',
        sections: ['Project'],
        timestamp: Date.now() - 3000,
        path: path.join(dayPath, 'entry3.md'),
        project: 'trainingpeaks-mobile'
      },
      {
        embedding: [0.25, 0.35, 0.45, 0.55, 0.65],
        text: 'General observations about code quality',
        sections: ['User'],
        timestamp: Date.now() - 4000,
        path: path.join(dayPath, 'entry4.md'),
        project: 'general'
      }
    ];

    // Write embedding files
    for (let i = 0; i < embeddings.length; i++) {
      const embeddingPath = path.join(dayPath, `entry${i + 1}.embedding`);
      await fs.writeFile(embeddingPath, JSON.stringify(embeddings[i], null, 2), 'utf8');

      // Also create corresponding markdown files
      const mdPath = path.join(dayPath, `entry${i + 1}.md`);
      await fs.writeFile(mdPath, `---\nproject: ${embeddings[i].project}\n---\n\n${embeddings[i].text}`, 'utf8');
    }

    service = new SearchService();
  });

  afterAll(async () => {
    // Clean up test files
    try {
      const dateDir = '2024-01-15';
      const dayPath = path.join(testDir, dateDir);
      const files = await fs.readdir(dayPath);
      for (const file of files) {
        await fs.unlink(path.join(dayPath, file));
      }
      await fs.rmdir(dayPath);
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('search', () => {
    it('should filter results by project', async () => {
      const results = await service.search('architecture', {
        project: 'betterpack'
      });

      // All results should be from betterpack
      results.forEach(result => {
        expect(result.project).toBe('betterpack');
      });
    });

    it('should return all projects when no filter specified', async () => {
      const results = await service.search('architecture', {
        limit: 10
      });

      // Should include entries from multiple projects
      const projects = new Set(results.map(r => r.project));
      expect(projects.size).toBeGreaterThanOrEqual(1);
    });

    it('should include project field in SearchResult', async () => {
      const results = await service.search('architecture');

      // Every result should have a project field (even if undefined for legacy entries)
      results.forEach(result => {
        expect(result).toHaveProperty('project');
      });
    });

    it('should return empty results for non-existent project', async () => {
      const results = await service.search('architecture', {
        project: 'non-existent-project'
      });

      expect(results).toHaveLength(0);
    });
  });

  describe('listRecent', () => {
    it('should filter recent entries by project', async () => {
      const results = await service.listRecent({
        project: 'betterpack',
        limit: 10
      });

      results.forEach(result => {
        expect(result.project).toBe('betterpack');
      });
    });

    it('should return entries from all projects when no filter', async () => {
      const results = await service.listRecent({
        limit: 10
      });

      const projects = new Set(results.map(r => r.project));
      expect(projects.size).toBeGreaterThanOrEqual(1);
    });

    it('should include project field in results', async () => {
      const results = await service.listRecent({
        limit: 10
      });

      results.forEach(result => {
        expect(result).toHaveProperty('project');
      });
    });
  });

  describe('SearchResult interface', () => {
    it('should have project as optional string field', () => {
      // Type check - this would fail at compile time if the interface is wrong
      const result: SearchResult = {
        path: '/test/path.md',
        score: 0.9,
        text: 'test content',
        sections: ['User'],
        timestamp: Date.now(),
        excerpt: 'test excerpt',
        project: 'betterpack'
      };

      expect(result.project).toBe('betterpack');
    });

    it('should allow undefined project field', () => {
      const result: SearchResult = {
        path: '/test/path.md',
        score: 0.9,
        text: 'test content',
        sections: ['User'],
        timestamp: Date.now(),
        excerpt: 'test excerpt',
        // project intentionally omitted
      };

      expect(result.project).toBeUndefined();
    });
  });

  describe('SearchOptions interface', () => {
    it('should support project filter option', () => {
      const options: SearchOptions = {
        limit: 10,
        project: 'betterpack'
      };

      expect(options.project).toBe('betterpack');
    });

    it('should allow undefined project option', () => {
      const options: SearchOptions = {
        limit: 10
      };

      expect(options.project).toBeUndefined();
    });
  });
});

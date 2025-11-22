// ABOUTME: Journal search functionality with vector similarity and text matching
// ABOUTME: Provides unified search across all journal entries with project filtering

import * as fs from 'fs/promises';
import * as path from 'path';
import { EmbeddingService, EmbeddingData } from './embeddings.js';
import { resolveEntriesPath } from './paths.js';

export interface SearchResult {
  path: string;
  score: number;
  text: string;
  sections: string[];
  timestamp: number;
  excerpt: string;
  project?: string;  // Project name from centralized storage
  warning?: string;  // Warning message if some embeddings failed to load
}

export interface SearchOptions {
  limit?: number;
  minScore?: number;
  sections?: string[];
  dateRange?: {
    start?: Date;
    end?: Date;
  };
  project?: string;  // Filter by project name
}

export class SearchService {
  private embeddingService: EmbeddingService;
  private entriesPath: string;

  constructor() {
    this.embeddingService = EmbeddingService.getInstance();
    this.entriesPath = resolveEntriesPath();
  }

  async search(query: string, options: SearchOptions = {}): Promise<{ results: SearchResult[]; warning?: string }> {
    const {
      limit = 10,
      minScore = 0.1,
      sections,
      dateRange,
      project
    } = options;

    // Generate query embedding
    const queryEmbedding = await this.embeddingService.generateEmbedding(query);

    // Collect all embeddings from centralized storage
    const { embeddings: allEmbeddings, failedCount } = await this.loadEmbeddingsFromPath(this.entriesPath);

    // Filter by criteria
    const filtered = allEmbeddings.filter(embedding => {
      // Filter by project if specified
      if (project && embedding.project !== project) {
        return false;
      }

      // Filter by sections if specified
      if (sections && sections.length > 0) {
        const hasMatchingSection = sections.some(section =>
          embedding.sections.some(embeddingSection =>
            embeddingSection.toLowerCase().includes(section.toLowerCase())
          )
        );
        if (!hasMatchingSection) return false;
      }

      // Filter by date range
      if (dateRange) {
        const entryDate = new Date(embedding.timestamp);
        if (dateRange.start && entryDate < dateRange.start) return false;
        if (dateRange.end && entryDate > dateRange.end) return false;
      }

      return true;
    });

    // Calculate similarities and sort
    const results: SearchResult[] = filtered
      .map(embedding => {
        const score = this.embeddingService.cosineSimilarity(queryEmbedding, embedding.embedding);
        const excerpt = this.generateExcerpt(embedding.text, query);

        return {
          path: embedding.path,
          score,
          text: embedding.text,
          sections: embedding.sections,
          timestamp: embedding.timestamp,
          excerpt,
          project: embedding.project
        };
      })
      .filter(result => result.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    // Add warning if many embeddings failed to load
    let warning: string | undefined;
    if (failedCount > 0) {
      warning = `Warning: ${failedCount} embedding(s) failed to load. Some entries may not appear in search results.`;
    }

    return { results, warning };
  }

  async listRecent(options: SearchOptions = {}): Promise<{ results: SearchResult[]; warning?: string }> {
    const {
      limit = 10,
      project,
      dateRange
    } = options;

    // Load all embeddings from centralized storage
    const { embeddings: allEmbeddings, failedCount } = await this.loadEmbeddingsFromPath(this.entriesPath);

    // Filter by criteria
    const filtered = allEmbeddings.filter(embedding => {
      // Filter by project if specified
      if (project && embedding.project !== project) {
        return false;
      }

      // Filter by date range
      if (dateRange) {
        const entryDate = new Date(embedding.timestamp);
        if (dateRange.start && entryDate < dateRange.start) return false;
        if (dateRange.end && entryDate > dateRange.end) return false;
      }

      return true;
    });

    // Sort by timestamp (most recent first) and limit
    const results: SearchResult[] = filtered
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit)
      .map(embedding => ({
        path: embedding.path,
        score: 1, // No similarity score for recent entries
        text: embedding.text,
        sections: embedding.sections,
        timestamp: embedding.timestamp,
        excerpt: this.generateExcerpt(embedding.text, '', 150),
        project: embedding.project
      }));

    // Add warning if many embeddings failed to load
    let warning: string | undefined;
    if (failedCount > 0) {
      warning = `Warning: ${failedCount} embedding(s) failed to load. Some entries may not appear in results.`;
    }

    return { results, warning };
  }

  async readEntry(filePath: string): Promise<string | null> {
    try {
      return await fs.readFile(filePath, 'utf8');
    } catch (error) {
      if ((error as any)?.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  private async loadEmbeddingsFromPath(basePath: string): Promise<{ embeddings: EmbeddingData[]; failedCount: number }> {
    const embeddings: EmbeddingData[] = [];
    let failedCount = 0;

    try {
      const dayDirs = await fs.readdir(basePath);

      for (const dayDir of dayDirs) {
        const dayPath = path.join(basePath, dayDir);
        const stat = await fs.stat(dayPath);

        if (!stat.isDirectory() || !dayDir.match(/^\d{4}-\d{2}-\d{2}$/)) {
          continue;
        }

        const files = await fs.readdir(dayPath);
        const embeddingFiles = files.filter(file => file.endsWith('.embedding'));

        for (const embeddingFile of embeddingFiles) {
          try {
            const embeddingPath = path.join(dayPath, embeddingFile);
            const content = await fs.readFile(embeddingPath, 'utf8');
            const embeddingData: EmbeddingData = JSON.parse(content);
            embeddings.push(embeddingData);
          } catch (error) {
            console.error(`Failed to load embedding ${embeddingFile}:`, error);
            failedCount++;
            // Continue with other files
          }
        }
      }
    } catch (error) {
      if ((error as any)?.code === 'ENOENT') {
        // Directory doesn't exist - return empty array (this is fine for new installations)
        return { embeddings: [], failedCount: 0 };
      }
      // Re-throw non-ENOENT errors so users know something is wrong
      throw new Error(`Failed to read embeddings from ${basePath}: ${error instanceof Error ? error.message : error}`);
    }

    return { embeddings, failedCount };
  }

  private generateExcerpt(text: string, query: string, maxLength: number = 200): string {
    if (!query || query.trim() === '') {
      return text.slice(0, maxLength) + (text.length > maxLength ? '...' : '');
    }

    const queryWords = query.toLowerCase().split(/\s+/);
    const textLower = text.toLowerCase();
    
    // Find the best position to start the excerpt
    let bestPosition = 0;
    let bestScore = 0;

    for (let i = 0; i <= text.length - maxLength; i += 20) {
      const window = textLower.slice(i, i + maxLength);
      const score = queryWords.reduce((sum, word) => {
        return sum + (window.includes(word) ? 1 : 0);
      }, 0);

      if (score > bestScore) {
        bestScore = score;
        bestPosition = i;
      }
    }

    let excerpt = text.slice(bestPosition, bestPosition + maxLength);
    if (bestPosition > 0) excerpt = '...' + excerpt;
    if (bestPosition + maxLength < text.length) excerpt += '...';

    return excerpt;
  }
}
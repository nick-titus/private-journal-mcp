// ABOUTME: Core journal writing functionality for MCP server
// ABOUTME: Handles file system operations, timestamps, and markdown formatting

import * as fs from 'fs/promises';
import * as path from 'path';
import { resolveEntriesPath, detectProjectName } from './paths.js';
import { EmbeddingService, EmbeddingData } from './embeddings.js';

export class JournalManager {
  private embeddingService: EmbeddingService;

  constructor() {
    this.embeddingService = EmbeddingService.getInstance();
  }

  async writeEntry(content: string): Promise<{ embeddingSucceeded: boolean }> {
    const timestamp = new Date();
    const projectName = detectProjectName(process.cwd());
    const dateString = this.formatDate(timestamp);
    const timeString = this.formatTimestamp(timestamp);

    const entriesPath = resolveEntriesPath();
    const dayDirectory = path.join(entriesPath, dateString);
    const fileName = `${timeString}.md`;
    const filePath = path.join(dayDirectory, fileName);

    await this.ensureDirectoryExists(dayDirectory);

    const formattedEntry = this.formatEntry(content, timestamp, projectName);
    await fs.writeFile(filePath, formattedEntry, 'utf8');

    // Generate and save embedding
    const embeddingSucceeded = await this.generateEmbeddingForEntry(filePath, formattedEntry, timestamp, projectName);
    return { embeddingSucceeded };
  }

  async writeThoughts(thoughts: {
    user?: string;
    projectNotes?: string;
    reflections?: string;
  }): Promise<{ embeddingSucceeded: boolean }> {
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
    const embeddingSucceeded = await this.generateEmbeddingForEntry(filePath, formattedEntry, timestamp, projectName);
    return { embeddingSucceeded };
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private formatTimestamp(date: Date): string {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const microseconds = String(date.getMilliseconds() * 1000 + Math.floor(Math.random() * 1000)).padStart(6, '0');
    return `${hours}-${minutes}-${seconds}-${microseconds}`;
  }

  private formatEntry(content: string, timestamp: Date, projectName: string): string {
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

    return `---
title: "${timeDisplay} - ${dateDisplay}"
date: ${timestamp.toISOString()}
timestamp: ${timestamp.getTime()}
project: ${projectName}
---

${content}
`;
  }

  private formatThoughts(thoughts: {
    user?: string;
    projectNotes?: string;
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

    if (thoughts.user) {
      sections.push(`## User\n\n${thoughts.user}`);
    }

    if (thoughts.projectNotes) {
      sections.push(`## Project\n\n${thoughts.projectNotes}`);
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
  ): Promise<boolean> {
    try {
      const { text, sections } = this.embeddingService.extractSearchableText(content);

      if (text.trim().length === 0) {
        return true; // Skip empty entries - this is not a failure
      }

      const embedding = await this.embeddingService.generateEmbedding(text);

      const embeddingData: EmbeddingData = {
        embedding,
        text,
        sections,
        timestamp: timestamp.getTime(),
        path: filePath,
        project: projectName  // Include project tag in embedding data
      };

      await this.embeddingService.saveEmbedding(filePath, embeddingData);
      return true;
    } catch (error) {
      console.error(`Failed to generate embedding for ${filePath}:`, error);
      // Don't throw - embedding failure shouldn't prevent journal writing
      return false;
    }
  }

  async generateMissingEmbeddings(): Promise<number> {
    let count = 0;
    const entriesPath = resolveEntriesPath();

    try {
      const dayDirs = await fs.readdir(entriesPath);

      for (const dayDir of dayDirs) {
        const dayPath = path.join(entriesPath, dayDir);
        const stat = await fs.stat(dayPath);

        if (!stat.isDirectory() || !dayDir.match(/^\d{4}-\d{2}-\d{2}$/)) {
          continue;
        }

        const files = await fs.readdir(dayPath);
        const mdFiles = files.filter(file => file.endsWith('.md'));

        for (const mdFile of mdFiles) {
          const mdPath = path.join(dayPath, mdFile);
          const embeddingPath = mdPath.replace(/\.md$/, '.embedding');

          try {
            await fs.access(embeddingPath);
            // Embedding already exists, skip
          } catch {
            // Generate missing embedding
            console.error(`Generating missing embedding for ${mdPath}`);
            const content = await fs.readFile(mdPath, 'utf8');
            const timestamp = this.extractTimestampFromPath(mdPath) || new Date();
            const projectName = this.extractProjectFromContent(content) || detectProjectName(process.cwd());
            await this.generateEmbeddingForEntry(mdPath, content, timestamp, projectName);
            count++;
          }
        }
      }
    } catch (error) {
      if ((error as any)?.code !== 'ENOENT') {
        console.error(`Failed to scan ${entriesPath} for missing embeddings:`, error);
      }
    }

    return count;
  }

  private extractTimestampFromPath(filePath: string): Date | null {
    const filename = path.basename(filePath, '.md');
    const match = filename.match(/^(\d{2})-(\d{2})-(\d{2})-\d{6}$/);

    if (!match) return null;

    const [, hours, minutes, seconds] = match;
    const dirName = path.basename(path.dirname(filePath));
    const dateMatch = dirName.match(/^(\d{4})-(\d{2})-(\d{2})$/);

    if (!dateMatch) return null;

    const [, year, month, day] = dateMatch;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day),
                   parseInt(hours), parseInt(minutes), parseInt(seconds));
  }

  private extractProjectFromContent(content: string): string | null {
    // Extract project from YAML frontmatter
    const match = content.match(/^---\n[\s\S]*?project:\s*(.+?)\n[\s\S]*?---/);
    if (match) {
      return match[1].trim();
    }
    return null;
  }

  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch (_error) {
      try {
        await fs.mkdir(dirPath, { recursive: true });
      } catch (mkdirError) {
        throw new Error(`Failed to create journal directory at ${dirPath}: ${mkdirError instanceof Error ? mkdirError.message : mkdirError}`);
      }
    }
  }
}

// ABOUTME: MCP server implementation with process_thoughts tool
// ABOUTME: Handles stdio protocol communication and tool registration

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { JournalManager } from './journal.js';
import { SearchService } from './search.js';

export class PrivateJournalServer {
  private server: Server;
  private journalManager: JournalManager;
  private searchService: SearchService;

  constructor() {
    this.journalManager = new JournalManager();
    this.searchService = new SearchService();
    this.server = new Server(
      {
        name: 'private-journal-mcp',
        version: '1.0.0',
      }
    );

    this.setupToolHandlers();
  }

  private setupToolHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'process_thoughts',
          description: `Write to your private journal. Use this to capture learnings and build context for future sessions.

Sections:
- user: Understanding the user - their preferences, values, communication style, domain expertise
- project: Project-specific learnings - architecture, decisions, gotchas, things tried and failed
- reflections: Session retrospective - what worked, what didn't, what to do differently next time

Write to any combination of sections. Entries are automatically tagged with the current project.`,
          inputSchema: {
            type: 'object',
            properties: {
              user: {
                type: 'string',
                description: 'Observations about the user - preferences, values, style, domain context',
              },
              project: {
                type: 'string',
                description: 'Project learnings - architecture, decisions, gotchas, failures',
              },
              reflections: {
                type: 'string',
                description: "Session retrospective - what worked, what didn't, learnings",
              },
            },
            required: [],
          },
        },
        {
          name: 'search_journal',
          description: "Search through your private journal entries using natural language queries. Returns semantically similar entries ranked by relevance.",
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: "Natural language search query (e.g., 'times I felt frustrated with TypeScript', 'insights about Nick's preferences', 'lessons about async patterns')",
              },
              limit: {
                type: 'number',
                description: "Maximum number of results to return (default: 10)",
                default: 10,
              },
              sections: {
                type: 'array',
                items: { type: 'string' },
                description: "Filter by sections: user, project, reflections",
              },
              project: {
                type: 'string',
                description: 'Filter by project name (e.g., "betterpack")',
              },
            },
            required: ['query'],
          },
        },
        {
          name: 'read_journal_entry',
          description: "Read the full content of a specific journal entry by file path.",
          inputSchema: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: "File path to the journal entry (from search results)",
              },
            },
            required: ['path'],
          },
        },
        {
          name: 'list_recent_entries',
          description: "Get recent journal entries in chronological order.",
          inputSchema: {
            type: 'object',
            properties: {
              limit: {
                type: 'number',
                description: "Maximum number of entries to return (default: 10)",
                default: 10,
              },
              project: {
                type: 'string',
                description: 'Filter by project name (e.g., "betterpack"). If not specified, returns entries from all projects.',
              },
              days: {
                type: 'number',
                description: "Number of days back to search (default: 30)",
                default: 30,
              },
            },
            required: [],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const args = request.params.arguments as Record<string, unknown>;

      if (request.params.name === 'process_thoughts') {
        const thoughts = {
          user: typeof args.user === 'string' ? args.user : undefined,
          project: typeof args.project === 'string' ? args.project : undefined,
          reflections: typeof args.reflections === 'string' ? args.reflections : undefined,
        };

        const hasAnyContent = Object.values(thoughts).some(value => value !== undefined);
        if (!hasAnyContent) {
          throw new Error('At least one section must be provided (user, project, or reflections)');
        }

        try {
          await this.journalManager.writeThoughts(thoughts);
          return {
            content: [
              {
                type: 'text',
                text: 'Thoughts recorded successfully.',
              },
            ],
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
          throw new Error(`Failed to write thoughts: ${errorMessage}`);
        }
      }

      if (request.params.name === 'search_journal') {
        if (!args || typeof args.query !== 'string') {
          throw new Error('query is required and must be a string');
        }

        const options = {
          limit: typeof args.limit === 'number' ? args.limit : 10,
          project: typeof args.project === 'string' ? args.project : undefined,
          sections: Array.isArray(args.sections) ? args.sections.filter(s => typeof s === 'string') : undefined,
        };

        try {
          const results = await this.searchService.search(args.query, options);
          return {
            content: [
              {
                type: 'text',
                text: results.length > 0
                  ? `Found ${results.length} relevant entries:\n\n${results.map((result, i) =>
                      `${i + 1}. [Score: ${result.score.toFixed(3)}] ${new Date(result.timestamp).toLocaleDateString()}${result.project ? ` (${result.project})` : ''}\n` +
                      `   Sections: ${result.sections.join(', ')}\n` +
                      `   Path: ${result.path}\n` +
                      `   Excerpt: ${result.excerpt}\n`
                    ).join('\n')}`
                  : 'No relevant entries found.',
              },
            ],
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
          throw new Error(`Failed to search journal: ${errorMessage}`);
        }
      }

      if (request.params.name === 'read_journal_entry') {
        if (!args || typeof args.path !== 'string') {
          throw new Error('path is required and must be a string');
        }

        try {
          const content = await this.searchService.readEntry(args.path);
          if (content === null) {
            throw new Error('Entry not found');
          }
          return {
            content: [
              {
                type: 'text',
                text: content,
              },
            ],
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
          throw new Error(`Failed to read entry: ${errorMessage}`);
        }
      }

      if (request.params.name === 'list_recent_entries') {
        const days = typeof args?.days === 'number' ? args.days : 30;
        const limit = typeof args?.limit === 'number' ? args.limit : 10;
        const project = typeof args?.project === 'string' ? args.project : undefined;

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const options = {
          limit,
          project,
          dateRange: { start: startDate }
        };

        try {
          const results = await this.searchService.listRecent(options);
          return {
            content: [
              {
                type: 'text',
                text: results.length > 0
                  ? `Recent entries (last ${days} days):\n\n${results.map((result, i) =>
                      `${i + 1}. ${new Date(result.timestamp).toLocaleDateString()}${result.project ? ` (${result.project})` : ''}\n` +
                      `   Sections: ${result.sections.join(', ')}\n` +
                      `   Path: ${result.path}\n` +
                      `   Excerpt: ${result.excerpt}\n`
                    ).join('\n')}`
                  : `No entries found in the last ${days} days.`,
              },
            ],
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
          throw new Error(`Failed to list recent entries: ${errorMessage}`);
        }
      }

      throw new Error(`Unknown tool: ${request.params.name}`);
    });
  }

  async run(): Promise<void> {
    // Generate missing embeddings on startup
    try {
      console.error('Checking for missing embeddings...');
      const count = await this.journalManager.generateMissingEmbeddings();
      if (count > 0) {
        console.error(`Generated embeddings for ${count} existing journal entries.`);
      }
    } catch (error) {
      console.error('Failed to generate missing embeddings on startup:', error);
      // Don't fail startup if embedding generation fails
    }

    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }
}

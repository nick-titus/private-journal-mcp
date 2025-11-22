// ABOUTME: Type definitions for the private journal MCP server
// ABOUTME: Defines interfaces for journal entries and configuration

/**
 * Type guard to check if an error is a Node.js ErrnoException
 * Use this instead of unsafe (error as any)?.code pattern
 */
export function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

export interface JournalEntry {
  content: string;
  timestamp: Date;
  filePath: string;
}

export interface ProcessThoughtsRequest {
  user?: string;             // Understanding the user - preferences, values, style, domains
  projectNotes?: string;     // Project learnings - architecture, decisions, gotchas
  reflections?: string;      // Session retrospective - what worked, what didn't
}
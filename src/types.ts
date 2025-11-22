// ABOUTME: Type definitions for the private journal MCP server
// ABOUTME: Defines interfaces for journal entries and configuration

export interface JournalEntry {
  content: string;
  timestamp: Date;
  filePath: string;
}

export interface ProcessThoughtsRequest {
  nick?: string;         // Understanding Nick - preferences, values, style, domains
  project?: string;      // Project learnings - architecture, decisions, gotchas
  reflections?: string;  // Session retrospective - what worked, what didn't
}
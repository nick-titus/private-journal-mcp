# Private Journal MCP Server

A comprehensive MCP (Model Context Protocol) server that provides Claude with private journaling and semantic search capabilities for processing thoughts, feelings, and insights.

## Features

### Journaling
- **Multi-section journaling**: Categories for user observations, project notes, and session reflections
- **Centralized storage**: All entries in `~/.claude/.private-journal/` with automatic project tagging
- **Timestamped entries**: Each entry automatically dated with microsecond precision
- **YAML frontmatter**: Structured metadata including project tags

### Search & Discovery
- **Semantic search**: Natural language queries using local AI embeddings
- **Vector similarity**: Find conceptually related entries, not just keyword matches
- **Project filtering**: Search within specific projects or across all entries
- **Local AI processing**: Uses @xenova/transformers - no external API calls required

### Privacy & Performance
- **Completely private**: All processing happens locally, no data leaves your machine
- **Fast operation**: Optimized file structure and in-memory similarity calculations
- **Robust fallbacks**: Intelligent path resolution across platforms

## Installation

This server is run directly from GitHub using `npx` - no installation required.

## MCP Configuration

#### Claude Code (One-liner)
```bash
claude mcp add-json private-journal '{"type":"stdio","command":"npx","args":["github:obra/private-journal-mcp"]}' -s user
```

#### Manual Configuration
Add to your MCP settings (e.g., Claude Desktop configuration):

```json
{
  "mcpServers": {
    "private-journal": {
      "command": "npx",
      "args": ["github:obra/private-journal-mcp"]
    }
  }
}
```

## Local Development Installation

Use a local build to test changes:

1. Build the project:
```bash
npm run build
```

2. Add to Claude Code (run from repository root):
```bash
claude mcp add-json private-journal \
'{"type":"stdio","command":"node","args":["'$(pwd)'/dist/index.js"]}' \
-s user
```

## MCP Tools

### `process_thoughts`
Multi-section private journaling with these optional categories:
- **user**: Observations about the user - preferences, values, communication style
- **projectNotes**: Project-specific learnings - architecture, decisions, gotchas
- **reflections**: Session retrospective - what worked, what didn't, lessons learned

Entries are automatically tagged with the current project (detected from git repo).

### `search_journal`
Semantic search across all journal entries:
- **query** (required): Natural language search query
- **limit**: Maximum results (default: 10)
- **project**: Filter by project name (e.g., "betterpack")
- **sections**: Filter by specific categories

### `read_journal_entry`
Read full content of specific entries:
- **path** (required): File path from search results

### `list_recent_entries`
Browse recent entries chronologically:
- **limit**: Maximum entries (default: 10)
- **project**: Filter by project name
- **days**: Days back to search (default: 30)

## Slash Commands

Companion slash commands for Claude Code (install in `~/.claude/commands/`):

### `/prime-context`
Load journal context at session start:
- Reads USER-SUMMARY.md and PROJECT-SUMMARY.md
- Lists recent entries for current project
- Displays formatted status with token counts

### `/reflect`
End-of-session reflection ritual:
- Captures learnings using `process_thoughts` tool
- Auto-detects project from git repo
- Displays formatted summary of captured content

### `/synthesize`
Generate summary documents from journal entries:
- Creates USER-SUMMARY.md (global user context)
- Creates PROJECT-SUMMARY.md (project-specific learnings)
- Highlights changes from previous summaries

## File Structure

### Centralized Storage
```
~/.claude/.private-journal/
├── USER-SUMMARY.md              # Synthesized user context
├── entries/                     # All timestamped entries
│   ├── 2025-11-21/
│   │   ├── 14-30-45-123456.md
│   │   ├── 14-30-45-123456.embedding
│   │   └── ...
│   └── ...
└── projects/
    ├── betterpack/
    │   └── PROJECT-SUMMARY.md   # Project-specific summary
    ├── private-journal-mcp/
    │   └── PROJECT-SUMMARY.md
    └── ...
```

### Entry Format
Each markdown file contains YAML frontmatter and structured sections:

```markdown
---
title: "2:30:45 PM - November 21, 2025"
date: 2025-11-21T14:30:45.123Z
timestamp: 1732199445123
project: betterpack
---

## User

Prefers explicit control over automatic behavior...

## Project Notes

Architecture uses React Query for data fetching...

## Reflections

Session went well - TDD approach caught bugs early...
```

## Development

### Building

```bash
npm run build
```

### Testing

```bash
npm test
```

### Development Mode

```bash
npm run dev
```

### Improving Claude's Performance

To help Claude learn and improve over time, consider adding journal usage guidance to your `~/.claude/CLAUDE.md` file:

```markdown
## Learning and Memory Management

- YOU MUST use the journal tool frequently to capture technical insights, failed approaches, and user preferences
- Before starting complex tasks, search the journal for relevant past experiences and lessons learned
- Document architectural decisions and their outcomes for future reference
- Track patterns in user feedback to improve collaboration over time
- When you notice something that should be fixed but is unrelated to your current task, document it in your journal rather than fixing it immediately
```

This enables Claude to build persistent memory across conversations, leading to better engineering decisions and collaboration patterns.

## Author

Jesse Vincent <jesse@fsck.com>

Read more about the motivation and design in the [blog post](https://blog.fsck.com/2025/05/28/dear-diary-the-user-asked-me-if-im-alive/).

## License

MIT

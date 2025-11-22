# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

```bash
# Build the project
npm run build

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Development mode with TypeScript watcher
npm run dev

# Lint the code
npm run lint

# Format the code
npm run format

# Start the server
npm start

# Run a single test file
npx jest tests/journal.test.ts
```

## Architecture Overview

This is an MCP (Model Context Protocol) server that provides Claude with private journaling capabilities.

**Core Components:**
- `src/index.ts` - CLI entry point
- `src/server.ts` - MCP server with stdio transport, registers all tools
- `src/journal.ts` - File system operations for timestamped markdown entries
- `src/paths.ts` - Path resolution and project detection (git repo or "general")
- `src/embeddings.ts` - Local AI embeddings using @xenova/transformers
- `src/search.ts` - Semantic search with vector similarity and project filtering
- `src/types.ts` - TypeScript interfaces

**Storage Architecture:**
All entries stored centrally in `~/.claude/.private-journal/` with automatic project tagging:
```
~/.claude/.private-journal/
├── USER-SUMMARY.md              # Synthesized user context
├── entries/                     # All timestamped entries
│   └── YYYY-MM-DD/
│       ├── HH-MM-SS-μμμμμμ.md
│       └── HH-MM-SS-μμμμμμ.embedding
└── projects/
    └── {project-name}/
        └── PROJECT-SUMMARY.md
```

**Project Detection:**
`detectProjectName()` in `src/paths.ts` returns the git repo name if in a git repo, otherwise "general". This tags all entries for filtering.

## MCP Tools

**`process_thoughts`** - Write journal entries with 3 optional sections:
- `user`: Observations about the user (preferences, style)
- `projectNotes`: Project-specific learnings (architecture, gotchas)
- `reflections`: Session retrospective (what worked, what didn't)

**`search_journal`** - Semantic search with project filtering

**`read_journal_entry`** - Read full entry by path

**`list_recent_entries`** - Browse recent entries, optionally filtered by project

## Testing

- Jest with ts-jest preset
- Transformers library mocked for CI/CD
- Tests in `tests/` directory
- Run single file: `npx jest tests/paths.test.ts`
- Coverage: `npm test -- --coverage`

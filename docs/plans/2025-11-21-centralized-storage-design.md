# Centralized Journal Storage Design

**Date:** 2025-11-21
**Branch:** feature/centralized-storage
**Status:** Design Complete

## Problem Statement

Journal entries are currently split between user-level (`~/.private-journal/`) and project-level (`<CWD>/.private-journal/`) directories. This means:

1. Project context is inaccessible when starting sessions from different directories
2. Valuable learnings are fragmented across 9+ locations
3. No way to get holistic view of collaboration history

## Goals

1. Always have access to all journal context regardless of starting directory
2. Enable progressive disclosure - summaries for quick context, full entries for deep dives
3. Simplify entry structure to focus on what Claude needs to work better over time
4. Create a "living CLAUDE.md" that evolves from synthesized learnings

## Design

### Storage Structure

```
~/.claude/.private-journal/
├── USER-SUMMARY.md              # Synthesized: how to work with Nick
├── entries/                      # All timestamped entries
│   ├── 2025-11-19-163405.md
│   ├── 2025-11-19-163405.embedding
│   └── ...
└── projects/
    ├── betterpack/
    │   └── PROJECT-SUMMARY.md   # Synthesized: betterpack learnings
    ├── health-tracker/
    │   └── PROJECT-SUMMARY.md
    └── ...
```

### Entry Schema (Simplified from 5 to 3 sections)

**Old sections:**
- `feelings` - emotional processing
- `user_context` - observations about user
- `project_notes` - project context
- `technical_insights` - engineering learnings
- `world_knowledge` - domain knowledge

**New sections:**
| Section | Purpose | Feeds Summary |
|---------|---------|---------------|
| `nick` | Who Nick is, how he works, what he values, his domains | USER-SUMMARY |
| `project` | Architecture, decisions, gotchas, failures for current project | PROJECT-SUMMARY |
| `reflections` | Session retrospective - what worked, what didn't, learnings | Both |

**Entry frontmatter:**
```yaml
---
title: "4:26:05 PM - November 21, 2025"
date: 2025-11-21T23:26:05.697Z
timestamp: 1763594765697
project: betterpack          # NEW: explicit project tag
---
```

**Embedding schema addition:**
```typescript
interface EmbeddingData {
  embedding: number[];
  text: string;
  sections: string[];
  timestamp: number;
  path: string;
  project?: string;          // NEW: explicit project tag
}
```

### Summary Documents

**USER-SUMMARY.md structure:**
- Communication preferences
- Working style
- Technical preferences
- Pet peeves / anti-patterns
- What works well
- Domain context (TrainingPeaks, cycling, TPV)

**PROJECT-SUMMARY.md structure:**
- Architecture overview
- Key patterns/conventions
- Gotchas / landmines
- Decisions made and why
- Things tried and failed

### Slash Commands

**`/reflect`** - End-of-session entry capture
- Prompts Claude to write journal entry with current session learnings
- Detects project from CWD (git root or directory name)
- Writes to centralized location with project tag
- Fast, low friction - designed for habitual use

**`/synthesize`** - Summary generation
- Run in fresh session with minimal MCPs for max context
- Reads all relevant entries (user-level or project-specific)
- Generates/updates summary documents
- Run weekly or when summaries feel stale

### Progressive Disclosure at Session Start

**Layer 1 - Always loaded (~2-3k tokens):**
- USER-SUMMARY.md
- PROJECT-SUMMARY.md (for detected project)

**Layer 2 - Loaded at session start (~2-3k tokens):**
- Last 3-5 entries for current project

**Layer 3 - On-demand:**
- Full entry archive via semantic search

**Implementation:** Skill or hook that runs at session start, loads summaries + recent entries.

## Migration Plan

### Entries to Migrate

9 project journal directories:
- ~/Dev/episodic-memory/.private-journal
- ~/Dev/tpf-website/.private-journal
- ~/Dev/.private-journal
- ~/Dev/betterpack/.private-journal
- ~/Dev/health-tracker/.private-journal
- ~/Dev/trainingpeaks/.private-journal
- ~/Dev/trainingpeaks/tpv-data/.private-journal
- ~/Dev/trainingpeaks/Mars/.private-journal
- ~/Dev/mcp-servers/private-journal-mcp/.private-journal

Plus existing user entries in ~/.private-journal/

### Migration Steps

1. Create new directory structure in `~/.claude/.private-journal/`
2. For each existing entry:
   - Extract project name from source path
   - Add `project: <name>` to frontmatter
   - Add `project: <name>` to embedding JSON
   - Copy to `~/.claude/.private-journal/entries/`
3. Create empty PROJECT-SUMMARY.md for each project
4. Update MCP code to use new paths and schema
5. Rebuild and test
6. Run `/synthesize` to generate initial summaries
7. Archive old directories (don't delete yet)

## Code Changes Required

### paths.ts
- Change `resolveJournalPath()` to return `~/.claude/.private-journal/`
- Remove project vs user path distinction
- Add helper to detect project name from CWD

### types.ts
- Update `ProcessThoughtsRequest` with new 3 sections
- Add `project?: string` field

### journal.ts
- Remove split write logic (all entries to same location)
- Add project detection and tagging
- Update `formatThoughts()` for new sections

### embeddings.ts
- Add `project?: string` to `EmbeddingData` interface

### search.ts
- Filter by `project` field instead of path-based type inference
- Add project to `SearchOptions`

### server.ts
- Update `process_thoughts` tool parameters for new sections
- Update tool descriptions

### New: slash commands
- Create `/reflect` command (prompts for session reflection)
- Create `/synthesize` command (generates summaries)

## Testing Strategy

1. Unit tests for new path resolution
2. Unit tests for project detection from CWD
3. Integration test for entry write with project tag
4. Integration test for search filtering by project
5. Manual test of migration script on subset of entries
6. End-to-end test of full workflow

## Open Questions

1. **Git root vs CWD for project detection?** Git root is more reliable but CWD might be in a subdirectory. Recommend: try git root first, fall back to CWD basename.

2. **What to do with old 5-section entries during migration?** Map them: `user_context`→`nick`, `project_notes`→`project`, `feelings`+`technical_insights`+`world_knowledge`→`reflections`.

3. **How to handle entries without clear project context?** Tag as `project: "general"` or leave untagged.

## Success Criteria

- [ ] All entries accessible from any directory
- [ ] Summaries load automatically at session start
- [ ] `/reflect` takes < 30 seconds to complete
- [ ] `/synthesize` successfully generates coherent summaries
- [ ] Existing entries migrated without data loss
- [ ] Search works across all entries with project filtering

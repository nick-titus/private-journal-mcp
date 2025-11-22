# Slash Commands Implementation Plan

**Date:** 2025-11-22
**Branch:** feature/slash-commands (create from main after merging centralized-storage)
**Status:** Planning

## Overview

Implement three slash commands that make centralized storage useful:

| When | Command | Purpose |
|------|---------|---------|
| Session start | `/context` | Load summaries + recent entries |
| Session end | `/reflect` | Capture learnings to journal |
| Weekly/periodic | `/synthesize` | Regenerate summary documents |

This approach keeps the user in control - no automatic hooks or latency.

## Design

### 1. /reflect Command

**Purpose:** Quick end-of-session capture of learnings

**Location:** `~/.claude/commands/reflect.md`

**Behavior:**
- Prompts Claude to reflect on the current session
- Writes to journal using `process_thoughts` MCP tool
- Detects project automatically (already implemented in MCP)
- Should take <30 seconds to complete

**Implementation:**
```markdown
---
description: End-of-session reflection - capture learnings to journal
---

Reflect on this session and write to your private journal.

Think about:
1. **user section**: Any new observations about the user's preferences,
   communication style, or how they like to work
2. **projectNotes section**: Any learnings about the current project -
   architecture decisions, gotchas discovered, patterns established
3. **reflections section**: Session retrospective - what went well,
   what could have been better, what you'd do differently

Use the `process_thoughts` tool from private-journal MCP to record your thoughts.
Be specific and actionable - these entries help future sessions.
```

**Testing:**
- Manual test: Run `/reflect` after a session, verify entry created
- Verify project tag is correct
- Verify all three sections are populated appropriately

---

### 2. /synthesize Command

**Purpose:** Generate/update summary documents from journal entries

**Location:** `~/.claude/commands/synthesize.md`

**Behavior:**
- Reads recent journal entries (user-level and project-specific)
- Generates two summary documents:
  - `~/.claude/.private-journal/USER-SUMMARY.md`
  - `~/.claude/.private-journal/projects/{project}/PROJECT-SUMMARY.md`
- Should be run periodically (weekly) or when summaries feel stale

**Summary Document Schemas:**

```markdown
# USER-SUMMARY.md
## Communication Preferences
- [bullet points]

## Working Style
- [bullet points]

## Technical Preferences
- [bullet points]

## Pet Peeves / Anti-patterns
- [bullet points]

## What Works Well
- [bullet points]

## Domain Context
- [bullet points about domains they work in]

---
*Last synthesized: {date}*
*Based on {n} entries from {date_range}*
```

```markdown
# PROJECT-SUMMARY.md ({project-name})
## Architecture Overview
- [bullet points]

## Key Patterns & Conventions
- [bullet points]

## Gotchas / Landmines
- [bullet points]

## Decisions Made & Why
- [bullet points]

## Things Tried & Failed
- [bullet points]

---
*Last synthesized: {date}*
*Based on {n} entries*
```

**Implementation:**
```markdown
---
description: Generate summary documents from journal entries
---

Generate or update the journal summary documents.

## Steps:

1. **Detect current project** using git root or directory name

2. **Read recent entries** using `search_journal` and `list_recent_entries`:
   - For USER-SUMMARY: entries with `user` section content (last 90 days)
   - For PROJECT-SUMMARY: entries tagged with current project

3. **Generate USER-SUMMARY.md** at `~/.claude/.private-journal/USER-SUMMARY.md`:
   - Synthesize patterns from `user` and `reflections` sections
   - Focus on actionable preferences and working style
   - Keep concise (~500-1000 words)

4. **Generate PROJECT-SUMMARY.md** at `~/.claude/.private-journal/projects/{project}/PROJECT-SUMMARY.md`:
   - Synthesize from `projectNotes` and `reflections` sections
   - Focus on architecture, patterns, and gotchas
   - Keep concise (~500-1000 words)

5. **Write the files** using standard file operations

Report what was updated and key insights captured.
```

**New MCP Tool Required:** `list_projects`
- Returns list of unique project names from all entries
- Useful for synthesize command to know what projects exist

---

### 3. /context Command

**Purpose:** Load journal context at the beginning of a session

**Location:** `~/.claude/commands/context.md`

**Behavior:**
- Reads USER-SUMMARY.md (user preferences, working style)
- Detects current project from git root
- Reads PROJECT-SUMMARY.md for that project (if exists)
- Lists last 3-5 entries for current project
- Total context: ~3-5k tokens

**Implementation:**
```markdown
---
description: Load journal context for this session
---

Load my private journal context to inform this session.

## Steps:

1. **Read USER-SUMMARY.md** from `~/.claude/.private-journal/USER-SUMMARY.md`
   - Contains: communication preferences, working style, domain context
   - If file doesn't exist, note that /synthesize needs to be run

2. **Detect current project** from git root or directory name

3. **Read PROJECT-SUMMARY.md** from `~/.claude/.private-journal/projects/{project}/PROJECT-SUMMARY.md`
   - Contains: architecture, patterns, gotchas for this project
   - If file doesn't exist, note that /synthesize needs to be run for this project

4. **List recent entries** using `list_recent_entries` with project filter
   - Show last 3-5 entries for additional recent context

5. **Summarize** what context was loaded and any gaps (missing summaries)

Use this context throughout our conversation to work more effectively.
```

**Why slash command over hook/skill:**
- User controls when context is loaded
- No latency on quick sessions
- Can run mid-session if forgotten
- Dead simple - just a prompt file

---

## Implementation Tasks

### Phase 1: Slash Commands (No Code Changes)

#### Task 1: Create /reflect command
- Create `~/.claude/commands/reflect.md`
- Test manually after a session
- Verify entry created with correct project tag

#### Task 2: Create /synthesize command
- Create `~/.claude/commands/synthesize.md`
- Create directory structure: `~/.claude/.private-journal/projects/`
- Test manually - verify summaries are generated
- Iterate on prompt for quality

#### Task 3: Create /context command
- Create `~/.claude/commands/context.md`
- Test at session start
- Verify summaries and recent entries are loaded

### Phase 2: MCP Enhancements (Optional)

#### Task 4: Add list_projects tool
**Files:**
- `src/server.ts` - Add tool definition
- `src/search.ts` - Add method to extract unique projects

```typescript
// In SearchService
async listProjects(): Promise<string[]> {
  const { results } = await this.loadAllEmbeddings();
  const projects = new Set(results.map(e => e.project).filter(Boolean));
  return Array.from(projects).sort();
}
```

This helps `/synthesize` know what projects exist.

### Phase 3: Documentation

#### Task 5: Update README
- Document the three commands
- Add workflow examples
- Explain the summary documents

---

## File Structure After Implementation

```
~/.claude/
├── commands/
│   ├── context.md          # NEW - load context at session start
│   ├── reflect.md          # NEW - capture learnings at session end
│   └── synthesize.md       # NEW - generate summary documents
└── .private-journal/
    ├── USER-SUMMARY.md     # Generated by /synthesize
    ├── entries/
    │   └── ...
    └── projects/
        ├── betterpack/
        │   └── PROJECT-SUMMARY.md  # Generated by /synthesize
        ├── private-journal-mcp/
        │   └── PROJECT-SUMMARY.md
        └── ...
```

---

## Testing Plan

1. **Manual /reflect test:**
   - Start session, do some work
   - Run `/reflect`
   - Verify entry created with correct project tag
   - Verify all three sections are meaningful

2. **Manual /synthesize test:**
   - Run `/synthesize`
   - Verify USER-SUMMARY.md created at `~/.claude/.private-journal/`
   - Verify PROJECT-SUMMARY.md created at `~/.claude/.private-journal/projects/{project}/`
   - Review content quality - should be actionable, not just a dump

3. **Manual /context test:**
   - Start new session in a project with existing summaries
   - Run `/context`
   - Verify USER-SUMMARY.md content is displayed
   - Verify PROJECT-SUMMARY.md content is displayed
   - Verify recent entries are listed
   - Test in project without summaries - should note they're missing

---

## Success Criteria

- [ ] `/reflect` creates meaningful entries in <30 seconds
- [ ] `/synthesize` generates useful, actionable summaries
- [ ] `/context` loads summaries + recent entries in <10 seconds
- [ ] Total context from `/context` is <5k tokens
- [ ] Summaries actually improve session quality (subjective)

---

## Open Questions

1. **How often should /synthesize run?**
   - Weekly manual? (recommended to start)
   - After N new entries?
   - Could add a reminder in /reflect output

2. **Token budget for summaries?**
   - USER-SUMMARY: ~1k tokens
   - PROJECT-SUMMARY: ~1k tokens
   - Recent entries (3-5): ~2k tokens
   - Total: ~4k tokens - reasonable

3. **Should /context be remembered?**
   - Currently manual each session
   - Could mention in CLAUDE.md to run at session start
   - Keep it simple for now - manual is fine

---

## Estimated Effort

| Phase | Tasks | Effort |
|-------|-------|--------|
| Phase 1 | Three slash commands | 1 hour |
| Phase 2 | MCP list_projects (optional) | 30 min |
| Phase 3 | Documentation | 30 min |

**Total:** ~2 hours (or ~1.5 hours without Phase 2)

---

## Dependencies

- Centralized storage PR must be merged first
- Requires existing MCP tools: `process_thoughts`, `search_journal`, `list_recent_entries`

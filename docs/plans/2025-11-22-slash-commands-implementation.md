# Slash Commands Implementation Plan

**Date:** 2025-11-22
**Branch:** feature/slash-commands (after merging centralized-storage)
**Status:** Design Complete

## Overview

Three slash commands for journal workflow:

| Command | When | What | Output |
|---------|------|------|--------|
| `/prime-context` | Session start | Load context for Claude | Confirmation + tokens |
| `/reflect` | Session end | Capture learnings | Full formatted content |
| `/synthesize` | Fresh session | Generate summaries | Full formatted content + changes |

**Arguments:**
- `/prime-context [user|project]` - optional filter, defaults to all
- `/reflect [--project=name]` - optional explicit project tag
- `/synthesize` - no args, generates both summaries

**Project detection (simplified):**
1. Git repo? → repo name
2. Explicit `--project` arg? → use that
3. Otherwise → "general"

---

## /prime-context Command

**Purpose:** Load journal context at session start for Claude to use

**Location:** `~/.claude/commands/prime-context.md`

**Behavior:**
- Reads `$ARGUMENTS` to determine scope
- No args → load user + project + recent entries
- "user" → load USER-SUMMARY.md only
- "project" → load PROJECT-SUMMARY.md + recent entries only
- Detects project from git root, defaults to "general"
- Reads summary files directly from `~/.claude/.private-journal/`
- Lists recent entries via `list_recent_entries` MCP tool

**Output format:**
```
🧠 Context Loaded (private-journal-mcp)
───────────────────────────────────────
✅ User Context                 ~850 tk
✅ Project Context              ~620 tk
✅ Recent Entries (3)         ~1,090 tk
   • Nov 22 - Slash commands design
   • Nov 21 - Centralized storage
   • Nov 19 - Initial project setup
───────────────────────────────────────
Total: ~2,560 tokens
```

**Error states:**
- Missing USER-SUMMARY.md → `❌ User Context (not found - run /synthesize)`
- Missing PROJECT-SUMMARY.md → `❌ Project Context (not found - run /synthesize)`
- No recent entries → `⚠️ Recent Entries (none for this project)`

---

## /reflect Command

**Purpose:** End-of-session ritual to capture learnings

**Location:** `~/.claude/commands/reflect.md`

**Behavior:**
- Claude autonomously reflects on the session
- Writes to journal via `process_thoughts` MCP tool
- Detects project from git root, or uses `--project=name` override
- Displays full formatted entry after writing

**Arguments:**
- `/reflect` - auto-detect project
- `/reflect --project=foo` - explicit project tag

**Output format:**
```
📝 Session Reflection Captured
───────────────────────────────────────
📁 Project: private-journal-mcp
🕐 Time: 4:32 PM - November 22, 2025
───────────────────────────────────────

👤 User (~320 tk)
   • Prefers explicit control over automatic behavior
   • Values simplicity - start simple, split later

🏗️ Project Notes (~280 tk)
   • Centralized storage working well
   • Slash commands more flexible than hooks

💭 Reflections (~250 tk)
   • Brainstorming before implementation paid off
   • Good session - covered PR feedback and planning

───────────────────────────────────────
Total: ~850 tokens
```

**What Claude reflects on:**
- User preferences/style observed this session
- Project learnings (architecture, gotchas, decisions)
- What went well, what could improve, lessons learned

---

## /synthesize Command

**Purpose:** Generate summary documents from journal entries, with changes highlighted

**Location:** `~/.claude/commands/synthesize.md`

**Behavior:**
- Run in fresh session for max context
- Reads all relevant entries via `search_journal` / `list_recent_entries`
- Generates USER-SUMMARY.md and PROJECT-SUMMARY.md
- Compares to previous summaries (if exist) to identify changes
- Displays full content with **changes highlighted at top**

**Output format:**
```
🔄 Summaries Generated
───────────────────────────────────────

🆕 What's Changed
───────────────────────────────────────
• [User] Added: prefers formatted terminal output with boxes/emojis
• [User] Refined: "start simple" → "start simple, split later if needed"
• [Project Notes] Added: detectProjectName simplified to git-or-general

📄 USER-SUMMARY.md (18 entries → ~950 tk)
───────────────────────────────────────
👤 Communication
   • Prefers explicit control over automatic behavior
   • Values simplicity - start simple, split later
   • 🆕 Likes formatted terminal output with boxes/emojis

⚙️ Working Style
   • Uses TDD, brainstorming before implementation

📄 PROJECT-SUMMARY.md (7 entries → ~620 tk)
   private-journal-mcp
───────────────────────────────────────
🏗️ Architecture
   • MCP server with stdio transport
   • Centralized storage at ~/.claude/.private-journal/

⚠️ Gotchas
   • ESM imports need .js extension
   • 🆕 detectProjectName: git repo or "general", no dir fallback

───────────────────────────────────────
Total: ~1,570 tokens
```

**First run (no previous summary):**
- Skip "What's Changed" section
- Show `📄 USER-SUMMARY.md (new)` instead

---

## MCP Changes

**Update `detectProjectName()` in `src/paths.ts`:**

Current logic:
```
1. Git repo? → repo name
2. Fallback → directory basename
3. Special cases (home, /tmp) → "general"
```

New logic (simplified):
```
1. Git repo? → repo name
2. Otherwise → "general"
```

**Why:** Prevents random directories (Downloads, Desktop, etc.) from becoming "projects". User can override with `--project` arg in slash commands.

**Code change:**
```typescript
export function detectProjectName(dirPath: string): string {
  // Try to get git repo root
  try {
    const gitRoot = execSync('git rev-parse --show-toplevel', {
      cwd: dirPath,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 5000
    }).trim();
    return path.basename(gitRoot);
  } catch (error) {
    // Not in a git repo → general
    if (isNodeError(error) && error.status === 128) {
      return 'general';
    }
    // Unexpected error → log and default to general
    console.error('Warning: error detecting project:', error);
    return 'general';
  }
}
```

---

## File Structure

```
~/.claude/
├── commands/
│   ├── prime-context.md    # Load context at session start
│   ├── reflect.md          # Capture learnings at session end
│   └── synthesize.md       # Generate summary documents
└── .private-journal/
    ├── USER-SUMMARY.md     # Generated by /synthesize
    ├── entries/
    │   └── ...
    └── projects/
        ├── betterpack/
        │   └── PROJECT-SUMMARY.md
        ├── private-journal-mcp/
        │   └── PROJECT-SUMMARY.md
        └── ...
```

---

## Implementation Tasks

### Phase 1: MCP Update
- Update `detectProjectName()` to simplified logic (git repo or "general")
- Update tests for new behavior
- Commit to centralized-storage branch

### Phase 2: Slash Commands
- Create `~/.claude/commands/prime-context.md`
- Create `~/.claude/commands/reflect.md`
- Create `~/.claude/commands/synthesize.md`
- Test each manually

### Phase 3: Bootstrap
- Run `/synthesize` to generate initial summaries
- Run `/prime-context` to verify loading works
- Run `/reflect` at end of a real session

### Phase 4: Documentation
- Update README with command usage
- Add workflow examples

---

## Estimated Effort

| Phase | Effort |
|-------|--------|
| MCP update | 15 min |
| Slash commands | 45 min |
| Bootstrap & test | 15 min |
| Documentation | 15 min |
| **Total** | ~1.5 hours |

---

## Success Criteria

- [ ] `/prime-context` loads context with token counts in <10 seconds
- [ ] `/reflect` creates formatted entry in <30 seconds
- [ ] `/synthesize` generates summaries with changes highlighted
- [ ] Project detection uses git-or-general logic
- [ ] All output uses consistent box/emoji formatting

---

## Dependencies

- Centralized storage PR must be merged first
- Requires MCP tools: `process_thoughts`, `search_journal`, `list_recent_entries`

# Migration Guide

## Overview

This version introduces centralized storage and schema changes that affect the MCP tool APIs.

## Breaking Changes

### `process_thoughts` Tool

**Old parameters (removed):**
- `feelings`
- `user_context`
- `project_notes`
- `technical_insights`
- `world_knowledge`

**New parameters:**
- `user` - Personal notes stored globally
- `projectNotes` - Notes tagged with current project context
- `reflections` - General reflections and insights

### `search_journal` and `list_recent_entries` Tools

**Old parameter:**
- `type: 'project' | 'user' | 'both'`

**New parameter:**
- `project?: string` - Filter by project name (omit for all entries)

### SearchResult Schema

**Old field:**
```typescript
type: 'project' | 'user'
```

**New field:**
```typescript
project?: string  // Project name if applicable
```

## Migration Steps

1. **Run migration script:**
   ```bash
   npm run migrate
   ```
   This consolidates existing entries from scattered locations into centralized storage.

2. **Update prompts/workflows:**
   Replace old parameter names with new ones in any custom prompts or automation.

3. **Verify entries:**
   Old entries remain functional—project tags are added automatically during migration.

## New Storage Location

- **All entries:** `~/.claude/.private-journal/entries/`
- **Project detection:** Automatic from git root or directory name
- **No more split storage:** Both project and personal notes in one location, differentiated by project tags

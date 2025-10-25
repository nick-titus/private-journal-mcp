# Dependency Modernization Design

**Date:** 2025-10-25
**Status:** Approved
**Goal:** Full modernization of dependencies with staged rollback plan

## Context

Current state reveals critical gaps:
- **Security:** 2 vulnerabilities (1 high, 1 low severity)
- **MCP SDK:** 40+ versions behind (0.4.0 vs 1.20.2)
- **Dev tools:** ESLint, Jest, TypeScript tooling 2-3 major versions outdated

## Strategy

Update in three isolated stages. Each stage commits separately, passes all tests, and provides clean rollback point.

**Sequence:** Security → SDK → DevTools

**Branch:** `feature/dependency-modernization`

**Validation gate after each stage:**
```bash
npm test          # All tests pass
npm run build     # TypeScript compiles
npm audit         # Check security status
node dist/index.js # Server starts
```

## Stage 1: Security Fixes

**Objective:** Eliminate vulnerabilities with minimal risk.

**Actions:**
```bash
npm audit fix
```

**Targets:**
- `brace-expansion` - ReDoS vulnerability (low severity)
- `tar-fs` - Symlink bypass (high severity)

**Expected changes:**
- `package-lock.json` updates only
- No source code changes
- Transitive dependencies in ESLint and @xenova/transformers

**Rollback:**
```bash
git checkout package-lock.json && npm install
```

**Commit message:**
```
fix: resolve security vulnerabilities in dependencies

- Fix brace-expansion ReDoS vulnerability
- Fix tar-fs symlink bypass vulnerability
- Run npm audit fix with validation
```

## Stage 2: MCP SDK Update

**Objective:** Modernize to MCP SDK 1.20.2 with full understanding of breaking changes.

**Research first:**
1. Review changelog from v0.4.0 to v1.20.2
2. Identify breaking changes affecting our code
3. Review migration guides if available
4. Map changes to affected files

**Update:**
```bash
npm install @modelcontextprotocol/sdk@latest
```

**Files likely affected:**
- `src/server.ts` - Tool registration, request handlers
- `src/index.ts` - Server initialization, transport setup
- `src/types.ts` - Type definitions if SDK types changed

**Breaking changes to investigate:**
- Tool registration API
- Schema definition format
- Transport/stdio interface
- Error handling patterns
- Type definitions for requests/responses

**Validation includes manual test:**
- Start server: `node dist/index.js`
- Connect via Claude
- Test all four tools: `process_thoughts`, `search_journal`, `read_journal_entry`, `list_recent_entries`

**Rollback:**
```bash
git revert HEAD
# Or pin old version:
npm install @modelcontextprotocol/sdk@0.4.0
```

## Stage 3: Development Dependencies

**Objective:** Modernize dev tooling for better DX and future compatibility.

**Major version updates:**
```bash
npm install --save-dev @typescript-eslint/eslint-plugin@latest
npm install --save-dev @typescript-eslint/parser@latest
npm install --save-dev eslint@latest
npm install --save-dev jest@latest
npm install --save-dev @types/jest@latest
npm install --save-dev @types/node@latest
```

**Safe minor/patch updates:**
```bash
npm install --save-dev prettier@latest
npm install --save-dev ts-jest@latest
npm install --save-dev typescript@latest
```

**Breaking changes expected:**
- **ESLint v8→v9:** Flat config format (`.eslintrc.*` → `eslint.config.js`)
- **TypeScript ESLint v6→v8:** New rules, stricter defaults
- **Jest v29→v30:** Possible config changes
- **Node types v20→v24:** Better type coverage (no code impact)

**Config files to review:**
- `.eslintrc.json` (may need migration to flat config)
- `jest.config.js` or package.json jest config
- `tsconfig.json` (likely unchanged)

**Validation:**
```bash
npm run lint      # ESLint passes
npm run build     # TypeScript compiles
npm test          # All tests pass
npm run format    # Prettier works
```

**Rollback:**
```bash
git revert HEAD
```

## Success Criteria

All three stages complete with:
- ✓ Zero security vulnerabilities
- ✓ MCP SDK at v1.20.2
- ✓ All dev dependencies current
- ✓ All tests passing
- ✓ Server functional with Claude
- ✓ Three clean commits on feature branch

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| MCP SDK breaking changes | Research changelog first, test all tools manually |
| ESLint flat config migration | Review ESLint v9 migration guide, test lint command |
| Jest config incompatibility | Check Jest v30 changelog, validate test suite |
| Multiple failures compound | Staged commits allow individual rollback |

## Implementation Environment

Use git worktree for clean, isolated workspace:
- Keeps main branch untouched
- Easy to discard entire attempt if needed
- Parallel work possible without conflicts

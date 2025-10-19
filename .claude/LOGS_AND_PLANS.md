# Logs and Plans Organization

**For AI Agents:** Instructions for organizing implementation plans and logs.

---

## Directory Structure

```
.claude/plans/     # What to build (blueprints)
docs/logs/         # What was built (implementation history)
docs/setup/        # How to configure (user guides)
```

---

## Rules

### Plans (`.claude/plans/`)
- **Purpose:** Blueprint of what to build before building it
- **Create:** Before implementing a feature
- **Update:** Only when app trajectory changes (architecture pivot, major redesign)
- **Don't update:** With implementation details (use logs instead)
- **Naming:** `plan-[feature-name].md` (lowercase, hyphens)

### Logs (`docs/logs/`)
- **Purpose:** Track what was built, changed, or removed
- **One log per feature:** `FEATURE_NAME.md` (uppercase, underscores)
- **No dates:** Append to existing logs, don't create dated versions
- **APP_LOG.md:** For cross-cutting changes (schema, auth, routing, dependencies)
- **Update:** Every significant change (new functionality, bug fixes, refactors)
- **Format:**
  ```markdown
  # [Feature Name] Implementation Log

  ### [Date] - [What Changed]
  - Changes made
  - Files affected
  - Breaking changes (if any)
  ```

### Setup Guides (`docs/setup/`)
- **Purpose:** User-facing documentation for external integrations
- **Create:** When feature needs API keys, credentials, or complex config
- **Update:** When setup process changes

### Testing (Temporary)
- **All test reports are temporary** - delete after extracting findings
- **Keep:** Test specs (`.spec.ts`), config files
- **Delete:** Test results, screenshots, generated reports
- **After testing:** Extract findings → add to logs, then delete artifacts

---

## Key Principles

1. **One log per feature** - No date-based logs
2. **Plans = blueprints** - Rarely change after execution
3. **Logs = diary** - Update frequently during implementation
4. **Consolidate** - Don't create multiple logs for related features
5. **Clean up** - Testing artifacts are ephemeral

---

**Quick Reference:**
- Before coding → Create plan
- During coding → Update log
- After testing → Extract to log, delete artifacts
- Major pivot → Update plan

---
description: rerganize implementation logs and application routes. Move misplaced feature markdown files into `/docs/logs`, merge duplicate files, and detect as well as propose or apply safe merges for hidden or duplicate/similar URL routes.
allowed-tools: Bash, Edit
argument-hint: []
---

# Command: /organize

Purpose: Organize plan docs into `/.claude/plans` and reorganize hidden or duplicate `app` routes.

Actions
1) Plans
   - Look for markdown files describing implementations of features that are not in the `/.claude/plans` or `/docs` folder and move them there.
   - Reorganize scattered plans to `/docs/logs` and `/docs/setup`.
   - Merge those that describe the same features there is only one file for each feature under `/docs/logs`
   - Rename log files that don't match this format: `log-[TITLE].md`.

2) App routes
   - Live routes: `app/<segment>` with `page.tsx` or `layout.tsx` (exclude `app/_archive`); these map to URL directories.
   - Visible routes: links/buttons found in `app/page.tsx` and nav components (`components/nav-main.tsx`, `components/app-sidebar.tsx`, `components/site-header.tsx`, `components/AppShell.tsx`).
   - Report hidden routes (live but not linked), suggesting insertion points.
   - Detect duplicate or similar features across URL directories (by route path and page content); when applying, perform safe, non-conflicting merges of overlapping URL routes. Never auto-edit navigation.

Report
- Summary of moved, renamed, or merged logs or md files, hidden routes, and URL-level duplicates or similarities.
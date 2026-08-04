# Tracker Tasks Table — Stage Grouping Design Spec

**Date:** 2026-08-04  
**Status:** Approved for implementation planning  
**Surface:** `/tracker/tasks?view=table`  
**Related:** [2026-08-04-tracker-tasks-table-inline-edit-design.md](./2026-08-04-tracker-tasks-table-inline-edit-design.md)

## Goal

Group the tasks table by workflow stage. Prototype uses two demo stages — Questions and Tasks — with collapsible sections, per-group quick-add, and drag-and-drop to move tasks between stages. Demo/static only — no backend.

## Decisions

| Topic | Choice |
|-------|--------|
| Stages in prototype | Two fixed demo stages: Questions, Tasks (replace using existing space-settings stages for the table) |
| Task assignment | Each `TodayTask` gets `stageId`; existing demo tasks split roughly half / half |
| Table structure | Single table; stage header rows (`colspan`) + task rows + per-group add row |
| Collapse | Click header toggles expand/collapse; local state; both open by default |
| Quick add | One add row per expanded group; created task inherits that group's `stageId` |
| Move between stages | Native HTML5 drag-and-drop (same pattern as calendar); drop updates `stageId` |
| Intra-group reorder | Out of scope this iteration |
| Calendar | Ungrouped; keeps `stageId` on data only |
| Space settings stages UI | Unchanged this iteration |
| Language | English UI labels (Questions / Tasks) |

## Data

### Types

Extend `TodayTask` with:

```ts
stageId: string;
```

Demo stage constants (e.g. in demo data or a small tracker helper):

```ts
{ id: "questions", name: "Questions", order: 1 }
{ id: "tasks", name: "Tasks", order: 2 }
```

### Seed

Assign `stageId` on all existing demo tasks so Questions and Tasks each get about half. New tasks from a group add row use that group's `stageId`. Fallback if missing: treat as `tasks`.

## UI

### Group header row

Inside the existing table body, before each stage's tasks:

- Chevron (open / closed)
- Stage name
- Task count for that stage (visible tasks in current scope)

Clicking the header toggles collapse. Collapsed group shows only the header.

### Expanded group body

1. Task rows (same columns / inline edit as today)
2. Always-visible empty add row for that stage

Empty group: header + add row only.

### Visual

Header row uses muted background / stronger weight so sections read clearly. During drag, highlight the drop-target group (header and/or body).

## Interactions

### Collapse

Local React state: `Record<stageId, boolean>` or `Set` of collapsed ids. Default: both expanded. Not persisted.

### Quick add

Same Enter / blur / Esc / focus behavior as today, but:

- One draft state per group (or keyed by `stageId`)
- Commit appends a task with that group's `stageId`
- Keyboard Tab navigation walks only visible rows (expanded groups), including each group's add row

### Drag and drop

Reuse native HTML5 DnD (as in `calendar-task-item` / month calendar):

- Task rows are `draggable`
- Drop targets: expanded group body (including empty / add-row area) and group header (including collapsed)
- On drop onto a different stage: `onTasksChange` patches `stageId`; task appears at the end of that stage's list
- Drop onto same stage: no-op (no reorder)
- Drop on collapsed group: update `stageId`; group stays collapsed

No new DnD library.

## Out of scope

- Editing / configuring stages from the table
- Syncing table stages with Space settings stages list
- Drag reorder within a stage
- Stage column / stage Select in a cell
- Grouping in calendar view
- Persisting collapse state

## Files (expected)

- `src/components/home/tasks-today-demo-data.ts` — `stageId` on type + seed split
- `src/components/tracker/tasks/tasks-list-view.tsx` — group headers, collapse, per-group add, DnD
- Possibly a tiny shared constant for demo stages if it keeps the list view cleaner
- `app/tracker/tasks/page.tsx` — only if create-from-toolbar must set a default `stageId` (default: `tasks`)

## Verification

- Table at `?scope=space-it&view=table` shows Questions and Tasks sections
- Collapse / expand works; counts update when tasks move
- Add row in Questions creates a Questions task; same for Tasks
- Drag task from Questions to Tasks (and back) updates grouping
- Drop onto collapsed group works
- Inline edit + Tab still work across visible rows
- `npm run typecheck` / lint on touched files; English labels only

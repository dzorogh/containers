# Tracker Tasks Table — Nested Grouping Settings Design Spec

**Date:** 2026-08-04  
**Status:** Approved for implementation planning  
**Surface:** `/tracker/tasks?view=table`  
**Related:**
- [2026-08-04-tracker-tasks-table-stage-grouping-design.md](./2026-08-04-tracker-tasks-table-stage-grouping-design.md)
- [2026-08-04-tracker-tasks-table-inline-edit-design.md](./2026-08-04-tracker-tasks-table-inline-edit-design.md)

## Goal

Replace the hard-coded single-level stage grouping in the tasks table with user-configurable nested grouping. Users can choose 0–5 grouping levels from a fixed set of dimensions, reorder them, and see a nested collapsible list. Demo/static only — no backend.

## Decisions

| Topic | Choice |
|-------|--------|
| Scope | Table view only (Calendar unchanged) |
| Settings entry | Enable existing Layout settings toolbar button → Popover |
| Apply mode | Immediate (no Apply button) |
| Persistence | Session React state on the page; not in URL |
| Default | `["stage"]` (same as today) |
| Nesting depth | 0–5 levels |
| Duplicates | Each dimension at most once in the chain |
| Empty groups | Hide (render only non-empty buckets) |
| Deadline empty / far-future | Relative: `No deadline` + `Later`. Month/Week: `No deadline` + concrete period buckets only |
| Reference clock | `DEMO_REFERENCE_NOW` |
| New task | Add row only on **leaf** groups (bottom nesting level) |
| Drag-and-drop | Drop updates **all** fields implied by the target group's path |
| Collapse | Local state keyed by full path; reset when `groupingLevels` changes |
| Calendar / Board | Out of scope |
| Language | English UI labels |

## Grouping dimensions

```ts
type TaskGroupBy =
  | "stage"
  | "assignee"
  | "relativeDeadline"
  | "deadlineMonth"
  | "deadlineWeek";

type TaskGroupingLevels = TaskGroupBy[]; // length 0–5, unique values, order = nesting
```

| Dimension | UI label | Buckets |
|-----------|----------|---------|
| `stage` | Stage | Demo stages: Questions, Tasks |
| `assignee` | Assignee | Demo assignees + Unassigned |
| `relativeDeadline` | Relative deadline | Overdue, Today, Tomorrow, This week, Next week, Next month, Later, No deadline |
| `deadlineMonth` | Deadline month | `"April 2026"` from each task's deadline + No deadline |
| `deadlineWeek` | Deadline week | `"Week 38"` (ISO week) + No deadline |

### Relative deadline rules

Relative to `DEMO_REFERENCE_NOW` (calendar date in demo TZ used elsewhere):

- **Overdue** — deadline date before today
- **Today** — same calendar day
- **Tomorrow** — next calendar day
- **This week** — remaining days in the current week after tomorrow (exclude Today/Tomorrow)
- **Next week** — the following ISO/calendar week window used by the app
- **Next month** — the following calendar month window (not overlapping earlier buckets)
- **Later** — any dated task after Next month
- **No deadline** — empty `deadlineAt`

A task belongs to exactly one relative bucket.

### Month / week rules

- Month label: English month name + year, e.g. `April 2026`
- Week label: `Week {n}` using ISO week number from the deadline date
- Empty `deadlineAt` → **No deadline**
- Every dated task maps to exactly one concrete month or week bucket (no Later under these dimensions)
- Only non-empty buckets render

## Data structures

```ts
type GroupPathSegment = {
  groupBy: TaskGroupBy;
  key: string;
  label: string;
};

type TaskGroupNode = {
  key: string;
  label: string;
  groupBy: TaskGroupBy;
  path: GroupPathSegment[];
  tasks: TodayTask[]; // leaf only; empty for intermediate nodes
  children: TaskGroupNode[];
};
```

Pure helpers (feature module):

- `groupTasks(tasks, levels, now) → TaskGroupNode[]`
- `resolveBucket(task, groupBy, now) → { key, label }`
- `applyGroupPathToTask(task, path, now) → TodayTask` — sets stage, assignee, and/or deadline from every segment
- `deadlineForRelativeBucket(bucket, now) → string` (ISO or `""`)
- `deadlineForMonthBucket` / `deadlineForWeekBucket` — representative datetime for new/moved tasks

## UI

### Layout settings popover

- Visible/enabled when `view === "table"`
- Width ~320px
- Title: **Group by**
- Ordered list of levels:
  - Drag handle to reorder
  - Select for dimension (options exclude already-selected types)
  - Remove control
- **Add level** — disabled when length is 5 or all five dimensions are already used
- Hint: zero levels means a flat list
- Changes apply immediately to the table

### Table rendering

- `groupingLevels.length === 0` → flat table (no group headers); one global New task row at the bottom (or keep a single add row — flat list has no group path, so new task uses default stage / unassigned / no forced deadline)
- Otherwise: recursive collapsible headers with indent by depth, task count per node, task rows only in leaves
- After leaf node tasks: a New task row that inherits that leaf's full `path` (no add row on intermediate groups)
- Visual: reuse current stage-header styling; deeper levels slightly more indented

### Flat list New task

With 0 levels: one add row; created task uses existing defaults (`DEFAULT_DEMO_TASK_STAGE_ID`, no forced assignee/deadline change beyond current create behavior).

## Interactions

### New task

Only on leaf group nodes (bottom nesting level). Created task is passed through `applyGroupPathToTask` for that leaf's path before insert.

Representative deadlines:

| Bucket | `deadlineAt` |
|--------|----------------|
| No deadline | `""` |
| Today / Tomorrow / Overdue | Demo date for that bucket (Overdue → yesterday) + reasonable time |
| This week / Next week / Next month / Later | Mid or start of that window |
| Month / Week concrete | Start (or mid) of that period; preserve time-of-day if moving an existing task that already had a time |

Also refresh `deadlineLabel` consistently with existing demo helpers if present.

### Drag-and-drop

- Dropping onto a group header or into a group's body applies the **entire** target `path` via `applyGroupPathToTask`
- Stage and assignee segments update those fields
- Deadline segments overwrite `deadlineAt` / `deadlineLabel` according to the bucket
- Reorder within the same leaf group may keep current order behavior if already implemented; cross-group move always applies path
- Highlight drop target group during drag

### Collapse

- Keyed by serialized path (e.g. `stage:tasks/assignee:anna-petrova`)
- Default: all expanded
- Reset when `groupingLevels` changes

## Architecture

| File | Role |
|------|------|
| `src/features/tracker/tasks/task-grouping.ts` | Types, bucket resolvers, `groupTasks`, `applyGroupPathToTask`, labels |
| `src/components/tracker/tasks/tasks-grouping-settings.tsx` | Layout settings popover |
| `src/components/tracker/tasks/tasks-toolbar.tsx` | Wire Layout settings (table only) |
| `src/components/tracker/tasks/tasks-list-view.tsx` | Recursive tree render; path-aware DnD and New task |
| `app/tracker/tasks/page.tsx` | Own `groupingLevels` state; pass to toolbar + list |
| `src/components/home/tasks-today-demo-data.ts` | Extend deadline spread if needed so relative/month/week buckets are demonstrable |

Optional unit tests next to the feature module for bucket classification, nesting, and path application.

## Out of scope

- URL persistence of grouping
- Board view grouping
- Calendar grouping changes
- Wiring space-settings Kanban stages into table dimensions (keep demo Questions/Tasks)
- Filters (Add filter remains a stub)
- Sorting controls

## Success criteria

1. User can configure 0–5 nested grouping levels from the five dimensions, reorder, and remove them via Layout settings.
2. Default table still opens grouped by Stage.
3. Nested headers collapse independently; only non-empty groups show.
4. New task on each leaf group inherits the full path.
5. DnD into a group updates all path fields (stage, assignee, deadline as applicable).
6. Calendar and other views remain unchanged.
7. UI copy is English; demo-only, no API.

# Tracker Tasks Table — Inline Edit & Quick Add Design Spec

**Date:** 2026-08-04  
**Status:** Approved for implementation planning  
**Surface:** `/tracker/tasks?view=table`  
**Related:** [2026-08-04-tracker-tasks-prototype-design.md](./2026-08-04-tracker-tasks-prototype-design.md)

## Goal

Make the table view feel spreadsheet-like: inline edit of core fields, always-available empty row for quick create, Excel-lite keyboard (Enter / blur / Esc / Tab). Remove the Project column from the table. Demo/static state only — no backend.

## Decisions

| Topic | Choice |
|-------|--------|
| Editable fields | Title, Priority, Deadline, Assignee (not Project; Project column removed) |
| Quick add | Always-visible empty row at bottom + Enter in that row creates next task and focuses a new empty Title |
| Keyboard | Excel-lite: click to edit; Enter / blur commit; Esc cancel; Tab / Shift+Tab move across editable cells |
| Toolbar Add task | Keep existing create dialog; inline add is additional |
| Architecture | Extend `TasksListView` with local cell editors + `onTasksChange` (same lift pattern as calendar) |
| Selection checkbox | Unchanged (row selection, not completed) |
| Language | English UI labels |

## Architecture

### Page wiring

`app/tracker/tasks/page.tsx` already owns `tasks` and `handleVisibleTasksChange`. Table view changes from:

```tsx
<TasksListView tasks={visibleTasks} />
```

to something equivalent to:

```tsx
<TasksListView
  tasks={visibleTasks}
  onTasksChange={handleVisibleTasksChange}
  spaceId={/* current space or demo default for create */}
/>
```

Create-from-dialog stays as today (including optional Project field in the dialog). Inline create does not ask for project.

### State ownership

| Concern | Owner |
|---------|--------|
| Canonical task list | Page (`useState<TodayTask[]>`) |
| Active cell / draft title | `TasksListView` (UI-only) |
| Empty add-row draft | `TasksListView` (not in `tasks` until committed) |
| URL scope / view | Existing `tasks-page-state` |

### Columns (table)

`☐ | Title | Priority | Deadline | Assignee`

- Project column removed from header and body.
- `projectName` remains on `TodayTask` for calendar/other surfaces; inline create sets `"No project"`.

## Interaction model

### Editing existing rows

1. Click an editable cell → enter edit mode (at most one active cell).
2. **Title** — text input. Enter or blur commits trimmed title. Esc restores previous title. Empty commit on existing row rolls back to previous title (no delete).
3. **Priority** — Select: High / Medium / Low. Change commits immediately via `onTasksChange`.
4. **Deadline** — date control (`type="date"` or compact picker already in design system). Updates `deadlineAt` and recomputes `deadlineLabel` with shared helper.
5. **Assignee** — Select from demo assignees plus Unassigned. Updates `assigneeName` and `assigneeAvatarUrl`.
6. **Tab / Shift+Tab** — next / previous editable cell in row order (Title → Priority → Deadline → Assignee), then wrap to next / previous row. Include the empty add-row in the tab cycle.

### Quick add row

- Always render the table shell with an empty add row as the last body row, including when the filtered list has zero tasks (no separate “No tasks” empty card in table view).
- Defaults for a newly created task:
  - `priority`: `medium`
  - `assignee`: Unassigned
  - `deadlineAt` / labels: today (same spirit as dialog create)
  - `spaceId`: current page scope when it is a space; otherwise page default `space-holding` (same as dialog)
  - `projectName`: `"No project"`
  - `color`: `blue` (same as dialog)
- Enter or blur in Title with non-empty trimmed text → append task via `onTasksChange`, clear draft, focus Title of the new empty row.
- Enter or blur with empty Title → no-op (draft stays empty).

### Toolbar dialog

Unchanged. Users can still open Add task and create with optional project name.

## Components

### Primary

- `src/components/tracker/tasks/tasks-list-view.tsx` — table shell, selection, active cell, add row, keyboard handlers, calls into page via `onTasksChange`.

### Optional extract (if file grows)

- `src/components/tracker/tasks/tasks-table-cells.tsx` — Title / Priority / Deadline / Assignee cell editors.

### Shared demo helpers

- Export demo assignee list (and Unassigned) from `tasks-today-demo-data.ts` (or a tiny adjacent helper) so assignee Select matches calendar/demo data.
- Export or reuse deadline label formatting so table edits stay consistent with cards/calendar.

### Out of scope

- Backend persistence
- Completed / done checkbox semantics
- Drag reorder, sticky header, virtualization
- Full spreadsheet (arrow-key grid, F2, fill handle)
- Removing Project from create dialog
- Changing calendar create UX

## Error handling

- Invalid / empty title on existing task edit → revert, no toast required.
- Inline create requires non-empty title; silent no-op if empty.
- Dialog create keeps current toast validation (`Enter a task title.` / `Task created`).

## Testing

- Manual: edit each column; Tab across cells/rows; create via empty row Enter; create via toolbar dialog; confirm Project column gone; confirm calendar still sees new/edited tasks in shared state.
- Automated tests only if a nearby pattern already exists for tracker tasks; do not add a heavy test harness for this prototype.

## Success criteria

1. Project column absent in table view.
2. Title, Priority, Deadline, Assignee editable inline with Excel-lite keys.
3. Empty row always at bottom; Enter creates task and prepares next empty row.
4. Toolbar dialog still works.
5. List and calendar share the same in-session task list after edits/creates.
)
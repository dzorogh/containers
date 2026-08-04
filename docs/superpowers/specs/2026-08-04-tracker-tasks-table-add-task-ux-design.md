# Tracker Tasks Table — Add Task UX Design Spec

**Date:** 2026-08-04  
**Status:** Approved for implementation planning  
**Surface:** `/tracker/tasks?view=table`  
**Related:**
- [2026-08-04-tracker-tasks-table-nested-grouping-design.md](./2026-08-04-tracker-tasks-table-nested-grouping-design.md)
- [2026-08-04-tracker-tasks-table-inline-edit-design.md](./2026-08-04-tracker-tasks-table-inline-edit-design.md)

## Goal

Replace the always-visible bottom “New task” input row with three controlled entry points for creating tasks in the table:

1. **Plus on leaf group header** (and flat list header/toolbar area)
2. **Hover insert `+` on row separators** (no layout shift)
3. **Right-click context menu** on a task row, including **Add task below**

Demo/static only — no backend.

## Decisions

| Topic | Choice |
|-------|--------|
| Scope | Table view only |
| Always-visible add row | Removed |
| Where Plus on group | Leaf groups only (bottom nesting level); flat mode has one equivalent control |
| New task from group Plus | Draft row at **top** of that group’s tasks |
| After successful Enter | Close draft; no special focus move |
| Escape / empty blur | Discard and hide draft |
| Created task order (group Plus) | Prepend within the group’s task order |
| Hover insert | Upper/lower half of task row → `+` on separator above/below |
| Hover layout | Overlay only — **must not** shift row height, padding, or table layout |
| Context menu actions | Open task · Mark as done / Mark as not done · Add task below · Delete |
| Add task below | Draft immediately under the target task; create inserts there |
| Intermediate groups | No group Plus, no add draft, no hover insert targeting group headers |
| Checklist rows | Out of scope for hover insert and context menu |
| Labels | English UI |
| Persistence | Session React state (same as current demo tasks) |

This spec **supersedes** the nested-grouping note that a permanent New task row sits after leaf tasks.

## Entry points

### 1. Leaf group Plus

- On the leaf group header row, show a compact `+` control (`aria-label="Add task"`).
- Clicking reveals a dashed title input draft as the **first** task-level row under that header (above existing tasks).
- Flat mode (`groupingLevels.length === 0`): one Plus that reveals a draft at the top of the list.
- Intermediate (non-leaf) group headers: no Plus.

### 2. Hover separator Plus

- Applies only to **task rows** inside a leaf group or flat list.
- While the pointer is over a task row, measure vertical position:
  - **Upper half** → show insert `+` on the separator **above** that row
  - **Lower half** → show insert `+` on the separator **below** that row
- First / last task: same rules (above first / below last).
- Adjacent rows share a separator: lower half of row N and upper half of row N+1 map to the same insert index.
- Visual: small `+` centered on the existing border/separator line, absolutely positioned (or equivalent overlay). **No layout shift** — no extra spacer rows, no growing padding.
- Click → open draft at that insert index; commit inserts the task at that index within the group’s ordered tasks.

### 3. Context menu (right-click)

On a task row, open a context menu with:

| Action | Behavior |
|--------|----------|
| Open task | Navigate to `/tracker/tasks/{id}` (same as existing open affordance) |
| Mark as done / Mark as not done | Toggle `done` (label reflects current state) |
| Add task below | Open draft immediately under this task |
| Delete | Remove the task from the demo list |

Use a proper Context Menu primitive (shadcn/Radix) if available in the project; otherwise add the standard shadcn `context-menu` component. Labels in English.

## Draft row behavior

Shared for all entry points:

- Single active draft at a time. Opening a draft from another entry point replaces the previous draft and discards its uncommitted title (v1).
- Fields: title input (dashed); priority/deadline/assignee show the same read-only defaults as today’s create row.
- **Enter** with non-empty trimmed title → create via existing `buildCreatedTask` + `applyGroupPathToTask` for the leaf path; insert at draft index; hide draft; **no focus move**.
- **Enter** with empty title → hide draft (cancel).
- **Escape** → clear and hide draft.
- **Blur** with empty → hide; with non-empty → commit then hide; no special focus.

### Insert index semantics

Within a leaf group (or flat list), tasks have an ordered list `T[0..n-1]`.

| Source | Draft / insert index |
|--------|----------------------|
| Group Plus | `0` (top) |
| Hover above task `i` | `i` |
| Hover below task `i` | `i + 1` |
| Add task below task `i` | `i + 1` |

After create, update the global `tasks` array so that relative order among tasks in that group matches the insert index. Tasks outside the group keep their relative order unchanged (implementation may rebuild by splicing within the filtered group subset, then merging back).

## State (suggested)

```ts
type TaskDraft = {
  pathKey: string; // leaf path key or flat sentinel
  path: GroupPathSegment[];
  insertIndex: number; // within that group's tasks
  title: string;
};
```

- `draft: TaskDraft | null` — replaces always-on `addTitles` map + permanent add row ids in the visible-row keyboard grid as needed.
- Hover UI state: `{ pathKey, edgeIndex } | null` where `edgeIndex` is the separator index `0..n` for n tasks (purely presentational; cleared on leave).

Keyboard navigation among editable cells may omit the draft until it is open; when open, include the draft row id in the visible sequence.

## Out of scope

- Calendar / board quick-add changes
- Drag-reorder of tasks (DnD to groups remains as today)
- Undo for delete
- Multi-draft / bulk create mode
- Hover insert on group headers or checklist rows

## Acceptance criteria

1. No permanent New task row at the bottom of leaf groups or flat list.
2. Leaf group (and flat) Plus opens a top draft; Enter creates at top and closes draft without moving focus.
3. Hovering a task row shows an overlay `+` above or below by half; clicking never shifts table layout.
4. Context menu offers Open, Done toggle, Add task below, Delete.
5. Add task below and hover-below insert create under the target row.
6. Intermediate groups have no Plus and no task-add draft.
7. All user-visible strings are English.
8. Existing grouping, collapse, DnD-to-group, and inline edit still work.

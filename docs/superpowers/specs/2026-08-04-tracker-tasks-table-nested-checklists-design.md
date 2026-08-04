# Tracker Tasks Table — Nested Checklists Design Spec

**Date:** 2026-08-04  
**Status:** Approved for implementation planning  
**Surface:** `/tracker/tasks?view=table`  
**Related:**
- [2026-08-04-tracker-tasks-table-stage-grouping-design.md](./2026-08-04-tracker-tasks-table-stage-grouping-design.md)
- [2026-08-04-tracker-tasks-table-inline-edit-design.md](./2026-08-04-tracker-tasks-table-inline-edit-design.md)

## Goal

Each task has a single nested checklist tree with arbitrary depth. In the table view, expand a task row to see, add, edit, complete, indent/outdent, and drag-reorder checklist items inline. Demo/static only — no backend.

## Decisions

| Topic | Choice |
|-------|--------|
| Interaction | Expand task row; checklist renders in a `colSpan` row under the task |
| Structure | One hierarchy per task (`checklist: ChecklistItem[]` roots) |
| Nesting | Unlimited (recursive) |
| Completion | Independent — parent and children toggle separately |
| Progress | Count all nodes (`done / total`); show on task row when `total > 0` |
| Actions (v1) | Expand/collapse, toggle, rename, add, delete, indent/outdent, HTML5 DnD reorder + reparent |
| Soft-delete / “Show deleted” | Out of scope |
| Separate Checklists module page | Unchanged placeholder; not wired this iteration |
| Language | English UI labels |
| DnD library | Native HTML5 only (same as stage drag); no new dependency |

## Data

### Types

```ts
type ChecklistItem = {
  id: string;
  title: string;
  done: boolean;
  children: ChecklistItem[];
};

// on TodayTask
checklist: ChecklistItem[];
```

Default for existing/new tasks: `checklist: []`.

### Helpers (`checklist-tree.ts`)

Pure immutable functions operating on `ChecklistItem[]`:

- `countChecklist(items)` → `{ done, total }`
- `toggleChecklistItem(items, id)`
- `renameChecklistItem(items, id, title)`
- `addChecklistItem(items, parentId | null, title)` — `null` = root append
- `removeChecklistItem(items, id)` — promote children to the removed node’s parent
- `indentChecklistItem(items, id)` / `outdentChecklistItem(items, id)`
- `moveChecklistItem(items, id, targetId, position: "before" | "after" | "into")` — reject moves into own descendant

### Seed

Attach sample trees to a few demo tasks (depth ≥ 3 on at least one). Leave most tasks with `[]` so empty-state expand is easy to verify.

## UI

### Task row

- Chevron before title toggles checklist expand (separate from row-select checkbox and stage DnD).
- Compact progress badge `3/12` next to title when `total > 0`; click also expands.
- No badge when empty; chevron still available to add the first item.

### Expanded row

Additional `TableRow` immediately under the task:

- `colSpan={5}`, muted background (`bg-muted/20`)
- Header: `Checklist 3/12` + **Add item**
- Body: `TaskChecklist` tree
- Empty: placeholder input “Add checklist item…”

### Checklist item row

- Collapse chevron if `children.length > 0`
- Checkbox (`done`)
- Editable title (inline, same Enter/Esc pattern as task title)
- Drag handle on the right (or leading grip) so title edit and task-row DnD do not fight
- Indent: `depth * 16px`
- Hover reveals **Add child** (or equivalent affordance)

Visual language stays within Oryx table/checklist patterns. Do not copy flame icons or soft-delete toggle from the reference screenshot.

## Interactions

### Expand state

- Task expand: `expandedTaskIds: Set<string>` in `TasksListView` (local, not persisted).
- Item collapse inside the tree: local state in `TaskChecklist`.

### Editing

| Action | Behavior |
|--------|----------|
| Toggle checkbox | Flip `done` on that node only |
| Click title | Inline rename; Enter commit; Esc cancel |
| Enter on item | Add sibling below; focus new title |
| Tab / Shift+Tab | Indent / outdent |
| Delete/Backspace on empty title | Remove item; children move to parent |
| Add item | Append root; focus new title |
| Add child | Append under current item; expand parent; focus new title |
| Blur empty new item | Remove it; blur empty rename → revert |

### Drag and drop

Native HTML5 on checklist items only:

- Drop zones per item: **before**, **after**, **into**
- Visual: insertion line (before/after) or highlight (into)
- Reject drop into own descendant (no-op)
- `stopPropagation` on checklist drag events so stage-level task drag does not start
- Task rows remain draggable for stage moves when the checklist is collapsed; when expanded, prefer starting task drag from outside the checklist panel

## Architecture / files

| File | Responsibility |
|------|----------------|
| `src/components/home/tasks-today-demo-data.ts` | `ChecklistItem` type; `checklist` on `TodayTask`; seed trees |
| `src/components/tracker/tasks/checklist-tree.ts` | Pure tree mutations + counts |
| `src/components/tracker/tasks/checklist-tree.test.ts` | Unit tests for tree helpers |
| `src/components/tracker/tasks/task-checklist.tsx` | Nested checklist UI, local collapse, DnD, inline edit |
| `src/components/tracker/tasks/tasks-list-view.tsx` | Expand chevron, progress badge, expanded `colSpan` row wiring |

Data flow: checklist mutations call `onTasksChange` via `updateTask(taskId, { checklist: next })`.

## Error handling / edge cases

- Move into own descendant → no-op, no toast required
- Missing `checklist` on older in-memory objects → treat as `[]`
- Concurrent expand of many deep trees → acceptable for demo; no virtualization this iteration
- Progress on collapsed task row always reflects full tree (including collapsed item branches)

## Testing

- Unit: count, toggle, add/remove, indent/outdent, move before/after/into, cycle rejection, promote-children on delete
- Manual on `?scope=space-it&view=table`: expand, add nested items, toggle progress, DnD reparent, confirm task stage drag still works

## Out of scope

- Soft-delete / “Show deleted”
- Cascading completion (parent ↔ children)
- Multiple root checklists as separate named lists
- `/tracker/checklists` module page
- Persistence / API / Supabase
- Calendar or list (non-table) views showing checklists
- New DnD library (`@dnd-kit`, etc.)

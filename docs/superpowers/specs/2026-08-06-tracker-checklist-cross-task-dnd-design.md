# Tracker Tasks Table — Cross-Task Checklist DnD Design Spec

**Date:** 2026-08-06  
**Status:** Approved for implementation planning  
**Surface:** `/tracker/tasks?view=table`  
**Related:**
- [2026-08-04-tracker-tasks-table-nested-checklists-design.md](./2026-08-04-tracker-tasks-table-nested-checklists-design.md)
- [2026-08-04-tracker-tasks-table-add-task-ux-design.md](./2026-08-04-tracker-tasks-table-add-task-ux-design.md)
- [2026-08-04-tracker-tasks-table-stage-grouping-design.md](./2026-08-04-tracker-tasks-table-stage-grouping-design.md)

## Goal

Extend checklist drag-and-drop so a checklist item (with its subtree) can move between tasks, or be dropped at task level and become a new task whose checklist is the former children. Demo/static only — no backend.

## Decisions

| Topic | Choice |
|-------|--------|
| Approach | Lift checklist DnD ownership to `TasksListView`; keep native HTML5 (no new DnD library) |
| Drop semantics | Drop **inside** a task → stays a checklist item; drop **at task level** (before/after a task row) → promote to task |
| Collapsed task row | Drop on collapsed task → append to that task’s checklist **root**; auto-expand target |
| Promote insert position | Before/after the hovered task row, same group/stage as drop target |
| New task fields | Title from checklist item + `checklist` from former children; other fields = defaults like draft “New task” in that group (`buildCreatedTask` + `applyGroupPathToTask`) |
| Reverse (task → checklist) | Out of scope |
| DnD library | Native HTML5 only (same as existing checklist + stage drag) |
| Language | English UI labels |

## Drop zones

| Zone | Visual | Result |
|------|--------|--------|
| Checklist item (expanded panel) | before / after / into (unchanged) | Move subtree into target task’s checklist |
| Empty checklist panel | Root highlight | Append the dragged node (with its children) as a root item |
| Collapsed task row | Ring/highlight on row | Append to checklist root; expand task |
| Task row before/after (~top/bottom 25%) | Insertion line | Promote item → new task at that index |
| Same checklist (intra-task) | Unchanged | Reorder / reparent via existing `moveChecklistItem` |
| Group header (no task row) | — | No-op in v1 |

### Hit-test on task rows (when dragging a checklist item)

- Top ~25% → **before** (promote)
- Bottom ~25% → **after** (promote)
- Middle on **collapsed** row → **into** checklist root
- Middle on **expanded** task title row → prefer **into** checklist root (same as collapsed); fine-grained before/after/into inside the expanded checklist panel remain the primary intra-checklist targets

## Data / mutations

### Payload

```ts
type ChecklistDragPayload = {
  type: "checklist-item";
  sourceTaskId: string;
  itemId: string;
};
```

Set via `dataTransfer` custom type (e.g. `application/x-oryx-checklist-item`) plus React state in `TasksListView` for live drop preview: `draggingChecklist: ChecklistDragPayload | null`.

### Tree helpers (`checklist-tree.ts`)

Pure immutable additions:

- `findChecklistItem(items, id)` → node | null
- `extractChecklistSubtree(items, id)` → `{ next, node }` — removes the node **with** its children (unlike `removeChecklistItem`, which promotes children)
- Reuse / extend insert so a detached `ChecklistItem` can be placed `before` | `after` | `into` a target id, or appended at root when target is null / into-task-root

Existing `moveChecklistItem` remains for same-tree moves. Cross-task move = extract from source tree + insert into target tree in one `onTasksChange`.

### Promote to task

1. `extractChecklistSubtree` from source task
2. Build task: `buildCreatedTask(title || "Untitled", …)` then `applyGroupPathToTask` for the drop target’s group path
3. Set `checklist: node.children` (preserve child `done` / nested structure and ids)
4. New task `done` = default (`false`); checklist item’s own `done` is discarded (it is no longer an item)
5. `insertTaskAmongSiblings(prev, siblings, nextTask, insertIndex)` for before/after
6. Source task no longer contains the promoted node

Checklist item ids are preserved when moving between checklists. New tasks get a new `task-*` id.

## Architecture / files

| File | Responsibility |
|------|----------------|
| `src/components/tracker/tasks/checklist-tree.ts` | `find` / `extractSubtree` / insert detached node; unit-tested |
| `tests/unit/checklist-tree.test.ts` | Cover extract, cross-tree insert, cycle rejection |
| `src/components/tracker/tasks/task-checklist.tsx` | Intra-tree DnD; emit drag start with payload; accept external drops via props/callbacks from parent |
| `src/components/tracker/tasks/tasks-list-view.tsx` | Owns `draggingChecklist`; task-row drop (promote vs into); wires cross-move + promote; auto-expand target |

Data flow: all mutations go through `onTasksChange` in a single updater when source and target differ.

### Conflict with task stage drag

- Checklist drag: `stopPropagation` + distinct `dataTransfer` type
- Task stage-drag must not start while a checklist item is being dragged
- On task row drop: if payload is checklist → promote or into-checklist; if payload is task → existing stage/path move unchanged

## Error handling / edge cases

- Move into own descendant → no-op
- Drop on source task (into root / sibling positions) → normal same-task move
- Empty title on promote → `"Untitled"`
- After extract, empty source checklist is fine; progress badge hides when `total === 0`
- Drop on group header → no-op
- Missing `checklist` on older in-memory objects → treat as `[]`

## Testing

- Unit: `extractChecklistSubtree`, insert into another tree, reject cycle, promote mapping (children → new task checklist; source without node)
- Manual on `?view=table`: cross-task checklist move; drop on collapsed task (auto-expand); promote between rows; confirm task stage drag still works; intra-checklist DnD unchanged

## Out of scope

- Task → checklist demotion
- Persistence / API / Supabase
- Calendar or non-table views
- New DnD library (`@dnd-kit`, etc.)
- Soft-delete / cascading completion
- Drop onto empty group with no adjacent task row (use existing add-task UX)

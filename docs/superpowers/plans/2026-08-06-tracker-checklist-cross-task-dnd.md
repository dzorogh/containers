# Tracker Checklist Cross-Task DnD — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Spec: `docs/superpowers/specs/2026-08-06-tracker-checklist-cross-task-dnd-design.md`.

**Goal:** Allow dragging a checklist item between tasks (subtree stays a checklist item) or dropping it at task-row level to promote it into a new task whose checklist is the former children — demo state only, native HTML5 DnD.

**Architecture:** Export pure extract/insert helpers from `checklist-tree.ts`. Lift cross-task drag state to `TasksListView`. `TaskChecklist` keeps intra-tree DnD and notifies parent on drag start / accepts external drops. Task-row hit-test distinguishes promote (before/after) vs into-checklist (middle / collapsed).

**Tech Stack:** React client components, existing table/checklist UI, native HTML5 DnD, Vitest under `tests/unit/`.

---

## File map

| File | Responsibility |
|------|----------------|
| `src/components/tracker/tasks/checklist-tree.ts` | Export `extractChecklistSubtree`, `insertChecklistSubtree` (reuse private `extractItem` / `insertAt`) |
| `tests/unit/checklist-tree.test.ts` | Unit tests for extract + cross-tree insert + cycle no-op |
| `src/components/tracker/tasks/task-checklist.tsx` | Payload MIME; parent callbacks; root drop zone; optional external drag id |
| `src/components/tracker/tasks/tasks-list-view.tsx` | `draggingChecklist` state; task-row drop; promote + cross-move; auto-expand |

---

### Task 1: Tree helpers — extract and insert subtree

**Files:**
- Modify: `src/components/tracker/tasks/checklist-tree.ts`
- Modify: `tests/unit/checklist-tree.test.ts`

- [ ] **Step 1: Export extract helper**

`findChecklistItem` already exists. Export a thin wrapper over private `extractItem`:

```ts
export const extractChecklistSubtree = (
  items: ChecklistItem[],
  id: string,
): { next: ChecklistItem[]; node: ChecklistItem | null } => {
  const { tree, extracted } = extractItem(items, id);
  return { next: tree, node: extracted };
};
```

Note: unlike `removeChecklistItem`, children stay on the extracted node.

- [ ] **Step 2: Export insert helper**

```ts
export const insertChecklistSubtree = (
  items: ChecklistItem[],
  node: ChecklistItem,
  targetId: string | null,
  position: ChecklistDropPosition,
): ChecklistItem[] => {
  if (targetId === null) {
    // Root append (into-task-root / empty panel)
    return [...items, node];
  }
  if (isDescendantOrSelf(items, node.id, targetId)) {
    return items;
  }
  // Reject if node.id already present in items (should not happen after extract)
  if (findChecklistItem(items, node.id)) {
    return items;
  }
  return insertAt(items, targetId, position, node) ?? items;
};
```

For same-tree moves, keep using `moveChecklistItem`. Cross-task = extract from source + `insertChecklistSubtree` into target.

- [ ] **Step 3: Unit tests**

Add to `tests/unit/checklist-tree.test.ts`:

```ts
describe("extractChecklistSubtree", () => {
  it("removes node with children intact", () => {
    const { next, node } = extractChecklistSubtree(sample(), "a");
    expect(node?.id).toBe("a");
    expect(node?.children.map((c) => c.id)).toEqual(["a1", "a2"]);
    expect(next.map((c) => c.id)).toEqual(["b"]);
  });

  it("returns null node when missing", () => {
    const { next, node } = extractChecklistSubtree(sample(), "missing");
    expect(node).toBeNull();
    expect(next).toEqual(sample());
  });
});

describe("insertChecklistSubtree", () => {
  it("appends at root when targetId is null", () => {
    const node = { id: "x", title: "X", done: false, children: [] };
    const next = insertChecklistSubtree(sample(), node, null, "into");
    expect(next.map((c) => c.id)).toEqual(["a", "b", "x"]);
  });

  it("inserts before / after / into", () => {
    const node = { id: "x", title: "X", done: false, children: [] };
    expect(insertChecklistSubtree(sample(), node, "b", "before").map((c) => c.id)).toEqual([
      "a",
      "x",
      "b",
    ]);
    expect(insertChecklistSubtree(sample(), node, "a", "into")[0].children.map((c) => c.id)).toEqual([
      "a1",
      "a2",
      "x",
    ]);
  });

  it("rejects insert when target is descendant of node id already in tree", () => {
    // Prefer testing via moveChecklistItem cycle; for insert after extract from another tree,
    // descendant check only applies if node.id somehow exists — cover findChecklistItem duplicate guard.
    const dup = sample()[0];
    expect(insertChecklistSubtree(sample(), dup, "b", "before")).toEqual(sample());
  });
});
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run tests/unit/checklist-tree.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/tracker/tasks/checklist-tree.ts tests/unit/checklist-tree.test.ts
git commit -m "$(cat <<'EOF'
feat(tracker): extract/insert checklist subtree helpers

EOF
)"
```

---

### Task 2: Checklist MIME + parent-aware DnD in `TaskChecklist`

**Files:**
- Modify: `src/components/tracker/tasks/task-checklist.tsx`

- [ ] **Step 1: Shared MIME constant**

Export (or colocate) a constant used by list view:

```ts
export const CHECKLIST_DND_MIME = "application/x-oryx-checklist-item";
```

Payload JSON: `{ type: "checklist-item", sourceTaskId: string, itemId: string }`.

- [ ] **Step 2: Extend props**

```ts
type TaskChecklistProps = {
  items: ChecklistItem[];
  onChange: (next: ChecklistItem[]) => void;
  baseLevel?: number;
  taskId: string;
  /** When set, an item from another task is being dragged */
  externalDraggingId?: string | null;
  onChecklistDragStart?: (itemId: string) => void;
  onChecklistDragEnd?: () => void;
  /** Cross-task drop onto an item (parent performs extract+insert) */
  onExternalDropOnItem?: (
    itemId: string,
    position: ChecklistDropPosition,
  ) => void;
  /** Cross-task drop onto empty / root panel */
  onExternalDropOnRoot?: () => void;
};
```

- [ ] **Step 3: Wire drag start / end**

On item `onDragStart`:

```ts
event.stopPropagation();
event.dataTransfer.setData(CHECKLIST_DND_MIME, JSON.stringify({
  type: "checklist-item",
  sourceTaskId: taskId,
  itemId: item.id,
}));
event.dataTransfer.effectAllowed = "move";
setDraggingId(item.id);
onChecklistDragStart?.(item.id);
```

On `onDragEnd`: clear local state + `onChecklistDragEnd?.()`.

- [ ] **Step 4: External drop on items**

In `onDropItem` / `onDragOverItem`:

- If local `draggingId` → existing `moveChecklistItem` path
- Else if `externalDraggingId` (or MIME present) → `preventDefault` / `stopPropagation`, call `onExternalDropOnItem?.(id, position)`

Visual drop target should work for both local and external drag ids (use `draggingId ?? externalDraggingId`).

- [ ] **Step 5: Root / empty panel drop zone**

On the checklist container (header area or empty state wrapper):

- `onDragOver`: if MIME or external drag, `preventDefault`, show root highlight
- `onDrop`: `onExternalDropOnRoot?.()` or local no-op

- [ ] **Step 6: Commit**

```bash
git add src/components/tracker/tasks/task-checklist.tsx
git commit -m "$(cat <<'EOF'
feat(tracker): checklist DnD payload and external drop hooks

EOF
)"
```

---

### Task 3: Cross-task move + promote in `TasksListView`

**Files:**
- Modify: `src/components/tracker/tasks/tasks-list-view.tsx`

- [ ] **Step 1: Drag state**

```ts
type ChecklistDragState = {
  sourceTaskId: string;
  itemId: string;
};

const [draggingChecklist, setDraggingChecklist] = useState<ChecklistDragState | null>(null);
const [checklistTaskDrop, setChecklistTaskDrop] = useState<{
  taskId: string;
  position: "before" | "after" | "into";
} | null>(null);
```

- [ ] **Step 2: Orchestration helpers (inside component or module-local)**

```ts
const moveChecklistAcrossTasks = (
  prev: TodayTask[],
  sourceTaskId: string,
  itemId: string,
  targetTaskId: string,
  targetItemId: string | null,
  position: ChecklistDropPosition,
): TodayTask[] => {
  const source = prev.find((t) => t.id === sourceTaskId);
  const target = prev.find((t) => t.id === targetTaskId);
  if (!source || !target) return prev;

  if (sourceTaskId === targetTaskId) {
    if (targetItemId === null) {
      const { next, node } = extractChecklistSubtree(source.checklist ?? [], itemId);
      if (!node) return prev;
      return prev.map((t) =>
        t.id === sourceTaskId
          ? { ...t, checklist: insertChecklistSubtree(next, node, null, "into") }
          : t,
      );
    }
    return prev.map((t) =>
      t.id === sourceTaskId
        ? {
            ...t,
            checklist: moveChecklistItem(t.checklist ?? [], itemId, targetItemId, position),
          }
        : t,
    );
  }

  const { next: sourceNext, node } = extractChecklistSubtree(source.checklist ?? [], itemId);
  if (!node) return prev;
  const targetNext = insertChecklistSubtree(
    target.checklist ?? [],
    node,
    targetItemId,
    targetItemId === null ? "into" : position,
  );
  return prev.map((t) => {
    if (t.id === sourceTaskId) return { ...t, checklist: sourceNext };
    if (t.id === targetTaskId) return { ...t, checklist: targetNext };
    return t;
  });
};

const promoteChecklistItemToTask = (
  prev: TodayTask[],
  sourceTaskId: string,
  itemId: string,
  path: GroupPathSegment[],
  pathKey: string,
  insertIndex: number,
  spaceId: string,
): TodayTask[] | null => {
  const source = prev.find((t) => t.id === sourceTaskId);
  if (!source) return null;
  const { next: sourceNext, node } = extractChecklistSubtree(source.checklist ?? [], itemId);
  if (!node) return null;

  const title = node.title.trim() || "Untitled";
  const base = buildCreatedTask(title, spaceId, DEFAULT_DEMO_TASK_STAGE_ID);
  const withPath =
    pathKey === FLAT_PATH_KEY || path.length === 0
      ? base
      : applyGroupPathToTask(base, path, DEMO_REFERENCE_NOW);
  const nextTask: TodayTask = {
    ...withPath,
    checklist: node.children,
  };

  const withSource = prev.map((t) =>
    t.id === sourceTaskId ? { ...t, checklist: sourceNext } : t,
  );
  const siblings = /* same as siblingIdsForPath(pathKey, path) but on withSource */;
  return insertTaskAmongSiblings(withSource, siblings, nextTask, insertIndex);
};
```

Wire `siblingIdsForPath` against the post-extract list (sibling order unchanged by checklist extract).

- [ ] **Step 3: Pass props into `TaskChecklist`**

```tsx
<TaskChecklist
  taskId={task.id}
  items={task.checklist ?? []}
  baseLevel={depth + 2}
  externalDraggingId={
    draggingChecklist && draggingChecklist.sourceTaskId !== task.id
      ? draggingChecklist.itemId
      : null
  }
  onChecklistDragStart={(itemId) =>
    setDraggingChecklist({ sourceTaskId: task.id, itemId })
  }
  onChecklistDragEnd={() => {
    setDraggingChecklist(null);
    setChecklistTaskDrop(null);
  }}
  onChange={(checklist) => updateTask(task.id, { checklist })}
  onExternalDropOnItem={(itemId, position) => {
    if (!draggingChecklist) return;
    onTasksChange((prev) =>
      moveChecklistAcrossTasks(
        prev,
        draggingChecklist.sourceTaskId,
        draggingChecklist.itemId,
        task.id,
        itemId,
        position,
      ),
    );
    setExpandedTaskIds((s) => new Set(s).add(task.id));
    setDraggingChecklist(null);
    setChecklistTaskDrop(null);
  }}
  onExternalDropOnRoot={() => {
    if (!draggingChecklist) return;
    onTasksChange((prev) =>
      moveChecklistAcrossTasks(
        prev,
        draggingChecklist.sourceTaskId,
        draggingChecklist.itemId,
        task.id,
        null,
        "into",
      ),
    );
    setExpandedTaskIds((s) => new Set(s).add(task.id));
    setDraggingChecklist(null);
    setChecklistTaskDrop(null);
  }}
/>
```

- [ ] **Step 4: Task row drop handlers when `draggingChecklist`**

On `TableRow` for tasks, extend drag handlers (compose with existing `pathDropHandlers`):

```ts
onDragOver: (event) => {
  if (!draggingChecklist) {
    // existing path drop over for task stage drag
    dropHandlers.onDragOver?.(event);
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  const bounds = event.currentTarget.getBoundingClientRect();
  const ratio = (event.clientY - bounds.top) / bounds.height;
  const position =
    ratio < 0.25 ? "before" : ratio > 0.75 ? "after" : "into";
  setChecklistTaskDrop({ taskId: task.id, position });
},
onDrop: (event) => {
  if (!draggingChecklist || !checklistTaskDrop || checklistTaskDrop.taskId !== task.id) {
    dropHandlers.onDrop?.(event);
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  const { position } = checklistTaskDrop;
  if (position === "into") {
    onTasksChange((prev) =>
      moveChecklistAcrossTasks(
        prev,
        draggingChecklist.sourceTaskId,
        draggingChecklist.itemId,
        task.id,
        null,
        "into",
      ),
    );
    setExpandedTaskIds((s) => new Set(s).add(task.id));
  } else {
    const insertIndex = position === "before" ? taskIndex : taskIndex + 1;
    onTasksChange((prev) => {
      const next = promoteChecklistItemToTask(
        prev,
        draggingChecklist.sourceTaskId,
        draggingChecklist.itemId,
        path,
        pathKey,
        insertIndex,
        spaceId,
      );
      return next ?? prev;
    });
  }
  setDraggingChecklist(null);
  setChecklistTaskDrop(null);
},
```

Visual: insertion line for before/after; ring for into (match checklist `ring-primary/40`).

- [ ] **Step 5: Block task stage drag while checklist dragging**

In task row `onDragStart`:

```ts
if (draggingChecklist) {
  event.preventDefault();
  return;
}
```

Also: when checklist drag starts from inside expanded panel, existing `stopPropagation` already prevents bubbling — keep it.

- [ ] **Step 6: Manual check**

On `/tracker/tasks?view=table` with seeded checklists (`task-8`, `task-201`, `task-202`):

1. Expand two tasks → drag item between checklists (before/after/into)
2. Collapse target → drop on row middle → item in root, target expands
3. Drag item to top/bottom of another task row → new task appears; children become its checklist; source loses the item
4. Intra-checklist DnD still works
5. Task stage/group drag still works when not dragging checklist

- [ ] **Step 7: Commit**

```bash
git add src/components/tracker/tasks/tasks-list-view.tsx src/components/tracker/tasks/task-checklist.tsx
git commit -m "$(cat <<'EOF'
feat(tracker): cross-task checklist move and promote-to-task

EOF
)"
```

---

### Task 4: Verification

- [ ] **Step 1: Unit tests**

```bash
npx vitest run tests/unit/checklist-tree.test.ts
```

- [ ] **Step 2: Typecheck / lint (touched files)**

```bash
npm run typecheck
npm run lint
```

- [ ] **Step 3: UI English / static images** (no new copy expected beyond existing `"Untitled"`; skip unless new strings added)

If new user-visible strings: `npm run check:ui-english`.

---

## Out of scope (do not implement)

- Task → checklist demotion
- Persistence / API
- `@dnd-kit`
- Calendar / non-table views
- Drop on group header

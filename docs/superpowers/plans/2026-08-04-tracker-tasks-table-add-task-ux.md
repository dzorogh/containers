# Tracker Tasks Table Add Task UX — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Spec: `docs/superpowers/specs/2026-08-04-tracker-tasks-table-add-task-ux-design.md`.

**Goal:** Replace the always-visible bottom New task row with leaf-group Plus (draft at top), overlay hover-separator Plus (no layout shift), and a task-row context menu (Open / Done toggle / Add task below / Delete).

**Architecture:** Pure helper `insertTaskAmongSiblings` owns ordered insert into the global `tasks` array. `TasksListView` holds a single `TaskDraft | null` and hover edge state; draft row renders only when open. Context menu wraps each task row via a new shadcn-style `context-menu` built on `@base-ui/react/context-menu` (same stack as `dropdown-menu.tsx`). Calendar / board unchanged.

**Tech Stack:** React client components, vitest, `@base-ui/react/context-menu`, existing `Table` / `Button` / `Input`, lucide `Plus`.

---

## File map

| File | Responsibility |
|------|----------------|
| `src/features/tracker/tasks/task-grouping.ts` | Add `insertTaskAmongSiblings` |
| `tests/unit/task-grouping.test.ts` | Tests for ordered insert |
| `src/components/ui/context-menu.tsx` | Base UI context menu wrappers (mirror dropdown-menu styling) |
| `src/components/tracker/tasks/tasks-list-view.tsx` | Draft state, group Plus, hover overlay Plus, context menu, remove permanent add row |

---

### Task 1: Ordered insert helper (TDD)

**Files:**
- Modify: `src/features/tracker/tasks/task-grouping.ts`
- Modify: `tests/unit/task-grouping.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `tests/unit/task-grouping.test.ts`:

```ts
import { insertTaskAmongSiblings } from "@/features/tracker/tasks/task-grouping";
import type { TodayTask } from "@/components/home/tasks-today-demo-data";

const task = (id: string): TodayTask =>
  ({
    id,
    href: `/tracker/tasks/${id}`,
    title: id,
    projectName: "No project",
    priority: "medium",
    comments: 0,
    color: "blue",
    deadlineAt: "",
    deadlineLabel: "No deadline",
    createdAt: "2026-01-01T00:00:00.000Z",
    customDateFields: { planningDate: "" },
    assigneeName: "Unassigned",
    assigneeAvatarUrl: "",
    spaceId: "space-1",
    stageId: "tasks",
    done: false,
    checklist: [],
  }) as TodayTask;

describe("insertTaskAmongSiblings", () => {
  it("inserts at index 0 among siblings and preserves non-siblings", () => {
    const all = [task("a"), task("x"), task("b"), task("y"), task("c")];
    const next = insertTaskAmongSiblings(all, ["a", "b", "c"], task("n"), 0);
    expect(next.map((t) => t.id)).toEqual(["n", "a", "x", "b", "y", "c"]);
  });

  it("inserts below sibling i (index i+1)", () => {
    const all = [task("a"), task("b"), task("c")];
    const next = insertTaskAmongSiblings(all, ["a", "b", "c"], task("n"), 2);
    expect(next.map((t) => t.id)).toEqual(["a", "b", "n", "c"]);
  });

  it("appends new task when sibling set is empty", () => {
    const all = [task("x")];
    const next = insertTaskAmongSiblings(all, [], task("n"), 0);
    expect(next.map((t) => t.id)).toEqual(["x", "n"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/task-grouping.test.ts -t "insertTaskAmongSiblings"`

Expected: FAIL — `insertTaskAmongSiblings` not exported.

- [ ] **Step 3: Implement helper**

Add to `src/features/tracker/tasks/task-grouping.ts`:

```ts
/**
 * Insert `newTask` into `allTasks` so that among `siblingIdsInOrder` it sits at `insertIndex`.
 * Non-sibling tasks keep their relative positions; the whole sibling block is rewritten in order
 * at the position of the first sibling (or appended if the group is empty).
 */
export const insertTaskAmongSiblings = (
  allTasks: TodayTask[],
  siblingIdsInOrder: string[],
  newTask: TodayTask,
  insertIndex: number,
): TodayTask[] => {
  const siblingSet = new Set(siblingIdsInOrder);
  const nextSiblingIds = [...siblingIdsInOrder];
  const clamped = Math.max(0, Math.min(insertIndex, nextSiblingIds.length));
  nextSiblingIds.splice(clamped, 0, newTask.id);

  const byId = new Map<string, TodayTask>();
  for (const t of allTasks) {
    byId.set(t.id, t);
  }
  byId.set(newTask.id, newTask);

  const result: TodayTask[] = [];
  let siblingsEmitted = false;

  for (const t of allTasks) {
    if (siblingSet.has(t.id)) {
      if (!siblingsEmitted) {
        for (const id of nextSiblingIds) {
          const item = byId.get(id);
          if (item) {
            result.push(item);
          }
        }
        siblingsEmitted = true;
      }
      continue;
    }
    result.push(t);
  }

  if (!siblingsEmitted) {
    for (const id of nextSiblingIds) {
      const item = byId.get(id);
      if (item) {
        result.push(item);
      }
    }
  }

  return result;
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/task-grouping.test.ts -t "insertTaskAmongSiblings"`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/tracker/tasks/task-grouping.ts tests/unit/task-grouping.test.ts
git commit -m "$(cat <<'EOF'
feat(tracker): insertTaskAmongSiblings for ordered task create

EOF
)"
```

---

### Task 2: Context menu UI primitive

**Files:**
- Create: `src/components/ui/context-menu.tsx`

Mirror the styling patterns from `src/components/ui/dropdown-menu.tsx`, but use `@base-ui/react/context-menu`.

- [ ] **Step 1: Create `context-menu.tsx`**

```tsx
"use client";

import * as React from "react";
import { ContextMenu as ContextMenuPrimitive } from "@base-ui/react/context-menu";
import { cn } from "@/lib/utils";

function ContextMenu({ ...props }: ContextMenuPrimitive.Root.Props) {
  return <ContextMenuPrimitive.Root data-slot="context-menu" {...props} />;
}

function ContextMenuTrigger({ ...props }: ContextMenuPrimitive.Trigger.Props) {
  return <ContextMenuPrimitive.Trigger data-slot="context-menu-trigger" {...props} />;
}

function ContextMenuContent({
  className,
  sideOffset = 4,
  ...props
}: ContextMenuPrimitive.Popup.Props &
  Pick<ContextMenuPrimitive.Positioner.Props, "sideOffset">) {
  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Positioner className="isolate z-50 outline-none" sideOffset={sideOffset}>
        <ContextMenuPrimitive.Popup
          data-slot="context-menu-content"
          className={cn(
            "z-50 min-w-40 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            className,
          )}
          {...props}
        />
      </ContextMenuPrimitive.Positioner>
    </ContextMenuPrimitive.Portal>
  );
}

function ContextMenuItem({
  className,
  inset,
  variant = "default",
  ...props
}: ContextMenuPrimitive.Item.Props & {
  inset?: boolean;
  variant?: "default" | "destructive";
}) {
  return (
    <ContextMenuPrimitive.Item
      data-slot="context-menu-item"
      data-inset={inset}
      data-variant={variant}
      className={cn(
        "relative flex cursor-default items-center gap-1.5 rounded-md px-1.5 py-1 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-inset:pl-7 data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    />
  );
}

function ContextMenuSeparator({ className, ...props }: ContextMenuPrimitive.Separator.Props) {
  return (
    <ContextMenuPrimitive.Separator
      data-slot="context-menu-separator"
      className={cn("my-1 h-px bg-border", className)}
      {...props}
    />
  );
}

export {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
};
```

If `ContextMenuPrimitive.Separator` is not exported from the package namespace used above, check `node_modules/@base-ui/react/context-menu/index.parts.d.ts` and either omit separator (use a plain `div` with `role="separator"`) or import the Menu separator part the package re-exports. Prefer matching whatever `dropdown-menu.tsx` uses for separators.

- [ ] **Step 2: Typecheck the new file**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | head -40`  
(or project script `npm run typecheck`)

Expected: no errors from `context-menu.tsx`. Fix import paths / prop types if Base UI typings differ (use the same pattern as `DropdownMenu*` wrappers).

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/context-menu.tsx
git commit -m "$(cat <<'EOF'
feat(ui): add Base UI context-menu wrapper

EOF
)"
```

---

### Task 3: Draft state + leaf Plus + remove permanent add row

**Files:**
- Modify: `src/components/tracker/tasks/tasks-list-view.tsx`

Replace always-on add rows with a single optional draft.

- [ ] **Step 1: Replace add-row state with `TaskDraft`**

Near the top of `tasks-list-view.tsx` (after imports / constants), add:

```ts
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { insertTaskAmongSiblings } from "@/features/tracker/tasks/task-grouping";

type TaskDraft = {
  pathKey: string;
  path: GroupPathSegment[];
  insertIndex: number;
  title: string;
};

const DRAFT_ROW_ID = "__draft__";
```

Remove `addTitles` state and `addRowIdForPath` / `isAddRowId` / `pathKeyFromAddRowId` usage for the permanent bottom rows. Keep a draft row id constant for keyboard nav when draft is open.

In the component:

```ts
const [draft, setDraft] = useState<TaskDraft | null>(null);
const draftInputRef = useRef<HTMLInputElement | null>(null);
const skipDraftBlurCommitRef = useRef(false);
```

Remove `addTitleInputRefs` / `skipAddBlurCommitRef` / `addTitles`.

- [ ] **Step 2: Open / commit / cancel helpers**

```ts
const openDraft = (pathKey: string, path: GroupPathSegment[], insertIndex: number) => {
  setDraft({ pathKey, path, insertIndex, title: "" });
  setActiveCell({ rowId: DRAFT_ROW_ID, field: "title" });
  setFocusRequest({ rowId: DRAFT_ROW_ID, field: "title" });
};

const siblingIdsForPath = (pathKey: string, path: GroupPathSegment[]): string[] => {
  if (pathKey === FLAT_PATH_KEY || path.length === 0) {
    return tasks.map((t) => t.id);
  }
  const node = findLeafNodeByPathKey(groupTree, pathKey);
  return node?.tasks.map((t) => t.id) ?? [];
};

const commitDraft = () => {
  if (!draft) {
    return false;
  }
  const trimmed = draft.title.trim();
  if (!trimmed) {
    setDraft(null);
    setActiveCell(null);
    return false;
  }
  const nextTask =
    draft.pathKey === FLAT_PATH_KEY || draft.path.length === 0
      ? buildCreatedTask(trimmed, spaceId, DEFAULT_DEMO_TASK_STAGE_ID)
      : createFromPath(trimmed, draft.path);
  const siblings = siblingIdsForPath(draft.pathKey, draft.path);
  onTasksChange((prev) => insertTaskAmongSiblings(prev, siblings, nextTask, draft.insertIndex));
  setDraft(null);
  setActiveCell(null);
  return true;
};

const cancelDraft = () => {
  setDraft(null);
  setActiveCell(null);
};
```

Add a small recursive helper in the same file:

```ts
const findLeafNodeByPathKey = (
  nodes: TaskGroupNode[],
  pathKey: string,
): TaskGroupNode | null => {
  for (const node of nodes) {
    if (serializeGroupPath(node.path) === pathKey) {
      return node;
    }
    const nested = findLeafNodeByPathKey(node.children, pathKey);
    if (nested) {
      return nested;
    }
  }
  return null;
};
```

Update focus effect: when `focusRequest.rowId === DRAFT_ROW_ID`, focus `draftInputRef`.

- [ ] **Step 3: Update `collectVisibleRowIds`**

Stop pushing permanent `__new__:` ids. When `draft` is open for a leaf path, insert `DRAFT_ROW_ID` at the correct place among that leaf’s task ids (before task at `insertIndex`, or after last if `insertIndex === tasks.length`). Pass `draft` into the collector (or compute visible ids inside the component after the tree is built).

Example approach inside the component (replace the old collector call):

```ts
const visibleRowIds = useMemo(() => {
  // build from tree / flat, inserting DRAFT_ROW_ID when draft?.pathKey matches
}, [/* deps */]);
```

Prefer a plain function `collectVisibleRowIds(nodes, collapsed, draft)` that inserts the draft id among leaf tasks — React Compiler / existing style in this file uses no `useMemo` by default; a plain recompute each render is fine (matches current file).

- [ ] **Step 4: `renderDraftRow` + remove bottom permanent `renderAddRow` calls**

Implement `renderDraftRow(depth)` similar to the old add row UI, bound to `draft.title` / `setDraft`, Enter → `commitDraft` (empty Enter → `cancelDraft`), Escape → `cancelDraft`, blur → commit or cancel per spec.

In `renderGroupNode`:
- Remove `{node.children.length === 0 ? renderAddRow(...) : null}`.
- When `!collapsed` and leaf (`node.children.length === 0`):
  - Render tasks with draft spliced at `draft.insertIndex` when `draft?.pathKey === pathKey`.
  - On the group header button row, add a Plus button (stopPropagation) that calls `openDraft(pathKey, node.path, 0)` — only when `node.children.length === 0`.

Header Plus UI sketch:

```tsx
<div className="flex w-full items-center gap-2" style={{ paddingLeft: 12 + depth * 16 }}>
  <button type="button" className="..." onClick={() => togglePathCollapsed(pathKey)} ...>
    {/* chevron + label + count */}
  </button>
  {node.children.length === 0 ? (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className="ml-auto size-7 shrink-0"
      aria-label="Add task"
      onClick={(e) => {
        e.stopPropagation();
        openDraft(pathKey, node.path, 0);
      }}
    >
      <Plus className="size-3.5" aria-hidden />
    </Button>
  ) : null}
</div>
```

If `size="icon-sm"` is not a valid Button size in this project, use the closest existing icon button classes from `tasks-toolbar.tsx`.

Flat mode body:

```tsx
{isFlatMode ? (
  <>
    {/* optional top toolbar-less Plus: render a thin control row OR put Plus in the table caption area */}
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={5} className="px-3 py-1">
        <Button type="button" variant="ghost" size="sm" aria-label="Add task" onClick={() => openDraft(FLAT_PATH_KEY, [], 0)}>
          <Plus className="size-3.5" aria-hidden />
          Add task
        </Button>
      </TableCell>
    </TableRow>
    {/* map tasks with draft spliced */}
  </>
) : (
  groupTree.map((node) => renderGroupNode(node, 0))
)}
```

Spec: flat has one Plus that opens draft at top — a compact control row is OK; it is not the permanent dashed input.

- [ ] **Step 5: Wire keyboard moveActiveCell for draft**

Treat `DRAFT_ROW_ID` like the old add-row (title-only). On Tab from draft after successful commit, do **not** re-open draft (spec: close, no special focus). Empty Tab can move to adjacent row if still open.

- [ ] **Step 6: Manual smoke + typecheck**

Run: `npm run typecheck`

Manual: leaf Plus → draft at top → Enter creates at top → draft closes; empty Escape hides; intermediate groups have no Plus.

- [ ] **Step 7: Commit**

```bash
git add src/components/tracker/tasks/tasks-list-view.tsx
git commit -m "$(cat <<'EOF'
feat(tracker): leaf group Plus opens top draft for new tasks

EOF
)"
```

---

### Task 4: Hover separator Plus (no layout shift)

**Files:**
- Modify: `src/components/tracker/tasks/tasks-list-view.tsx`

- [ ] **Step 1: Hover edge state**

```ts
type HoverInsert = { pathKey: string; edgeIndex: number }; // 0..n separators for n tasks
const [hoverInsert, setHoverInsert] = useState<HoverInsert | null>(null);
```

- [ ] **Step 2: Mouse handlers on task row**

On the task `TableRow` (not checklist sub-row), add:

```tsx
className={cn("relative", draggedTaskId === task.id && "opacity-50")}
onMouseMove={(event) => {
  const rect = event.currentTarget.getBoundingClientRect();
  const isUpper = event.clientY < rect.top + rect.height / 2;
  const taskIndex = /* index of task within leaf/flat sibling list */;
  setHoverInsert({
    pathKey,
    edgeIndex: isUpper ? taskIndex : taskIndex + 1,
  });
}}
onMouseLeave={() => {
  setHoverInsert((current) =>
    current?.pathKey === pathKey ? null : current,
  );
}}
```

Pass `taskIndex` into `renderTaskRow(task, path, depth, taskIndex)`.

- [ ] **Step 3: Overlay Plus on the active edge**

Render an absolutely positioned control that does not affect layout. Preferred pattern: on the task row that owns the edge, place a zero-height overlay at the top or bottom border:

```tsx
{hoverInsert?.pathKey === pathKey &&
hoverInsert.edgeIndex === taskIndex /* top edge of this row */ ? (
  <button
    type="button"
    aria-label="Insert task above"
    className="absolute left-1/2 top-0 z-10 flex size-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm hover:text-foreground"
    onClick={(e) => {
      e.stopPropagation();
      openDraft(pathKey, path, taskIndex);
    }}
    onMouseDown={(e) => e.preventDefault()}
  >
    <Plus className="size-3" aria-hidden />
  </button>
) : null}
{hoverInsert?.pathKey === pathKey &&
hoverInsert.edgeIndex === taskIndex + 1 ? (
  <button
    type="button"
    aria-label="Insert task below"
    className="absolute left-1/2 bottom-0 z-10 flex size-5 -translate-x-1/2 translate-y-1/2 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm hover:text-foreground"
    onClick={(e) => {
      e.stopPropagation();
      openDraft(pathKey, path, taskIndex + 1);
    }}
    onMouseDown={(e) => e.preventDefault()}
  >
    <Plus className="size-3" aria-hidden />
  </button>
) : null}
```

Ensure parent `TableRow` / first cell uses `relative` so absolute positioning works. **Do not** add spacer rows or extra padding.

When two adjacent rows could both show the shared separator, show the control once: either only on the lower edge of the upper row, or only on the upper edge of the lower row — pick one rule and stick to it (recommended: show on the edge belonging to the currently hovered row only; `hoverInsert` is a single value so only one button exists).

- [ ] **Step 4: Keep hover button interactive**

Moving onto the overlay may fire `mouseLeave` on the row. Mitigate by:
- wrapping overlay with `onMouseEnter` that keeps the same `hoverInsert`, or
- using a small hit area that stays within the row bounds (`translate` less aggressively), or
- clearing hover only when leaving the leaf task list container.

Verify manually that the Plus stays clickable.

- [ ] **Step 5: Commit**

```bash
git add src/components/tracker/tasks/tasks-list-view.tsx
git commit -m "$(cat <<'EOF'
feat(tracker): overlay hover plus to insert tasks between rows

EOF
)"
```

---

### Task 5: Task row context menu

**Files:**
- Modify: `src/components/tracker/tasks/tasks-list-view.tsx`

- [ ] **Step 1: Wrap task row with ContextMenu**

```tsx
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useRouter } from "next/navigation";
```

Inside `TasksListView`:

```ts
const router = useRouter();
```

Wrap the main task `TableRow` (not the checklist expansion row):

```tsx
<ContextMenu>
  <ContextMenuTrigger
    render={
      <TableRow
        draggable
        /* existing drag + hover handlers */
        className={cn("relative", draggedTaskId === task.id && "opacity-50")}
      />
    }
  >
    {/* cells unchanged */}
  </ContextMenuTrigger>
  <ContextMenuContent>
    <ContextMenuItem
      onClick={() => {
        router.push(`/tracker/tasks/${task.id}`);
      }}
    >
      Open task
    </ContextMenuItem>
    <ContextMenuItem
      onClick={() => updateTask(task.id, { done: !task.done })}
    >
      {task.done ? "Mark as not done" : "Mark as done"}
    </ContextMenuItem>
    <ContextMenuItem
      onClick={() => openDraft(pathKey, path, taskIndex + 1)}
    >
      Add task below
    </ContextMenuItem>
    <ContextMenuSeparator />
    <ContextMenuItem
      variant="destructive"
      onClick={() => onTasksChange((prev) => prev.filter((t) => t.id !== task.id))}
    >
      Delete
    </ContextMenuItem>
  </ContextMenuContent>
</ContextMenu>
```

If Base UI `Trigger` does not support `render={...}` the same way as Menu, wrap with `asChild` / `nativeButton={false}` per the installed typings — match whatever `DropdownMenuTrigger` uses in this repo. Fallback: put `onContextMenu` handlers that open a controlled menu only if the render prop path fails typecheck; prefer the primitive.

Do **not** wrap the checklist expansion `TableRow` in the context menu.

- [ ] **Step 2: Verify interactions**

Manual:
- Right-click task → four actions
- Open navigates
- Done toggles switch state
- Add task below opens draft under row; Enter inserts there
- Delete removes row
- DnD still works (drag handle / row drag should not break)

- [ ] **Step 3: Commit**

```bash
git add src/components/tracker/tasks/tasks-list-view.tsx src/components/ui/context-menu.tsx
git commit -m "$(cat <<'EOF'
feat(tracker): task row context menu with add below and delete

EOF
)"
```

---

### Task 6: Verification

**Files:** none (commands + manual)

- [ ] **Step 1: Automated checks**

```bash
npx vitest run tests/unit/task-grouping.test.ts
npm run typecheck
npm run check:ui-english
```

Expected: all pass. Fix any new Russian/non-English UI strings if the check fails.

- [ ] **Step 2: Acceptance checklist (manual on `/tracker/tasks?view=table`)**

1. No permanent New task input at bottom of leaf/flat.
2. Leaf Plus → draft top → Enter creates at top → draft closes, focus not forced.
3. Intermediate group headers have no Plus.
4. Hover upper/lower half shows overlay `+` without shifting rows; click inserts at that edge.
5. Context menu: Open, Mark done/not done, Add task below, Delete.
6. Grouping collapse, DnD-to-group, inline edit still work.

- [ ] **Step 3: Final commit only if verification produced fixes**

Otherwise no commit.

---

## Spec coverage (self-review)

| Spec requirement | Task |
|------------------|------|
| Remove permanent add row | Task 3 |
| Leaf / flat Plus → draft at top | Task 3 |
| Enter closes draft, no focus move | Task 3 |
| Escape / empty blur cancel | Task 3 |
| Ordered insert / prepend | Task 1 + 3 |
| Hover half → overlay Plus, no layout shift | Task 4 |
| Context menu 4 actions + Add below | Task 5 |
| Intermediate groups no Plus | Task 3 |
| English labels | Task 3–5 + Task 6 check |
| Checklist / calendar out of scope | unchanged |

## Placeholder scan

No TBD / “similar to Task N” gaps remaining after the concrete code blocks above.

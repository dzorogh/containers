# Tracker Tasks Table Stage Grouping — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Spec: `docs/superpowers/specs/2026-08-04-tracker-tasks-table-stage-grouping-design.md`.

**Goal:** Group the tracker tasks table by demo stages (Questions / Tasks) with collapse, per-group quick-add, and HTML5 drag-and-drop to move tasks between stages.

**Architecture:** Add `stageId` to `TodayTask` and seed demo data ~half/half. Keep a single `Table` in `TasksListView`; render stage header rows + task rows + per-stage add rows. Collapse and drag state stay local to the list view; mutations still go through `onTasksChange`.

**Tech Stack:** React client component, existing shadcn `Table` / `Input` / `Checkbox`, lucide chevrons, native HTML5 DnD (same pattern as `calendar-task-item.tsx`). No new DnD library.

---

## File map

| File | Responsibility |
|------|----------------|
| `src/components/home/tasks-today-demo-data.ts` | `stageId` on type; `DEMO_TASK_STAGES`; seed assignment in `createTask` |
| `src/components/tracker/tasks/tasks-list-view.tsx` | Group headers, collapse, per-group add, DnD, Tab over visible rows |
| `app/tracker/tasks/page.tsx` | Toolbar create sets default `stageId: "tasks"` |

---

### Task 1: Demo stage field + seed

**Files:**
- Modify: `src/components/home/tasks-today-demo-data.ts`

- [ ] **Step 1: Add stage types and constants**

After `TaskDateProperty`, add:

```ts
export type DemoTaskStageId = "questions" | "tasks";

export type DemoTaskStage = {
  id: DemoTaskStageId;
  name: string;
  order: number;
};

export const DEMO_TASK_STAGES: DemoTaskStage[] = [
  { id: "questions", name: "Questions", order: 1 },
  { id: "tasks", name: "Tasks", order: 2 },
];

export const DEFAULT_DEMO_TASK_STAGE_ID: DemoTaskStageId = "tasks";
```

Add to `TodayTask`:

```ts
stageId: DemoTaskStageId;
```

- [ ] **Step 2: Thread `stageId` through `createTask`**

Extend `createTask` config with optional `stageId?: DemoTaskStageId`. In the returned object:

```ts
stageId: config.stageId ?? DEFAULT_DEMO_TASK_STAGE_ID,
```

- [ ] **Step 3: Split seed ~half / half**

There are 16 tasks in `ALL_TASKS` (6 in `TODAY_TASKS` + 10 more). Assign explicitly so each stage gets 8:

**Questions** (`stageId: "questions"`): `task-1`, `task-2`, `task-3`, `task-4`, `task-101`, `task-102`, `task-5`, `task-6`

**Tasks** (`stageId: "tasks"`): `task-7`, `task-8`, `task-9`, `task-10`, `task-11`, `task-12`, `task-13`, `task-14`

Pass `stageId` into each `createTask({ ... })` call accordingly.

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`

Expected: errors only where other create sites omit `stageId` (fix those next):

- `src/components/tracker/tasks/tasks-list-view.tsx` → `buildCreatedTask`
- `app/tracker/tasks/page.tsx` → `handleCreateTask`
- Any calendar quick-create that builds a full `TodayTask`

Fix by setting `stageId: DEFAULT_DEMO_TASK_STAGE_ID` (or `"tasks"`) at each create site so typecheck is green before Task 2 UI work. Prefer importing `DEFAULT_DEMO_TASK_STAGE_ID`.

- [ ] **Step 5: Commit**

```bash
git add src/components/home/tasks-today-demo-data.ts \
  src/components/tracker/tasks/tasks-list-view.tsx \
  app/tracker/tasks/page.tsx \
  src/components/tracker/tasks/calendar/tasks-month-calendar.tsx
git commit -m "$(cat <<'EOF'
feat(tracker): add demo stageId to tasks seed data

EOF
)"
```

(Only stage files that actually needed the create-site fix.)

---

### Task 2: Grouped table UI + collapse + per-group add

**Files:**
- Modify: `src/components/tracker/tasks/tasks-list-view.tsx`

- [ ] **Step 1: Imports and helpers**

```ts
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  DEFAULT_DEMO_TASK_STAGE_ID,
  DEMO_TASK_STAGES,
  DEMO_TASK_ASSIGNEES,
  taskAssigneeAvatarUrl,
  type DemoTaskStageId,
  type TaskPriority,
  type TodayTask,
} from "@/components/home/tasks-today-demo-data";
```

Replace single `ADD_ROW_ID` with:

```ts
const addRowIdForStage = (stageId: DemoTaskStageId) => `__new__:${stageId}`;

const isAddRowId = (rowId: string): rowId is `__new__:${DemoTaskStageId}` =>
  rowId.startsWith("__new__:");

const stageIdFromAddRowId = (rowId: string): DemoTaskStageId => {
  const raw = rowId.slice("__new__:".length);
  return raw === "questions" ? "questions" : DEFAULT_DEMO_TASK_STAGE_ID;
};
```

```ts
const resolveTaskStageId = (task: TodayTask): DemoTaskStageId =>
  task.stageId === "questions" ? "questions" : DEFAULT_DEMO_TASK_STAGE_ID;
```

Update `buildCreatedTask`:

```ts
const buildCreatedTask = (
  title: string,
  spaceId: string,
  stageId: DemoTaskStageId,
): TodayTask => {
  // ...existing fields...
  stageId,
};
```

- [ ] **Step 2: Local state for collapse and per-group drafts**

```ts
const [collapsedStageIds, setCollapsedStageIds] = useState<Set<DemoTaskStageId>>(
  () => new Set(),
);
const [addTitles, setAddTitles] = useState<Record<DemoTaskStageId, string>>({
  questions: "",
  tasks: "",
});
```

Remove single `addTitle` / single `addTitleInputRef`. Use a map of refs:

```ts
const addTitleInputRefs = useRef<Partial<Record<DemoTaskStageId, HTMLInputElement | null>>>({});
```

```ts
const toggleStageCollapsed = (stageId: DemoTaskStageId) => {
  setCollapsedStageIds((prev) => {
    const next = new Set(prev);
    if (next.has(stageId)) {
      next.delete(stageId);
    } else {
      next.add(stageId);
    }
    return next;
  });
};
```

- [ ] **Step 3: Group tasks by stage order**

```ts
const tasksByStage = DEMO_TASK_STAGES.map((stage) => ({
  stage,
  tasks: tasks.filter((task) => resolveTaskStageId(task) === stage.id),
}));
```

Visible keyboard row order (expanded groups only):

```ts
const visibleRowIds = tasksByStage.flatMap(({ stage, tasks: stageTasks }) => {
  if (collapsedStageIds.has(stage.id)) {
    return [];
  }
  return [...stageTasks.map((task) => task.id), addRowIdForStage(stage.id)];
});
```

Update `moveActiveCell` to use `visibleRowIds` instead of `[...tasks.map(...), ADD_ROW_ID]`. When hitting an add row, only allow `field: "title"` (same as today).

- [ ] **Step 4: Per-group commit add**

```ts
const commitAddRow = (stageId: DemoTaskStageId) => {
  const trimmed = (addTitles[stageId] ?? "").trim();
  if (!trimmed) {
    return false;
  }
  const nextTask = buildCreatedTask(trimmed, spaceId, stageId);
  onTasksChange((prev) => [...prev, nextTask]);
  setAddTitles((prev) => ({ ...prev, [stageId]: "" }));
  const rowId = addRowIdForStage(stageId);
  setActiveCell({ rowId, field: "title" });
  setFocusRequest({ rowId, field: "title" });
  return true;
};
```

Focus effect: if `focusRequest.rowId` is an add row, resolve stage via `stageIdFromAddRowId` and focus that ref.

Wire add-row key handlers to pass `stageId`.

- [ ] **Step 5: Render grouped body**

Replace flat `{tasks.map(...)}` + single add row with:

```tsx
<TableBody>
  {tasksByStage.map(({ stage, tasks: stageTasks }) => {
    const collapsed = collapsedStageIds.has(stage.id);
    const addRowId = addRowIdForStage(stage.id);

    return (
      <Fragment key={stage.id}>
        <TableRow className="bg-muted/50 hover:bg-muted/50">
          <TableCell colSpan={5} className="px-3 py-2">
            <button
              type="button"
              className="flex w-full items-center gap-2 text-left text-sm font-medium"
              onClick={() => toggleStageCollapsed(stage.id)}
              aria-expanded={!collapsed}
              aria-label={`${collapsed ? "Expand" : "Collapse"} ${stage.name}`}
            >
              {collapsed ? (
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              ) : (
                <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              )}
              <span>{stage.name}</span>
              <span className="text-xs font-normal text-muted-foreground">{stageTasks.length}</span>
            </button>
          </TableCell>
        </TableRow>

        {!collapsed
          ? stageTasks.map((task) => (
              /* existing task row JSX — unchanged columns/editors */
            ))
          : null}

        {!collapsed ? (
          <TableRow className="hover:bg-muted/40">
            {/* same add-row cells as today, but bound to addTitles[stage.id] / commitAddRow(stage.id) */}
          </TableRow>
        ) : null}
      </Fragment>
    );
  })}
</TableBody>
```

Import `Fragment` from React.

Empty stage: header + add row still render when expanded.

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`  
Expected: PASS

- [ ] **Step 7: Manual smoke**

Open `http://localhost:3000/tracker/tasks?scope=space-it&view=table`  
Confirm Questions / Tasks headers, counts, collapse, add in Questions lands under Questions.

- [ ] **Step 8: Commit**

```bash
git add src/components/tracker/tasks/tasks-list-view.tsx
git commit -m "$(cat <<'EOF'
feat(tracker): group tasks table by demo stages

EOF
)"
```

---

### Task 3: Drag-and-drop between stages

**Files:**
- Modify: `src/components/tracker/tasks/tasks-list-view.tsx`

- [ ] **Step 1: Drag state**

```ts
const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
const [dragOverStageId, setDragOverStageId] = useState<DemoTaskStageId | null>(null);
```

```ts
const handleDropToStage = (targetStageId: DemoTaskStageId) => {
  if (!draggedTaskId) {
    return;
  }
  onTasksChange((prev) => {
    const dragged = prev.find((task) => task.id === draggedTaskId);
    if (!dragged || resolveTaskStageId(dragged) === targetStageId) {
      return prev;
    }
    const without = prev.filter((task) => task.id !== draggedTaskId);
    const moved = { ...dragged, stageId: targetStageId };
    // Append after the last task that belongs to target stage (stable relative order of others).
    const lastTargetIndex = without.reduce(
      (acc, task, index) => (resolveTaskStageId(task) === targetStageId ? index : acc),
      -1,
    );
    if (lastTargetIndex === -1) {
      return [...without, moved];
    }
    return [
      ...without.slice(0, lastTargetIndex + 1),
      moved,
      ...without.slice(lastTargetIndex + 1),
    ];
  });
  setDragOverStageId(null);
  setDraggedTaskId(null);
};
```

- [ ] **Step 2: Make task rows draggable**

On each task `TableRow`:

```tsx
<TableRow
  key={task.id}
  draggable
  onDragStart={(event) => {
    event.dataTransfer.setData("text/plain", task.id);
    event.dataTransfer.effectAllowed = "move";
    setDraggedTaskId(task.id);
  }}
  onDragEnd={() => {
    setDraggedTaskId(null);
    setDragOverStageId(null);
  }}
  className={cn(draggedTaskId === task.id && "opacity-50")}
  data-state={selected ? "selected" : undefined}
>
```

Avoid starting drag from interactive controls if needed: on checkbox / inputs / selects, `onDragStart` is fine if the browser only drags from the row chrome; if title button steals drag, set `draggable={false}` on controls (default) and keep row-level drag — match calendar behavior (whole item).

- [ ] **Step 3: Drop targets on header + group body**

On stage header `TableRow` (and optionally wrap expanded body rows’ container via handlers on header + add row + a droppable marker):

```tsx
onDragOver={(event) => {
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
  setDragOverStageId(stage.id);
}}
onDragLeave={() => {
  setDragOverStageId((current) => (current === stage.id ? null : current));
}}
onDrop={(event) => {
  event.preventDefault();
  handleDropToStage(stage.id);
}}
```

Apply the same `onDragOver` / `onDrop` to:

1. Stage header row (works when collapsed)
2. Each task row in the group (so dropping on a sibling still targets that stage)
3. The group’s add row

Highlight when `dragOverStageId === stage.id`:

```ts
className={cn(
  "bg-muted/50 hover:bg-muted/50",
  dragOverStageId === stage.id && "ring-2 ring-inset ring-primary/40",
)}
```

(use the same ring on header; subtle `bg-primary/5` on body rows is optional)

- [ ] **Step 4: Typecheck + manual DnD**

Run: `npm run typecheck`  
Manual:

1. Drag a Questions task onto Tasks header → count updates, task appears under Tasks
2. Drag back onto collapsed Questions header → stage updates, Questions stays collapsed
3. Drop on same stage → no order churn / no-op

- [ ] **Step 5: Commit**

```bash
git add src/components/tracker/tasks/tasks-list-view.tsx
git commit -m "$(cat <<'EOF'
feat(tracker): drag tasks between stage groups in table

EOF
)"
```

---

### Task 4: Toolbar create default stage + verify

**Files:**
- Modify: `app/tracker/tasks/page.tsx` (if not already done in Task 1)

- [ ] **Step 1: Default stage on dialog create**

In `handleCreateTask` object literal:

```ts
import { DEFAULT_DEMO_TASK_STAGE_ID, /* ... */ } from "@/components/home/tasks-today-demo-data";

// inside nextTask:
stageId: DEFAULT_DEMO_TASK_STAGE_ID,
```

Calendar quick-create (if it builds tasks) must also include `stageId: DEFAULT_DEMO_TASK_STAGE_ID`.

- [ ] **Step 2: Full verification**

Run:

```bash
npm run typecheck
npm run check:ui-english
```

Manual checklist on `?scope=space-it&view=table`:

- [ ] Questions and Tasks sections visible with English labels
- [ ] Counts match tasks in each section
- [ ] Collapse / expand works; default both open
- [ ] Add row in Questions creates under Questions
- [ ] Add row in Tasks creates under Tasks
- [ ] DnD between groups updates grouping and counts
- [ ] Drop on collapsed group works
- [ ] Inline edit + Tab still work across visible rows only
- [ ] Calendar view still renders (ungrouped)

- [ ] **Step 3: Commit** (only if page/calendar still dirty)

```bash
git add app/tracker/tasks/page.tsx src/components/tracker/tasks/calendar/tasks-month-calendar.tsx
git commit -m "$(cat <<'EOF'
fix(tracker): set default stageId on toolbar task create

EOF
)"
```

---

## Spec coverage check

| Spec requirement | Task |
|------------------|------|
| `stageId` + demo stages Questions/Tasks | Task 1 |
| Seed ~half/half | Task 1 |
| Single table + header rows + collapse + count | Task 2 |
| Per-group add row inherits `stageId` | Task 2 |
| Tab over visible rows only | Task 2 |
| HTML5 DnD between stages | Task 3 |
| Drop on collapsed header | Task 3 |
| No intra-group reorder | Task 3 (same-stage no-op) |
| Calendar ungrouped | Task 4 verify |
| Toolbar create default stage | Task 4 |
| English labels | Task 2 / Task 4 check |
| Space settings stages untouched | — (no file changes) |

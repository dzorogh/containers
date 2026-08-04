# Tracker Tasks Table Nested Grouping — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Spec: `docs/superpowers/specs/2026-08-04-tracker-tasks-table-nested-grouping-design.md`.

**Goal:** Let users configure 0–5 nested grouping levels for the tracker tasks table (stage, assignee, relative/month/week deadline) via Layout settings, with path-aware New task and drag-and-drop.

**Architecture:** Pure helpers in `src/features/tracker/tasks/task-grouping.ts` build a `TaskGroupNode` tree from `groupingLevels`. Page owns `groupingLevels` state (default `["stage"]`). Layout settings popover edits that array. `TasksListView` recursively renders the tree (collapse, add row per node, DnD applies full path via `applyGroupPathToTask`). Calendar untouched.

**Tech Stack:** React client components, vitest, existing shadcn `Popover` / `Select` / `Button` / `Table`, lucide icons, native HTML5 DnD (same pattern as current stage DnD). No new libraries.

---

## File map

| File | Responsibility |
|------|----------------|
| `src/features/tracker/tasks/task-grouping.ts` | Types, bucket resolution, `groupTasks`, path apply, labels |
| `tests/unit/task-grouping.test.ts` | Unit tests for buckets / tree / path apply |
| `src/components/tracker/tasks/tasks-grouping-settings.tsx` | Layout settings popover (Group by levels) |
| `src/components/tracker/tasks/tasks-toolbar.tsx` | Enable Layout settings; render grouping popover when table |
| `app/tracker/tasks/page.tsx` | `groupingLevels` state; pass to toolbar + list |
| `src/components/tracker/tasks/tasks-list-view.tsx` | Tree render, collapse by path, per-node add, path DnD |
| `src/components/home/tasks-today-demo-data.ts` | Ensure overdue / tomorrow / spread for demo buckets |

---

### Task 1: Core types + stage/assignee buckets (TDD)

**Files:**
- Create: `src/features/tracker/tasks/task-grouping.ts`
- Create: `tests/unit/task-grouping.test.ts`

- [ ] **Step 1: Write failing tests for stage/assignee buckets**

```ts
import { describe, expect, it } from "vitest";
import {
  resolveBucket,
  type TodayTaskLike,
} from "@/features/tracker/tasks/task-grouping";
import { DEMO_REFERENCE_NOW } from "@/components/home/tasks-today-demo-data";

const baseTask = (patch: Partial<TodayTaskLike>): TodayTaskLike => ({
  stageId: "tasks",
  assigneeName: "Anna Petrova",
  deadlineAt: DEMO_REFERENCE_NOW.toISOString(),
  ...patch,
});

describe("resolveBucket stage/assignee", () => {
  it("resolves stage by stageId", () => {
    expect(resolveBucket(baseTask({ stageId: "questions" }), "stage", DEMO_REFERENCE_NOW)).toEqual({
      key: "questions",
      label: "Questions",
    });
    expect(resolveBucket(baseTask({ stageId: "tasks" }), "stage", DEMO_REFERENCE_NOW)).toEqual({
      key: "tasks",
      label: "Tasks",
    });
  });

  it("resolves assignee and Unassigned", () => {
    expect(resolveBucket(baseTask({ assigneeName: "Dmitry Sokolov" }), "assignee", DEMO_REFERENCE_NOW)).toEqual({
      key: "dmitry-sokolov",
      label: "Dmitry Sokolov",
    });
    expect(resolveBucket(baseTask({ assigneeName: "Unassigned" }), "assignee", DEMO_REFERENCE_NOW)).toEqual({
      key: "unassigned",
      label: "Unassigned",
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/task-grouping.test.ts -v`

Expected: FAIL — module or `resolveBucket` not found.

- [ ] **Step 3: Implement types + stage/assignee resolution**

Create `src/features/tracker/tasks/task-grouping.ts`:

```ts
import {
  DEFAULT_DEMO_TASK_STAGE_ID,
  DEMO_TASK_ASSIGNEES,
  DEMO_TASK_STAGES,
  type DemoTaskStageId,
  type TodayTask,
} from "@/components/home/tasks-today-demo-data";
import { formatDeadlineLabel } from "@/components/tracker/tasks/calendar/calendar-utils";

export type TaskGroupBy =
  | "stage"
  | "assignee"
  | "relativeDeadline"
  | "deadlineMonth"
  | "deadlineWeek";

export const TASK_GROUP_BY_OPTIONS: { value: TaskGroupBy; label: string }[] = [
  { value: "stage", label: "Stage" },
  { value: "assignee", label: "Assignee" },
  { value: "relativeDeadline", label: "Relative deadline" },
  { value: "deadlineMonth", label: "Deadline month" },
  { value: "deadlineWeek", label: "Deadline week" },
];

export const DEFAULT_TASK_GROUPING_LEVELS: TaskGroupBy[] = ["stage"];

export type GroupPathSegment = {
  groupBy: TaskGroupBy;
  key: string;
  label: string;
};

export type TaskGroupNode = {
  key: string;
  label: string;
  groupBy: TaskGroupBy;
  path: GroupPathSegment[];
  tasks: TodayTask[];
  children: TaskGroupNode[];
};

/** Minimal fields needed for bucket resolution (tests + TodayTask). */
export type TodayTaskLike = Pick<TodayTask, "stageId" | "assigneeName" | "deadlineAt">;

export type BucketRef = { key: string; label: string };

const DAY_MS = 24 * 60 * 60 * 1000;

const startOfDay = (date: Date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const addDays = (date: Date, offset: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + offset);
  return next;
};

const resolveStageId = (task: TodayTaskLike): DemoTaskStageId =>
  task.stageId === "questions" ? "questions" : DEFAULT_DEMO_TASK_STAGE_ID;

export const resolveBucket = (
  task: TodayTaskLike,
  groupBy: TaskGroupBy,
  now: Date,
): BucketRef => {
  if (groupBy === "stage") {
    const stageId = resolveStageId(task);
    const stage = DEMO_TASK_STAGES.find((item) => item.id === stageId) ?? DEMO_TASK_STAGES[1];
    return { key: stage.id, label: stage.name };
  }

  if (groupBy === "assignee") {
    if (!task.assigneeName || task.assigneeName === "Unassigned") {
      return { key: "unassigned", label: "Unassigned" };
    }
    const assignee = DEMO_TASK_ASSIGNEES.find((item) => item.name === task.assigneeName);
    if (!assignee) {
      return { key: "unassigned", label: "Unassigned" };
    }
    return { key: assignee.id, label: assignee.name };
  }

  // Temporary stubs so file typechecks until Tasks 2–3 fill them in.
  if (groupBy === "relativeDeadline") {
    void now;
    return { key: "no-deadline", label: "No deadline" };
  }
  if (groupBy === "deadlineMonth") {
    return { key: "no-deadline", label: "No deadline" };
  }
  return { key: "no-deadline", label: "No deadline" };
};
```

Keep stubs only until Task 2/3 replace them in the same file (do not leave stubs in the final commit of Task 3).

- [ ] **Step 4: Run tests — stage/assignee pass**

Run: `npx vitest run tests/unit/task-grouping.test.ts -v`

Expected: PASS for stage/assignee describe block.

- [ ] **Step 5: Commit**

```bash
git add src/features/tracker/tasks/task-grouping.ts tests/unit/task-grouping.test.ts
git commit -m "$(cat <<'EOF'
feat(tracker): add task grouping types and stage/assignee buckets

EOF
)"
```

---

### Task 2: Relative deadline buckets (TDD)

**Files:**
- Modify: `src/features/tracker/tasks/task-grouping.ts`
- Modify: `tests/unit/task-grouping.test.ts`

- [ ] **Step 1: Write failing relative-deadline tests**

Use a Wednesday `now` so “This week” has days after tomorrow:

```ts
const WED = new Date("2026-04-15T09:00:00.000Z"); // Wednesday

const atLocalDay = (base: Date, dayOffset: number, hour = 12) => {
  const d = new Date(base);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

describe("resolveBucket relativeDeadline", () => {
  it("classifies overdue, today, tomorrow", () => {
    expect(resolveBucket(baseTask({ deadlineAt: atLocalDay(WED, -1) }), "relativeDeadline", WED).key).toBe("overdue");
    expect(resolveBucket(baseTask({ deadlineAt: atLocalDay(WED, 0) }), "relativeDeadline", WED).key).toBe("today");
    expect(resolveBucket(baseTask({ deadlineAt: atLocalDay(WED, 1) }), "relativeDeadline", WED).key).toBe("tomorrow");
  });

  it("classifies this week, next week, next month, later, no deadline", () => {
    // WED Apr 15 → this week remaining after tomorrow: Apr 17–19 (Fri–Sun) if week Mon–Sun
    expect(resolveBucket(baseTask({ deadlineAt: atLocalDay(WED, 3) }), "relativeDeadline", WED).key).toBe("this-week");
    expect(resolveBucket(baseTask({ deadlineAt: atLocalDay(WED, 8) }), "relativeDeadline", WED).key).toBe("next-week");
    // May 10 is in next calendar month and after next-week window
    expect(resolveBucket(baseTask({ deadlineAt: "2026-05-10T12:00:00.000Z" }), "relativeDeadline", WED).key).toBe("next-month");
    expect(resolveBucket(baseTask({ deadlineAt: "2026-07-01T12:00:00.000Z" }), "relativeDeadline", WED).key).toBe("later");
    expect(resolveBucket(baseTask({ deadlineAt: "" }), "relativeDeadline", WED).key).toBe("no-deadline");
  });
});
```

Adjust day offsets in assertions if local TZ shifts ISO strings — prefer constructing dates with local `setHours` as above so keys stay stable in the developer TZ. If a test flakes on TZ, pin comparisons using the same helpers exported from the module.

- [ ] **Step 2: Run tests — expect FAIL on relative keys**

Run: `npx vitest run tests/unit/task-grouping.test.ts -v`

Expected: FAIL (stub returns `no-deadline`).

- [ ] **Step 3: Implement relative classification**

Replace the relative stub inside `resolveBucket` and add helpers in the same file:

```ts
export type RelativeDeadlineKey =
  | "overdue"
  | "today"
  | "tomorrow"
  | "this-week"
  | "next-week"
  | "next-month"
  | "later"
  | "no-deadline";

const RELATIVE_LABELS: Record<RelativeDeadlineKey, string> = {
  overdue: "Overdue",
  today: "Today",
  tomorrow: "Tomorrow",
  "this-week": "This week",
  "next-week": "Next week",
  "next-month": "Next month",
  later: "Later",
  "no-deadline": "No deadline",
};

/** Monday-start week containing `date`. */
const startOfWeekMonday = (date: Date) => {
  const day = startOfDay(date);
  const weekday = day.getDay(); // 0 Sun … 6 Sat
  const offset = weekday === 0 ? -6 : 1 - weekday;
  return addDays(day, offset);
};

const resolveRelativeDeadlineBucket = (deadlineAt: string, now: Date): BucketRef => {
  if (!deadlineAt) {
    return { key: "no-deadline", label: RELATIVE_LABELS["no-deadline"] };
  }
  const deadlineDay = startOfDay(new Date(deadlineAt));
  if (Number.isNaN(deadlineDay.getTime())) {
    return { key: "no-deadline", label: RELATIVE_LABELS["no-deadline"] };
  }
  const today = startOfDay(now);
  const tomorrow = addDays(today, 1);
  const thisWeekStart = startOfWeekMonday(today);
  const thisWeekEnd = addDays(thisWeekStart, 6); // Sunday
  const nextWeekStart = addDays(thisWeekStart, 7);
  const nextWeekEnd = addDays(nextWeekStart, 6);
  const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const nextMonthEnd = new Date(today.getFullYear(), today.getMonth() + 2, 0); // last day of next month

  if (deadlineDay.getTime() < today.getTime()) {
    return { key: "overdue", label: RELATIVE_LABELS.overdue };
  }
  if (deadlineDay.getTime() === today.getTime()) {
    return { key: "today", label: RELATIVE_LABELS.today };
  }
  if (deadlineDay.getTime() === tomorrow.getTime()) {
    return { key: "tomorrow", label: RELATIVE_LABELS.tomorrow };
  }
  if (deadlineDay.getTime() >= addDays(tomorrow, 1).getTime() && deadlineDay.getTime() <= thisWeekEnd.getTime()) {
    return { key: "this-week", label: RELATIVE_LABELS["this-week"] };
  }
  if (deadlineDay.getTime() >= nextWeekStart.getTime() && deadlineDay.getTime() <= nextWeekEnd.getTime()) {
    return { key: "next-week", label: RELATIVE_LABELS["next-week"] };
  }
  if (deadlineDay.getTime() >= nextMonthStart.getTime() && deadlineDay.getTime() <= startOfDay(nextMonthEnd).getTime()) {
    return { key: "next-month", label: RELATIVE_LABELS["next-month"] };
  }
  // After next week and before next month, or after next month → Later.
  return { key: "later", label: RELATIVE_LABELS.later };
};
```

Wire `groupBy === "relativeDeadline"` to `resolveRelativeDeadlineBucket(task.deadlineAt, now)`.

Gap rule: after next week and before next month start → Later; next calendar month → Next month; after next month → Later.

Update the May test: May 10 with WED=Apr 15 → `next-month`. July → `later`. April 28 → `later` (gap).

- [ ] **Step 4: Run tests — relative PASS**

Run: `npx vitest run tests/unit/task-grouping.test.ts -v`

Expected: PASS. Fix day offsets if local week boundaries differ.

- [ ] **Step 5: Commit**

```bash
git add src/features/tracker/tasks/task-grouping.ts tests/unit/task-grouping.test.ts
git commit -m "$(cat <<'EOF'
feat(tracker): classify relative deadline grouping buckets

EOF
)"
```

---

### Task 3: Month / week buckets (TDD)

**Files:**
- Modify: `src/features/tracker/tasks/task-grouping.ts`
- Modify: `tests/unit/task-grouping.test.ts`

- [ ] **Step 1: Write failing month/week tests**

```ts
describe("resolveBucket deadlineMonth / deadlineWeek", () => {
  it("formats month and no deadline", () => {
    expect(resolveBucket(baseTask({ deadlineAt: "2026-04-19T12:00:00.000Z" }), "deadlineMonth", WED)).toEqual({
      key: "2026-04",
      label: "April 2026",
    });
    expect(resolveBucket(baseTask({ deadlineAt: "" }), "deadlineMonth", WED)).toEqual({
      key: "no-deadline",
      label: "No deadline",
    });
  });

  it("formats ISO week and no deadline", () => {
    // 2026-04-19 is ISO week 16
    const week = resolveBucket(baseTask({ deadlineAt: atLocalDay(WED, 4) }), "deadlineWeek", WED);
    expect(week.label.startsWith("Week ")).toBe(true);
    expect(week.key.startsWith("week-")).toBe(true);
    expect(resolveBucket(baseTask({ deadlineAt: "" }), "deadlineWeek", WED).key).toBe("no-deadline");
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run tests/unit/task-grouping.test.ts -v`

- [ ] **Step 3: Implement month/week**

```ts
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

const isoWeekYearParts = (date: Date): { week: number; weekYear: number } => {
  const d = startOfDay(date);
  // ISO week date algorithm
  const dayNum = d.getDay() || 7;
  d.setDate(d.getDate() + 4 - dayNum);
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7);
  return { week, weekYear: d.getFullYear() };
};

// In resolveBucket:
if (groupBy === "deadlineMonth") {
  if (!task.deadlineAt) {
    return { key: "no-deadline", label: "No deadline" };
  }
  const d = new Date(task.deadlineAt);
  if (Number.isNaN(d.getTime())) {
    return { key: "no-deadline", label: "No deadline" };
  }
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  return { key, label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}` };
}

if (groupBy === "deadlineWeek") {
  if (!task.deadlineAt) {
    return { key: "no-deadline", label: "No deadline" };
  }
  const d = new Date(task.deadlineAt);
  if (Number.isNaN(d.getTime())) {
    return { key: "no-deadline", label: "No deadline" };
  }
  const { week, weekYear } = isoWeekYearParts(d);
  return { key: `week-${weekYear}-${week}`, label: `Week ${week}` };
}
```

Remove remaining stubs.

- [ ] **Step 4: Run — PASS**

Run: `npx vitest run tests/unit/task-grouping.test.ts -v`

- [ ] **Step 5: Commit**

```bash
git add src/features/tracker/tasks/task-grouping.ts tests/unit/task-grouping.test.ts
git commit -m "$(cat <<'EOF'
feat(tracker): add deadline month and week grouping buckets

EOF
)"
```

---

### Task 4: `groupTasks` tree builder (TDD)

**Files:**
- Modify: `src/features/tracker/tasks/task-grouping.ts`
- Modify: `tests/unit/task-grouping.test.ts`

- [ ] **Step 1: Write failing tree tests**

```ts
import { groupTasks, serializeGroupPath } from "@/features/tracker/tasks/task-grouping";
import type { TodayTask } from "@/components/home/tasks-today-demo-data";

const asTask = (patch: Partial<TodayTask> & Pick<TodayTask, "id">): TodayTask =>
  ({
    href: `/tracker/tasks/${patch.id}`,
    title: patch.id,
    projectName: "P",
    priority: "medium",
    comments: 0,
    color: "blue",
    deadlineAt: "",
    deadlineLabel: "No deadline",
    createdAt: WED.toISOString(),
    customDateFields: {},
    assigneeName: "Unassigned",
    assigneeAvatarUrl: "",
    spaceId: "space-it",
    stageId: "tasks",
    done: false,
    checklist: [],
    ...patch,
  }) as TodayTask;

describe("groupTasks", () => {
  it("returns empty array levels as no nodes (caller renders flat)", () => {
    const tasks = [asTask({ id: "a" })];
    expect(groupTasks(tasks, [], WED)).toEqual([]);
  });

  it("groups one level and hides empty buckets", () => {
    const tasks = [
      asTask({ id: "q", stageId: "questions" }),
      asTask({ id: "t", stageId: "tasks" }),
    ];
    const tree = groupTasks(tasks, ["stage"], WED);
    expect(tree.map((n) => n.key)).toEqual(["questions", "tasks"]);
    expect(tree[0].tasks.map((t) => t.id)).toEqual(["q"]);
    expect(tree[0].children).toEqual([]);
  });

  it("nests stage → assignee", () => {
    const tasks = [
      asTask({ id: "1", stageId: "tasks", assigneeName: "Anna Petrova" }),
      asTask({ id: "2", stageId: "tasks", assigneeName: "Dmitry Sokolov" }),
      asTask({ id: "3", stageId: "questions", assigneeName: "Anna Petrova" }),
    ];
    const tree = groupTasks(tasks, ["stage", "assignee"], WED);
    const tasksStage = tree.find((n) => n.key === "tasks");
    expect(tasksStage?.children.map((c) => c.key).sort()).toEqual(["anna-petrova", "dmitry-sokolov"]);
    expect(tasksStage?.tasks).toEqual([]);
    expect(tasksStage?.children.find((c) => c.key === "anna-petrova")?.tasks.map((t) => t.id)).toEqual(["1"]);
  });
});

describe("serializeGroupPath", () => {
  it("joins groupBy:key segments", () => {
    expect(
      serializeGroupPath([
        { groupBy: "stage", key: "tasks", label: "Tasks" },
        { groupBy: "assignee", key: "anna-petrova", label: "Anna Petrova" },
      ]),
    ).toBe("stage:tasks/assignee:anna-petrova");
  });
});
```

- [ ] **Step 2: Run — FAIL**

Run: `npx vitest run tests/unit/task-grouping.test.ts -v`

- [ ] **Step 3: Implement `groupTasks` + `serializeGroupPath`**

```ts
export const serializeGroupPath = (path: GroupPathSegment[]) =>
  path.map((segment) => `${segment.groupBy}:${segment.key}`).join("/");

const bucketSortKey = (groupBy: TaskGroupBy, key: string): string | number => {
  if (groupBy === "stage") {
    return DEMO_TASK_STAGES.find((s) => s.id === key)?.order ?? 99;
  }
  if (groupBy === "relativeDeadline") {
    const order = [
      "overdue",
      "today",
      "tomorrow",
      "this-week",
      "next-week",
      "next-month",
      "later",
      "no-deadline",
    ];
    return order.indexOf(key);
  }
  if (groupBy === "deadlineMonth" || groupBy === "deadlineWeek") {
    return key === "no-deadline" ? "9999-99" : key;
  }
  return key;
};

const buildLevel = (
  tasks: TodayTask[],
  levels: TaskGroupBy[],
  depth: number,
  parentPath: GroupPathSegment[],
  now: Date,
): TaskGroupNode[] => {
  const groupBy = levels[depth];
  if (!groupBy) {
    return [];
  }

  const buckets = new Map<string, { label: string; tasks: TodayTask[] }>();
  for (const task of tasks) {
    const bucket = resolveBucket(task, groupBy, now);
    const entry = buckets.get(bucket.key) ?? { label: bucket.label, tasks: [] };
    entry.tasks.push(task);
    buckets.set(bucket.key, entry);
  }

  const isLeaf = depth === levels.length - 1;
  const nodes: TaskGroupNode[] = [];

  for (const [key, entry] of buckets) {
    const segment: GroupPathSegment = { groupBy, key, label: entry.label };
    const path = [...parentPath, segment];
    const children = isLeaf ? [] : buildLevel(entry.tasks, levels, depth + 1, path, now);
    nodes.push({
      key,
      label: entry.label,
      groupBy,
      path,
      tasks: isLeaf ? entry.tasks : [],
      children,
    });
  }

  nodes.sort((a, b) => {
    const ak = bucketSortKey(groupBy, a.key);
    const bk = bucketSortKey(groupBy, b.key);
    if (ak < bk) return -1;
    if (ak > bk) return 1;
    return a.label.localeCompare(b.label);
  });

  return nodes;
};

export const groupTasks = (
  tasks: TodayTask[],
  levels: TaskGroupBy[],
  now: Date,
): TaskGroupNode[] => {
  if (levels.length === 0) {
    return [];
  }
  return buildLevel(tasks, levels, 0, [], now);
};
```

- [ ] **Step 4: Run — PASS**

Run: `npx vitest run tests/unit/task-grouping.test.ts -v`

- [ ] **Step 5: Commit**

```bash
git add src/features/tracker/tasks/task-grouping.ts tests/unit/task-grouping.test.ts
git commit -m "$(cat <<'EOF'
feat(tracker): build nested task group tree from grouping levels

EOF
)"
```

---

### Task 5: `applyGroupPathToTask` + deadline representatives (TDD)

**Files:**
- Modify: `src/features/tracker/tasks/task-grouping.ts`
- Modify: `tests/unit/task-grouping.test.ts`

- [ ] **Step 1: Write failing path-apply tests**

```ts
import { applyGroupPathToTask } from "@/features/tracker/tasks/task-grouping";

describe("applyGroupPathToTask", () => {
  it("applies stage and assignee", () => {
    const task = asTask({ id: "x", stageId: "questions", assigneeName: "Unassigned" });
    const next = applyGroupPathToTask(
      task,
      [
        { groupBy: "stage", key: "tasks", label: "Tasks" },
        { groupBy: "assignee", key: "anna-petrova", label: "Anna Petrova" },
      ],
      WED,
    );
    expect(next.stageId).toBe("tasks");
    expect(next.assigneeName).toBe("Anna Petrova");
  });

  it("applies relative today and no deadline", () => {
    const task = asTask({ id: "y", deadlineAt: "2026-07-01T15:30:00.000Z" });
    const today = applyGroupPathToTask(
      task,
      [{ groupBy: "relativeDeadline", key: "today", label: "Today" }],
      WED,
    );
    expect(resolveBucket(today, "relativeDeadline", WED).key).toBe("today");
    const none = applyGroupPathToTask(
      task,
      [{ groupBy: "relativeDeadline", key: "no-deadline", label: "No deadline" }],
      WED,
    );
    expect(none.deadlineAt).toBe("");
    expect(none.deadlineLabel).toBe("No deadline");
  });

  it("applies month bucket", () => {
    const task = asTask({ id: "z", deadlineAt: "" });
    const next = applyGroupPathToTask(
      task,
      [{ groupBy: "deadlineMonth", key: "2026-05", label: "May 2026" }],
      WED,
    );
    expect(resolveBucket(next, "deadlineMonth", WED).key).toBe("2026-05");
  });
});
```

- [ ] **Step 2: Run — FAIL**

Run: `npx vitest run tests/unit/task-grouping.test.ts -v`

- [ ] **Step 3: Implement path application**

```ts
import { taskAssigneeAvatarUrl } from "@/components/home/tasks-today-demo-data";

const withPreservedTime = (day: Date, previousIso: string) => {
  const prev = new Date(previousIso);
  const hours = Number.isNaN(prev.getTime()) ? 12 : prev.getHours();
  const minutes = Number.isNaN(prev.getTime()) ? 0 : prev.getMinutes();
  const next = new Date(day);
  next.setHours(hours, minutes, 0, 0);
  return next.toISOString();
};

export const deadlineForRelativeBucket = (
  key: RelativeDeadlineKey,
  now: Date,
  previousIso: string,
): string => {
  if (key === "no-deadline") return "";
  const today = startOfDay(now);
  const thisWeekStart = startOfWeekMonday(today);
  const nextWeekStart = addDays(thisWeekStart, 7);
  const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const laterDay = new Date(today.getFullYear(), today.getMonth() + 2, 15);

  const day =
    key === "overdue"
      ? addDays(today, -1)
      : key === "today"
        ? today
        : key === "tomorrow"
          ? addDays(today, 1)
          : key === "this-week"
            ? addDays(today, 3)
            : key === "next-week"
              ? addDays(nextWeekStart, 2)
              : key === "next-month"
                ? addDays(nextMonthStart, 14)
                : laterDay;

  return withPreservedTime(day, previousIso || now.toISOString());
};

export const deadlineForMonthBucket = (key: string, previousIso: string, now: Date): string => {
  if (key === "no-deadline") return "";
  const [yearStr, monthStr] = key.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (!year || !month) return previousIso;
  const day = new Date(year, month - 1, 15);
  return withPreservedTime(day, previousIso || now.toISOString());
};

export const deadlineForWeekBucket = (key: string, previousIso: string, now: Date): string => {
  if (key === "no-deadline") return "";
  // key: week-{weekYear}-{week}
  const match = /^week-(\d+)-(\d+)$/.exec(key);
  if (!match) return previousIso;
  const weekYear = Number(match[1]);
  const week = Number(match[2]);
  // Approximate: ISO week 1 Monday
  const jan4 = new Date(weekYear, 0, 4);
  const week1Monday = startOfWeekMonday(jan4);
  const monday = addDays(week1Monday, (week - 1) * 7);
  return withPreservedTime(addDays(monday, 2), previousIso || now.toISOString()); // Wednesday of that week
};

export const applyGroupPathToTask = <T extends TodayTask>(
  task: T,
  path: GroupPathSegment[],
  now: Date,
): T => {
  let next: T = { ...task };

  for (const segment of path) {
    if (segment.groupBy === "stage") {
      next = {
        ...next,
        stageId: segment.key === "questions" ? "questions" : DEFAULT_DEMO_TASK_STAGE_ID,
      };
    } else if (segment.groupBy === "assignee") {
      if (segment.key === "unassigned") {
        next = {
          ...next,
          assigneeName: "Unassigned",
          assigneeAvatarUrl: taskAssigneeAvatarUrl(next.id),
        };
      } else {
        const assignee = DEMO_TASK_ASSIGNEES.find((item) => item.id === segment.key);
        next = {
          ...next,
          assigneeName: assignee?.name ?? "Unassigned",
          assigneeAvatarUrl: assignee
            ? `https://i.pravatar.cc/64?u=${assignee.id}`
            : taskAssigneeAvatarUrl(next.id),
        };
      }
    } else if (segment.groupBy === "relativeDeadline") {
      const deadlineAt = deadlineForRelativeBucket(
        segment.key as RelativeDeadlineKey,
        now,
        next.deadlineAt,
      );
      next = {
        ...next,
        deadlineAt,
        deadlineLabel: deadlineAt ? formatDeadlineLabel(deadlineAt, now) : "No deadline",
      };
    } else if (segment.groupBy === "deadlineMonth") {
      const deadlineAt = deadlineForMonthBucket(segment.key, next.deadlineAt, now);
      next = {
        ...next,
        deadlineAt,
        deadlineLabel: deadlineAt ? formatDeadlineLabel(deadlineAt, now) : "No deadline",
      };
    } else if (segment.groupBy === "deadlineWeek") {
      const deadlineAt = deadlineForWeekBucket(segment.key, next.deadlineAt, now);
      next = {
        ...next,
        deadlineAt,
        deadlineLabel: deadlineAt ? formatDeadlineLabel(deadlineAt, now) : "No deadline",
      };
    }
  }

  return next;
};
```

Use the same avatar helper pattern already used in list view (`taskAssigneeAvatarUrl` / pravatar). Prefer importing a shared helper if `taskAssigneeAvatarUrl` already covers assignee ids — match existing list-view assignee update logic when wiring UI in Task 9.

- [ ] **Step 4: Run — PASS**

Run: `npx vitest run tests/unit/task-grouping.test.ts -v`

- [ ] **Step 5: Commit**

```bash
git add src/features/tracker/tasks/task-grouping.ts tests/unit/task-grouping.test.ts
git commit -m "$(cat <<'EOF'
feat(tracker): apply grouping path fields onto tasks

EOF
)"
```

---

### Task 6: Demo seed coverage for deadline buckets

**Files:**
- Modify: `src/components/home/tasks-today-demo-data.ts`

- [ ] **Step 1: Ensure seed hits overdue + tomorrow**

In `ALL_TASKS` / `createTask` calls that already have deadlines, set at least:

- one task with `deadlineOffsetDays: -2` (Overdue)
- one with `deadlineOffsetDays: 1` (Tomorrow)
- keep existing 0 / 7+ / 30+ / 60+ / 120+ so Today, This/Next week, Next month, Later appear under `DEMO_REFERENCE_NOW`

Prefer editing existing Tasks-stage entries rather than adding many new tasks.

- [ ] **Step 2: Smoke-check classification mentally**

With `DEMO_REFERENCE_NOW = 2026-04-19` (Sunday): This week may be empty — OK (hidden). Confirm at least Overdue, Today, Tomorrow, Next week, Next month, Later, No deadline (Questions) exist.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/home/tasks-today-demo-data.ts
git commit -m "$(cat <<'EOF'
feat(tracker): spread demo deadlines across grouping buckets

EOF
)"
```

---

### Task 7: Grouping settings popover UI

**Files:**
- Create: `src/components/tracker/tasks/tasks-grouping-settings.tsx`

- [ ] **Step 1: Implement popover content component**

```tsx
"use client";

import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TASK_GROUP_BY_OPTIONS,
  type TaskGroupBy,
} from "@/features/tracker/tasks/task-grouping";

type TasksGroupingSettingsProps = {
  levels: TaskGroupBy[];
  onLevelsChange: (levels: TaskGroupBy[]) => void;
};

export const TasksGroupingSettings = ({ levels, onLevelsChange }: TasksGroupingSettingsProps) => {
  const used = new Set(levels);

  const updateAt = (index: number, value: TaskGroupBy) => {
    const next = [...levels];
    next[index] = value;
    onLevelsChange(next);
  };

  const removeAt = (index: number) => {
    onLevelsChange(levels.filter((_, i) => i !== index));
  };

  const move = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= levels.length) return;
    const next = [...levels];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    onLevelsChange(next);
  };

  const addLevel = () => {
    const nextValue = TASK_GROUP_BY_OPTIONS.find((opt) => !used.has(opt.value))?.value;
    if (!nextValue || levels.length >= 5) return;
    onLevelsChange([...levels, nextValue]);
  };

  return (
    <div className="flex w-80 flex-col gap-3 p-1">
      <div>
        <p className="text-sm font-medium text-foreground">Group by</p>
        <p className="text-xs text-muted-foreground">0 levels = flat list. Up to 5 nested levels.</p>
      </div>

      <ul className="flex flex-col gap-2">
        {levels.map((level, index) => (
          <li key={`${level}-${index}`} className="flex items-center gap-1.5">
            <div className="flex flex-col">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Move level ${index + 1} up`}
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                <ArrowUp aria-hidden className="size-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Move level ${index + 1} down`}
                disabled={index === levels.length - 1}
                onClick={() => move(index, 1)}
              >
                <ArrowDown aria-hidden className="size-3.5" />
              </Button>
            </div>
            <Select value={level} onValueChange={(value) => updateAt(index, value as TaskGroupBy)}>
              <SelectTrigger className="h-8 flex-1" aria-label={`Grouping level ${index + 1}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TASK_GROUP_BY_OPTIONS.filter(
                  (opt) => opt.value === level || !used.has(opt.value),
                ).map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Remove grouping level ${index + 1}`}
              onClick={() => removeAt(index)}
            >
              <X aria-hidden className="size-3.5" />
            </Button>
          </li>
        ))}
      </ul>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="border-dashed"
        disabled={levels.length >= 5 || used.size >= TASK_GROUP_BY_OPTIONS.length}
        onClick={addLevel}
      >
        <Plus aria-hidden className="size-3.5" />
        Add level
      </Button>
    </div>
  );
};
```

Note: if `Select` `onValueChange` types differ in this codebase (Base UI), match the pattern used in `tasks-list-view.tsx` / space settings (may be `onValueChange={(v) => ...}` with nullable). Fix compile errors accordingly.

- [ ] **Step 2: Typecheck the new file**

Run: `npm run typecheck`

Expected: PASS (or only errors from unused export until wired).

- [ ] **Step 3: Commit**

```bash
git add src/components/tracker/tasks/tasks-grouping-settings.tsx
git commit -m "$(cat <<'EOF'
feat(tracker): add nested grouping settings popover content

EOF
)"
```

---

### Task 8: Wire page state + toolbar Layout settings

**Files:**
- Modify: `src/components/tracker/tasks/tasks-toolbar.tsx`
- Modify: `app/tracker/tasks/page.tsx`

- [ ] **Step 1: Extend toolbar props**

Add:

```ts
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TasksGroupingSettings } from "@/components/tracker/tasks/tasks-grouping-settings";
import type { TaskGroupBy } from "@/features/tracker/tasks/task-grouping";

// props:
groupingLevels: TaskGroupBy[];
onGroupingLevelsChange: (levels: TaskGroupBy[]) => void;
```

Replace the disabled Layout settings button with:

```tsx
{view === "table" ? (
  <Popover>
    <PopoverTrigger
      render={
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Layout settings" />
      }
    >
      <LayoutList aria-hidden className="size-3.5" />
    </PopoverTrigger>
    <PopoverContent align="end" className="w-auto p-2">
      <TasksGroupingSettings levels={groupingLevels} onLevelsChange={onGroupingLevelsChange} />
    </PopoverContent>
  </Popover>
) : (
  <Button type="button" variant="ghost" size="icon-sm" aria-label="Layout settings" disabled>
    <LayoutList aria-hidden className="size-3.5" />
  </Button>
)}
```

Match this repo’s `PopoverTrigger` API (see `pricelist-currency-popover.tsx` / `catalog-category-tree-filter.tsx`) — use the same `render=` or `asChild` pattern already in the project.

- [ ] **Step 2: Own state on the page**

In `TrackerTasksPageContent`:

```ts
import {
  DEFAULT_TASK_GROUPING_LEVELS,
  type TaskGroupBy,
} from "@/features/tracker/tasks/task-grouping";

const [groupingLevels, setGroupingLevels] = useState<TaskGroupBy[]>(DEFAULT_TASK_GROUPING_LEVELS);
```

Pass `groupingLevels` / `onGroupingLevelsChange={setGroupingLevels}` into `TasksToolbar`.

Pass `groupingLevels` into `TasksListView` (prop added in Task 9 — for now add the prop optional or complete Task 9 in the same commit if preferred).

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`

- [ ] **Step 4: Commit**

```bash
git add src/components/tracker/tasks/tasks-toolbar.tsx app/tracker/tasks/page.tsx
git commit -m "$(cat <<'EOF'
feat(tracker): wire layout settings grouping state into tasks toolbar

EOF
)"
```

---

### Task 9: List view — recursive tree, collapse, New task per node

**Files:**
- Modify: `src/components/tracker/tasks/tasks-list-view.tsx`
- Modify: `app/tracker/tasks/page.tsx` (pass `groupingLevels`)

- [ ] **Step 1: Replace hard-coded stage grouping with `groupTasks`**

Add props:

```ts
import {
  applyGroupPathToTask,
  groupTasks,
  serializeGroupPath,
  type GroupPathSegment,
  type TaskGroupBy,
  type TaskGroupNode,
} from "@/features/tracker/tasks/task-grouping";
import { DEMO_REFERENCE_NOW } from "@/components/home/tasks-today-demo-data";

type TasksListViewProps = {
  tasks: TodayTask[];
  onTasksChange: Dispatch<SetStateAction<TodayTask[]>>;
  spaceId: string;
  groupingLevels: TaskGroupBy[];
};
```

Compute:

```ts
const groupTree = groupTasks(tasks, groupingLevels, DEMO_REFERENCE_NOW);
```

Replace `collapsedStageIds` with:

```ts
const [collapsedPathKeys, setCollapsedPathKeys] = useState<Set<string>>(() => new Set());

useEffect(() => {
  setCollapsedPathKeys(new Set());
}, [groupingLevels]);
```

Replace `addTitles` keyed by stage with `Record<string, string>` keyed by `serializeGroupPath(path)` (use `"__flat__"` for the flat add row).

- [ ] **Step 2: Recursive render helper**

Inside the component, render a function `renderGroupNode(node: TaskGroupNode, depth: number)` that outputs:

1. Header `TableRow` (muted bg, chevron, `node.label`, count = leaf tasks or recursive count)
2. If not collapsed:
   - `node.children.map(renderGroupNode)`
   - leaf: existing task rows (extract current row JSX into `renderTaskRow(task)`)
   - add row bound to `serializeGroupPath(node.path)` that creates via:

```ts
const createFromPath = (title: string, path: GroupPathSegment[]) => {
  const base = buildCreatedTask(title, spaceId, DEFAULT_DEMO_TASK_STAGE_ID);
  return applyGroupPathToTask(base, path, DEMO_REFERENCE_NOW);
};
```

Indent header label with `style={{ paddingLeft: 12 + depth * 16 }}` (or `pl-*` classes).

Count helper:

```ts
const countNodeTasks = (node: TaskGroupNode): number =>
  node.tasks.length + node.children.reduce((sum, child) => sum + countNodeTasks(child), 0);
```

- [ ] **Step 3: Flat mode (`groupingLevels.length === 0`)**

Render all `tasks` as rows + one `__flat__` add row using `buildCreatedTask(..., DEFAULT_DEMO_TASK_STAGE_ID)` without path apply (or empty path).

- [ ] **Step 4: Tab / visibleRowIds**

Rebuild `visibleRowIds` by walking the tree: skip collapsed subtrees; include task ids + each visible add-row id (`__new__:${pathKey}`).

Update `isAddRowId` / add-row helpers to use string path keys instead of `DemoTaskStageId`.

- [ ] **Step 5: Manual UI check**

Run: `npm run dev` → `/tracker/tasks?view=table`

- Default still Stage groups
- Layout settings: add Assignee under Stage → nested headers
- New task under a nested group inherits stage+assignee
- Remove all levels → flat list

- [ ] **Step 6: Commit**

```bash
git add src/components/tracker/tasks/tasks-list-view.tsx app/tracker/tasks/page.tsx
git commit -m "$(cat <<'EOF'
feat(tracker): render tasks table from nested grouping tree

EOF
)"
```

---

### Task 10: Path-aware drag-and-drop

**Files:**
- Modify: `src/components/tracker/tasks/tasks-list-view.tsx`

- [ ] **Step 1: Drop target = group path**

Replace `dragOverStageId` with `dragOverPathKey: string | null`.

On group header / group body dragover/drop:

```ts
const handleDropToPath = (path: GroupPathSegment[]) => {
  if (!draggedTaskId) return;
  onTasksChange((prev) => {
    const dragged = prev.find((task) => task.id === draggedTaskId);
    if (!dragged) return prev;
    const moved = applyGroupPathToTask(dragged, path, DEMO_REFERENCE_NOW);
    const without = prev.filter((task) => task.id !== draggedTaskId);
    return [...without, moved];
  });
  setDragOverPathKey(null);
  setDraggedTaskId(null);
};
```

Highlight when `dragOverPathKey === serializeGroupPath(node.path)`.

Keep task row `draggable` as today.

- [ ] **Step 2: Manual check**

- Group by Stage → Assignee
- Drag task into another assignee under same/other stage → both fields update
- Group by Relative deadline → drag into Today → deadline becomes today; into No deadline → cleared

- [ ] **Step 3: Typecheck + unit tests + english**

```bash
npm run typecheck
npx vitest run tests/unit/task-grouping.test.ts -v
npm run check:ui-english
```

Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/tracker/tasks/tasks-list-view.tsx
git commit -m "$(cat <<'EOF'
feat(tracker): apply full grouping path on task drag-and-drop

EOF
)"
```

---

### Task 11: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Run full verification suite**

```bash
npm run lint
npm run typecheck
npm run test
npm run check:ui-english
```

Expected: PASS (or pre-existing failures unrelated — do not expand scope).

- [ ] **Step 2: Manual acceptance against success criteria**

1. 0–5 levels, reorder, remove via Layout settings  
2. Default `["stage"]`  
3. Nested collapse; empty buckets hidden  
4. New task on every group level inherits path  
5. DnD updates all path fields  
6. Calendar unchanged  
7. English labels  

- [ ] **Step 3: Final commit only if leftover fixes**

If fixes were needed, commit them with a focused message; otherwise stop.

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| Table-only nested grouping | 8–10 |
| Layout settings popover | 7–8 |
| Immediate apply, session state, default Stage | 8 |
| 0–5 levels, no duplicate dimensions | 7 |
| Dimensions: stage, assignee, relative, month, week | 1–3 |
| Relative buckets + No deadline / Later | 2 |
| Month/Week + No deadline | 3 |
| Hide empty groups | 4 |
| New task every level + path inherit | 5, 9 |
| DnD updates all path fields | 5, 10 |
| Collapse by path, reset on levels change | 9 |
| Demo seed for buckets | 6 |
| Calendar out of scope | — (no calendar edits) |
| Unit tests for buckets/tree/path | 1–5 |

## Self-review notes

- Relative “gap” days (after next week, before next month) map to **Later** — documented in Task 2; matches exclusive single-bucket need without an extra label.
- Popover uses up/down buttons instead of HTML5 drag for level reorder (same capability, more reliable); still matches “change order” from the product ask.
- `Select` / `PopoverTrigger` API must follow existing Base UI wrappers in-repo when wiring Task 7–8.

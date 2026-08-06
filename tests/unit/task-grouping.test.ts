import { describe, expect, it } from "vitest";
import {
  applyGroupPathToTask,
  groupTasks,
  insertTaskAmongSiblings,
  resolveBucket,
  serializeGroupPath,
  type TodayTaskLike,
} from "@/features/tracker/tasks/task-grouping";
import {
  DEMO_REFERENCE_NOW,
  type TodayTask,
} from "@/components/home/tasks-today-demo-data";

const baseTask = (patch: Partial<TodayTaskLike>): TodayTaskLike => ({
  stageId: "tasks",
  assigneeName: "Anna Petrova",
  deadlineAt: DEMO_REFERENCE_NOW.toISOString(),
  ...patch,
});

const WED = new Date("2026-04-15T09:00:00.000Z"); // Wednesday

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

const atLocalDay = (base: Date, dayOffset: number, hour = 12) => {
  const d = new Date(base);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

describe("resolveBucket stage/assignee", () => {
  it("resolves stage by stageId", () => {
    expect(resolveBucket(baseTask({ stageId: "questions" }), "stage", DEMO_REFERENCE_NOW)).toEqual({
      key: "questions",
      label: "Questions",
    });
    expect(resolveBucket(baseTask({ stageId: "control" }), "stage", DEMO_REFERENCE_NOW)).toEqual({
      key: "control",
      label: "Control",
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

describe("resolveBucket relativeDeadline", () => {
  it("classifies overdue, today, tomorrow", () => {
    expect(resolveBucket(baseTask({ deadlineAt: atLocalDay(WED, -1) }), "relativeDeadline", WED).key).toBe("overdue");
    expect(resolveBucket(baseTask({ deadlineAt: atLocalDay(WED, 0) }), "relativeDeadline", WED).key).toBe("today");
    expect(resolveBucket(baseTask({ deadlineAt: atLocalDay(WED, 1) }), "relativeDeadline", WED).key).toBe("tomorrow");
  });

  it("classifies this week, next week, next month, later, no deadline", () => {
    expect(resolveBucket(baseTask({ deadlineAt: atLocalDay(WED, 3) }), "relativeDeadline", WED).key).toBe("this-week");
    expect(resolveBucket(baseTask({ deadlineAt: atLocalDay(WED, 8) }), "relativeDeadline", WED).key).toBe("next-week");
    expect(resolveBucket(baseTask({ deadlineAt: "2026-05-10T12:00:00.000Z" }), "relativeDeadline", WED).key).toBe("next-month");
    expect(resolveBucket(baseTask({ deadlineAt: "2026-07-01T12:00:00.000Z" }), "relativeDeadline", WED).key).toBe("later");
    expect(resolveBucket(baseTask({ deadlineAt: "" }), "relativeDeadline", WED).key).toBe("no-deadline");
  });

  it("classifies gap days after next week and before next month as later", () => {
    // WED Apr 15 + 13 days = Apr 28 (after next week, before May)
    expect(resolveBucket(baseTask({ deadlineAt: atLocalDay(WED, 13) }), "relativeDeadline", WED)).toEqual({
      key: "later",
      label: "Later",
    });
  });
});

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
    const week = resolveBucket(baseTask({ deadlineAt: atLocalDay(WED, 4) }), "deadlineWeek", WED);
    expect(week.label.startsWith("Week ")).toBe(true);
    expect(week.key.startsWith("week-")).toBe(true);
    expect(resolveBucket(baseTask({ deadlineAt: "" }), "deadlineWeek", WED).key).toBe("no-deadline");
  });
});

describe("groupTasks", () => {
  it("returns empty array levels as no nodes (caller renders flat)", () => {
    const tasks = [asTask({ id: "a" })];
    expect(groupTasks(tasks, [], WED)).toEqual([]);
  });

  it("groups one level and hides empty buckets", () => {
    const tasks = [
      asTask({ id: "q", stageId: "questions" }),
      asTask({ id: "c", stageId: "control" }),
      asTask({ id: "t", stageId: "tasks" }),
    ];
    const tree = groupTasks(tasks, ["stage"], WED);
    expect(tree.map((n) => n.key)).toEqual(["control", "questions", "tasks"]);
    expect(tree[0].tasks.map((t) => t.id)).toEqual(["c"]);
    expect(tree[1].tasks.map((t) => t.id)).toEqual(["q"]);
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

  it("applies control stage", () => {
    const task = asTask({ id: "c", stageId: "tasks" });
    const next = applyGroupPathToTask(
      task,
      [{ groupBy: "stage", key: "control", label: "Control" }],
      WED,
    );
    expect(next.stageId).toBe("control");
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

  it("applies this-week on Wednesday and round-trips", () => {
    const task = asTask({ id: "tw", deadlineAt: "2026-07-01T15:30:00.000Z" });
    const next = applyGroupPathToTask(
      task,
      [{ groupBy: "relativeDeadline", key: "this-week", label: "This week" }],
      WED,
    );
    expect(resolveBucket(next, "relativeDeadline", WED).key).toBe("this-week");
  });

  it("applies a next-best date when Sunday this-week window is empty", () => {
    // Sunday Apr 19: tomorrow === week end → no day after tomorrow in this week.
    // Empty this-week groups stay hidden; path apply still yields a concrete deadline.
    const SUN = new Date("2026-04-19T09:00:00.000Z");
    const task = asTask({ id: "sun-tw", deadlineAt: "2026-07-01T15:30:00.000Z" });
    const next = applyGroupPathToTask(
      task,
      [{ groupBy: "relativeDeadline", key: "this-week", label: "This week" }],
      SUN,
    );
    expect(next.deadlineAt).not.toBe("");
    expect(resolveBucket(next, "relativeDeadline", SUN).key).toBe("next-week");
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

describe("insertTaskAmongSiblings", () => {
  it("inserts at index 0 among siblings and preserves non-siblings", () => {
    const all = [asTask({ id: "a" }), asTask({ id: "x" }), asTask({ id: "b" }), asTask({ id: "y" }), asTask({ id: "c" })];
    const next = insertTaskAmongSiblings(all, ["a", "b", "c"], asTask({ id: "n" }), 0);
    expect(next.map((t) => t.id)).toEqual(["n", "a", "x", "b", "y", "c"]);
  });

  it("inserts below sibling i (index i+1)", () => {
    const all = [asTask({ id: "a" }), asTask({ id: "b" }), asTask({ id: "c" })];
    const next = insertTaskAmongSiblings(all, ["a", "b", "c"], asTask({ id: "n" }), 2);
    expect(next.map((t) => t.id)).toEqual(["a", "b", "n", "c"]);
  });

  it("appends new task when sibling set is empty", () => {
    const all = [asTask({ id: "x" })];
    const next = insertTaskAmongSiblings(all, [], asTask({ id: "n" }), 0);
    expect(next.map((t) => t.id)).toEqual(["x", "n"]);
  });
});

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

const WED = new Date("2026-04-15T09:00:00.000Z"); // Wednesday

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
});

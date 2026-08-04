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

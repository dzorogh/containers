import {
  DEFAULT_DEMO_TASK_STAGE_ID,
  DEMO_TASK_ASSIGNEES,
  DEMO_TASK_STAGES,
  type DemoTaskStageId,
  type TodayTask,
} from "@/components/home/tasks-today-demo-data";

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

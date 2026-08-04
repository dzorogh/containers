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

export type RelativeDeadlineKey =
  | "overdue"
  | "today"
  | "tomorrow"
  | "this-week"
  | "next-week"
  | "next-month"
  | "later"
  | "no-deadline";

const DAY_MS = 24 * 60 * 60 * 1000;

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

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

const startOfDay = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const isoWeekYearParts = (date: Date): { week: number; weekYear: number } => {
  const d = startOfDay(date);
  // ISO week date algorithm
  const dayNum = d.getDay() || 7;
  d.setDate(d.getDate() + 4 - dayNum);
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7);
  return { week, weekYear: d.getFullYear() };
};

const addDays = (date: Date, days: number): Date => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

/** Monday-start calendar week (local time). */
const startOfWeekMonday = (date: Date): Date => {
  const d = startOfDay(date);
  const day = d.getDay(); // 0=Sun … 6=Sat
  const offset = day === 0 ? -6 : 1 - day;
  return addDays(d, offset);
};

const relativeBucket = (key: RelativeDeadlineKey): BucketRef => ({
  key,
  label: RELATIVE_LABELS[key],
});

export const resolveRelativeDeadlineBucket = (
  deadlineAt: string,
  now: Date,
): BucketRef => {
  if (!deadlineAt.trim()) {
    return relativeBucket("no-deadline");
  }

  const deadline = new Date(deadlineAt);
  if (Number.isNaN(deadline.getTime())) {
    return relativeBucket("no-deadline");
  }

  const deadlineDay = startOfDay(deadline);
  const today = startOfDay(now);
  const tomorrow = addDays(today, 1);
  const thisWeekEnd = addDays(startOfWeekMonday(today), 7); // exclusive (next Monday)
  const nextWeekEnd = addDays(thisWeekEnd, 7);
  const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const monthAfterNextStart = new Date(today.getFullYear(), today.getMonth() + 2, 1);

  if (deadlineDay < today) {
    return relativeBucket("overdue");
  }
  if (deadlineDay.getTime() === today.getTime()) {
    return relativeBucket("today");
  }
  if (deadlineDay.getTime() === tomorrow.getTime()) {
    return relativeBucket("tomorrow");
  }
  // After tomorrow through end of current Mon–Sun week
  if (deadlineDay < thisWeekEnd) {
    return relativeBucket("this-week");
  }
  if (deadlineDay < nextWeekEnd) {
    return relativeBucket("next-week");
  }
  if (deadlineDay >= nextMonthStart && deadlineDay < monthAfterNextStart) {
    return relativeBucket("next-month");
  }
  return relativeBucket("later");
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

  if (groupBy === "relativeDeadline") {
    return resolveRelativeDeadlineBucket(task.deadlineAt, now);
  }

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

  return { key: "no-deadline", label: "No deadline" };
};

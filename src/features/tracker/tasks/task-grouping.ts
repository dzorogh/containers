import {
  DEFAULT_DEMO_TASK_STAGE_ID,
  DEMO_TASK_ASSIGNEES,
  DEMO_TASK_STAGES,
  taskAssigneeAvatarUrl,
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

export const DEFAULT_TASK_GROUPING_LEVELS: TaskGroupBy[] = ["stage", "deadlineMonth"];

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

const withPreservedTime = (day: Date, previousIso: string) => {
  const prev = new Date(previousIso);
  const hours = Number.isNaN(prev.getTime()) ? 12 : prev.getHours();
  const minutes = Number.isNaN(prev.getTime()) ? 0 : prev.getMinutes();
  const next = new Date(day);
  next.setHours(hours, minutes, 0, 0);
  return next.toISOString();
};

/** Pick a calendar day that still classifies as `this-week` for `now` (Mon-start week). */
const dayForThisWeekBucket = (today: Date): Date => {
  const tomorrow = addDays(today, 1);
  const thisWeekEndExclusive = addDays(startOfWeekMonday(today), 7);
  // Prefer first day after tomorrow that is still in the current week
  const preferred = addDays(tomorrow, 1);
  if (preferred < thisWeekEndExclusive) {
    return preferred;
  }
  // Empty preferred window (e.g. Sunday when tomorrow === week end): fall back
  const weekLast = addDays(thisWeekEndExclusive, -1);
  if (weekLast > tomorrow) {
    return weekLast;
  }
  // Truly empty — no day after tomorrow maps to this-week; caller groups hide empty buckets.
  // Still return a concrete day for path apply (may not round-trip).
  return preferred;
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
            ? dayForThisWeekBucket(today)
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
            ? taskAssigneeAvatarUrl(assignee.id)
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
  let siblingCursor = 0;

  for (const t of allTasks) {
    if (!siblingSet.has(t.id)) {
      result.push(t);
      continue;
    }
    // Emit any newly inserted siblings before this original sibling.
    while (siblingCursor < nextSiblingIds.length && nextSiblingIds[siblingCursor] !== t.id) {
      const item = byId.get(nextSiblingIds[siblingCursor]);
      if (item) {
        result.push(item);
      }
      siblingCursor += 1;
    }
    if (siblingCursor < nextSiblingIds.length && nextSiblingIds[siblingCursor] === t.id) {
      result.push(t);
      siblingCursor += 1;
    }
  }

  while (siblingCursor < nextSiblingIds.length) {
    const item = byId.get(nextSiblingIds[siblingCursor]);
    if (item) {
      result.push(item);
    }
    siblingCursor += 1;
  }

  return result;
};

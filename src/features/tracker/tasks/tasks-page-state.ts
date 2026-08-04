import {
  isTaskDueOnDemoToday,
  type TodayTask,
} from "@/components/home/tasks-today-demo-data";

export type TasksView = "table" | "calendar";

export type TasksScope =
  | "all"
  | "today"
  | "space-it"
  | "space-management"
  | "space-qa"
  | "space-holding"
  | "space-it-cp"
  | "space-qwe";

export type TasksPageState = {
  scope: TasksScope;
  view: TasksView;
};

export const isSpaceScope = (scope: TasksScope): boolean =>
  scope.startsWith("space-");

export type TrackerSpaceNode = {
  id: TasksScope;
  label: string;
  children?: TrackerSpaceNode[];
};

export const TRACKER_DEMO_SPACES: TrackerSpaceNode[] = [
  {
    id: "space-holding",
    label: "Holding",
    children: [
      { id: "space-management", label: "Management" },
      { id: "space-it", label: "IT" },
      { id: "space-qa", label: "QA" },
    ],
  },
  { id: "space-it-cp", label: "IT CP" },
  { id: "space-qwe", label: "qwe" },
];

const SCOPE_SET = new Set<string>([
  "all",
  "today",
  "space-it",
  "space-management",
  "space-qa",
  "space-holding",
  "space-it-cp",
  "space-qwe",
]);

const isTasksScope = (value: string | null): value is TasksScope =>
  value !== null && SCOPE_SET.has(value);

const isTasksView = (value: string | null): value is TasksView =>
  value === "table" || value === "calendar";

export const parseTasksPageState = (
  searchParams: URLSearchParams | { get: (key: string) => string | null },
): TasksPageState => {
  const rawScope = searchParams.get("scope");
  const rawView = searchParams.get("view");

  return {
    scope: isTasksScope(rawScope) ? rawScope : "all",
    view: isTasksView(rawView) ? rawView : "calendar",
  };
};

export const buildTasksHref = ({
  scope,
  view,
  taskId,
}: {
  scope: TasksScope;
  view: TasksView;
  taskId?: string;
}) => {
  const params = new URLSearchParams();
  params.set("scope", scope);
  params.set("view", view);
  if (taskId) {
    params.set("task", taskId);
  }
  return `/tracker/tasks?${params.toString()}`;
};

const findSpaceLabel = (spaceId: TasksScope): string | null => {
  for (const space of TRACKER_DEMO_SPACES) {
    if (space.id === spaceId) {
      return space.label;
    }
    for (const child of space.children ?? []) {
      if (child.id === spaceId) {
        return child.label;
      }
    }
  }
  return null;
};

export const getScopeTitle = (scope: TasksScope): string => {
  if (scope === "all") {
    return "All Tasks";
  }
  if (scope === "today") {
    return "For Today";
  }
  return findSpaceLabel(scope) ?? "Tasks";
};

export type BreadcrumbSegment = {
  label: string;
  href?: string;
};

export const getBreadcrumbSegments = (scope: TasksScope, view: TasksView): BreadcrumbSegment[] => {
  const segments: BreadcrumbSegment[] = [
    { label: "Tracker", href: "/tracker/tasks" },
  ];

  if (scope === "all" || scope === "today") {
    segments.push({ label: "My Tasks" });
    if (view === "calendar") {
      segments.push({ label: "Calendar" });
    } else if (scope === "today") {
      segments.push({ label: "For Today" });
    } else {
      segments.push({ label: "All Tasks" });
    }
    return segments;
  }

  const parent = TRACKER_DEMO_SPACES.find((space) =>
    space.children?.some((child) => child.id === scope),
  );
  if (parent) {
    segments.push({ label: parent.label });
  }

  const label = findSpaceLabel(scope);
  if (label) {
    segments.push({ label });
  }

  return segments;
};

export const filterTasksByScope = (tasks: TodayTask[], scope: TasksScope): TodayTask[] => {
  if (scope === "all") {
    return tasks;
  }

  if (scope === "today") {
    return tasks.filter(isTaskDueOnDemoToday);
  }

  return tasks.filter((task) => task.spaceId === scope);
};

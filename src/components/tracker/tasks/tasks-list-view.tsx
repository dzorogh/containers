"use client";

import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
  type SetStateAction,
} from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, SquareArrowOutUpRight } from "lucide-react";
import {
  DEFAULT_DEMO_TASK_STAGE_ID,
  DEMO_REFERENCE_NOW,
  DEMO_TASK_ASSIGNEES,
  taskAssigneeAvatarUrl,
  type DemoTaskStageId,
  type TaskPriority,
  type TodayTask,
} from "@/components/home/tasks-today-demo-data";
import { COLOR_CLASS_BY_TASK } from "@/components/tracker/tasks/calendar/calendar-color-map";
import { formatDeadlineLabel } from "@/components/tracker/tasks/calendar/calendar-utils";
import { countChecklist } from "@/components/tracker/tasks/checklist-tree";
import {
  InlineEditableText,
  type InlineEditableTextHandle,
} from "@/components/tracker/tasks/inline-editable-text";
import { TaskChecklist, TREE_STEP_PX } from "@/components/tracker/tasks/task-checklist";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  applyGroupPathToTask,
  groupTasks,
  resolveBucket,
  serializeGroupPath,
  type GroupPathSegment,
  type TaskGroupBy,
  type TaskGroupNode,
} from "@/features/tracker/tasks/task-grouping";
import { cn } from "@/lib/utils";

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

const PRIORITY_OPTIONS: TaskPriority[] = ["high", "medium", "low"];
const PRIORITY_SELECT_ITEMS = PRIORITY_OPTIONS.map((value) => ({
  value,
  label: PRIORITY_LABELS[value],
}));

const ASSIGNEE_UNASSIGNED = "unassigned";
const ASSIGNEE_SELECT_ITEMS = [
  { value: ASSIGNEE_UNASSIGNED, label: "Unassigned" },
  ...DEMO_TASK_ASSIGNEES.map((assignee) => ({ value: assignee.id, label: assignee.name })),
];

const FLAT_PATH_KEY = "__flat__";

const addRowIdForPath = (pathKey: string) => `__new__:${pathKey}`;

const isAddRowId = (rowId: string) => rowId.startsWith("__new__:");

const pathKeyFromAddRowId = (rowId: string) => rowId.slice("__new__:".length);

const countNodeTasks = (node: TaskGroupNode): number =>
  node.tasks.length + node.children.reduce((sum, child) => sum + countNodeTasks(child), 0);

type EditableField = "title" | "priority" | "deadline" | "assignee";

const EDITABLE_FIELDS: EditableField[] = ["title", "priority", "deadline", "assignee"];

type ActiveCell = {
  rowId: string;
  field: EditableField;
};

type TasksListViewProps = {
  tasks: TodayTask[];
  onTasksChange: Dispatch<SetStateAction<TodayTask[]>>;
  spaceId: string;
  groupingLevels: TaskGroupBy[];
};

const toDateInputValue = (isoDate: string) => {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const deadlineFromDateInput = (value: string, previousIso: string) => {
  if (!value) {
    return "";
  }

  const previous = new Date(previousIso);
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    return previousIso;
  }
  const next = new Date(
    year,
    month - 1,
    day,
    Number.isNaN(previous.getTime()) ? 12 : previous.getHours(),
    Number.isNaN(previous.getTime()) ? 0 : previous.getMinutes(),
    0,
    0,
  );
  return next.toISOString();
};

const resolveAssigneeId = (task: TodayTask) => {
  if (task.assigneeName === "Unassigned") {
    return ASSIGNEE_UNASSIGNED;
  }
  return DEMO_TASK_ASSIGNEES.find((item) => item.name === task.assigneeName)?.id ?? ASSIGNEE_UNASSIGNED;
};

const buildCreatedTask = (
  title: string,
  spaceId: string,
  stageId: DemoTaskStageId,
): TodayTask => {
  const taskId = `task-${Date.now()}`;
  const createdAt = new Date().toISOString();
  const hasDeadline = stageId !== "questions";
  const deadlineAt = hasDeadline ? createdAt : "";
  return {
    id: taskId,
    href: `/tracker/tasks/${taskId}`,
    title,
    projectName: "No project",
    priority: "medium",
    comments: 0,
    color: "blue",
    deadlineAt,
    deadlineLabel: hasDeadline ? formatDeadlineLabel(deadlineAt) : "No deadline",
    createdAt,
    customDateFields: { planningDate: deadlineAt },
    assigneeName: "Unassigned",
    assigneeAvatarUrl: taskAssigneeAvatarUrl(taskId),
    spaceId,
    stageId,
    done: false,
    checklist: [],
  };
};

const collectVisibleRowIds = (
  nodes: TaskGroupNode[],
  collapsedPathKeys: Set<string>,
): string[] => {
  const ids: string[] = [];
  for (const node of nodes) {
    const pathKey = serializeGroupPath(node.path);
    if (collapsedPathKeys.has(pathKey)) {
      continue;
    }
    ids.push(...collectVisibleRowIds(node.children, collapsedPathKeys));
    ids.push(...node.tasks.map((task) => task.id));
    ids.push(addRowIdForPath(pathKey));
  }
  return ids;
};

export const TasksListView = ({
  tasks,
  onTasksChange,
  spaceId,
  groupingLevels,
}: TasksListViewProps) => {
  const [activeCell, setActiveCell] = useState<ActiveCell | null>(null);
  const [collapsedPathKeys, setCollapsedPathKeys] = useState<Set<string>>(() => new Set());
  const [addTitles, setAddTitles] = useState<Record<string, string>>({});
  const [focusRequest, setFocusRequest] = useState<ActiveCell | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverPathKey, setDragOverPathKey] = useState<string | null>(null);
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(() => new Set());
  const groupingLevelsKey = groupingLevels.join("|");
  const [collapseResetKey, setCollapseResetKey] = useState(groupingLevelsKey);
  if (collapseResetKey !== groupingLevelsKey) {
    setCollapseResetKey(groupingLevelsKey);
    setCollapsedPathKeys(new Set());
  }

  const toggleTaskExpanded = (taskId: string) => {
    setExpandedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const expandTask = (taskId: string) => {
    setExpandedTaskIds((prev) => {
      if (prev.has(taskId)) {
        return prev;
      }
      const next = new Set(prev);
      next.add(taskId);
      return next;
    });
  };

  const titleEditableRef = useRef<InlineEditableTextHandle | null>(null);
  const addTitleInputRefs = useRef<Partial<Record<string, HTMLInputElement | null>>>({});
  const skipAddBlurCommitRef = useRef(false);

  const groupTree = groupTasks(tasks, groupingLevels, DEMO_REFERENCE_NOW);
  const isFlatMode = groupingLevels.length === 0;

  const visibleRowIds = isFlatMode
    ? [...tasks.map((task) => task.id), addRowIdForPath(FLAT_PATH_KEY)]
    : collectVisibleRowIds(groupTree, collapsedPathKeys);

  const togglePathCollapsed = (pathKey: string) => {
    setCollapsedPathKeys((prev) => {
      const next = new Set(prev);
      if (next.has(pathKey)) {
        next.delete(pathKey);
      } else {
        next.add(pathKey);
      }
      return next;
    });
  };

  const createFromPath = (title: string, path: GroupPathSegment[]) => {
    const base = buildCreatedTask(title, spaceId, DEFAULT_DEMO_TASK_STAGE_ID);
    return applyGroupPathToTask(base, path, DEMO_REFERENCE_NOW);
  };

  const handleDropToPath = (path: GroupPathSegment[]) => {
    if (!draggedTaskId) {
      return;
    }
    onTasksChange((prev) => {
      const dragged = prev.find((task) => task.id === draggedTaskId);
      if (!dragged) {
        return prev;
      }
      const currentPath = groupingLevels.map((groupBy) => {
        const bucket = resolveBucket(dragged, groupBy, DEMO_REFERENCE_NOW);
        return { groupBy, key: bucket.key, label: bucket.label };
      });
      if (serializeGroupPath(currentPath) === serializeGroupPath(path)) {
        return prev;
      }
      const moved = applyGroupPathToTask(dragged, path, DEMO_REFERENCE_NOW);
      const without = prev.filter((task) => task.id !== draggedTaskId);
      return [...without, moved];
    });
    setDragOverPathKey(null);
    setDraggedTaskId(null);
  };

  const pathDropHandlers = (path: GroupPathSegment[], pathKey: string) => ({
    onDragOver: (event: DragEvent) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      setDragOverPathKey((current) => (current === pathKey ? current : pathKey));
    },
    onDrop: (event: DragEvent) => {
      event.preventDefault();
      handleDropToPath(path);
    },
  });

  const updateTask = (taskId: string, patch: Partial<TodayTask>) => {
    onTasksChange((prev) => prev.map((task) => (task.id === taskId ? { ...task, ...patch } : task)));
  };

  const commitExistingTitle = (task: TodayTask, rawValue: string, clearActive = true) => {
    const trimmed = rawValue.trim();
    if (!trimmed) {
      if (clearActive) {
        setActiveCell(null);
      }
      return;
    }
    if (trimmed !== task.title) {
      updateTask(task.id, { title: trimmed });
    }
    if (clearActive) {
      setActiveCell(null);
    }
  };

  const commitAddRow = (pathKey: string, path: GroupPathSegment[]) => {
    const trimmed = (addTitles[pathKey] ?? "").trim();
    if (!trimmed) {
      return false;
    }
    const nextTask =
      pathKey === FLAT_PATH_KEY || path.length === 0
        ? buildCreatedTask(trimmed, spaceId, DEFAULT_DEMO_TASK_STAGE_ID)
        : createFromPath(trimmed, path);
    onTasksChange((prev) => [...prev, nextTask]);
    setAddTitles((prev) => ({ ...prev, [pathKey]: "" }));
    const rowId = addRowIdForPath(pathKey);
    setActiveCell({ rowId, field: "title" });
    setFocusRequest({ rowId, field: "title" });
    return true;
  };

  const moveActiveCell = (rowId: string, field: EditableField, delta: 1 | -1) => {
    const rowIds = visibleRowIds;
    const rowIndex = rowIds.indexOf(rowId);
    const fieldIndex = EDITABLE_FIELDS.indexOf(field);
    if (rowIndex < 0 || fieldIndex < 0) {
      return;
    }

    // Add rows only edit title — step to the adjacent visible row.
    if (isAddRowId(rowId)) {
      const nextRowIndex = rowIndex + delta;
      if (nextRowIndex < 0 || nextRowIndex >= rowIds.length) {
        return;
      }
      const nextRowId = rowIds[nextRowIndex];
      if (isAddRowId(nextRowId)) {
        setActiveCell({ rowId: nextRowId, field: "title" });
        setFocusRequest({ rowId: nextRowId, field: "title" });
        return;
      }
      const nextField = delta === 1 ? EDITABLE_FIELDS[0] : EDITABLE_FIELDS[EDITABLE_FIELDS.length - 1];
      const next: ActiveCell = { rowId: nextRowId, field: nextField };
      setActiveCell(next);
      setFocusRequest(next);
      return;
    }

    let nextFieldIndex = fieldIndex + delta;
    let nextRowIndex = rowIndex;

    if (nextFieldIndex >= EDITABLE_FIELDS.length) {
      nextFieldIndex = 0;
      nextRowIndex += 1;
    } else if (nextFieldIndex < 0) {
      nextFieldIndex = EDITABLE_FIELDS.length - 1;
      nextRowIndex -= 1;
    }

    if (nextRowIndex < 0 || nextRowIndex >= rowIds.length) {
      return;
    }

    const nextRowId = rowIds[nextRowIndex];
    // Landing on an add row: only title is editable — clamp field.
    if (isAddRowId(nextRowId)) {
      setActiveCell({ rowId: nextRowId, field: "title" });
      setFocusRequest({ rowId: nextRowId, field: "title" });
      return;
    }

    const next: ActiveCell = { rowId: nextRowId, field: EDITABLE_FIELDS[nextFieldIndex] };
    setActiveCell(next);
    setFocusRequest(next);
  };

  const beginTitleEdit = (task: TodayTask) => {
    setActiveCell({ rowId: task.id, field: "title" });
    setFocusRequest({ rowId: task.id, field: "title" });
  };

  useEffect(() => {
    if (!focusRequest) {
      return;
    }
    if (focusRequest.field === "title") {
      if (isAddRowId(focusRequest.rowId)) {
        const node = addTitleInputRefs.current[pathKeyFromAddRowId(focusRequest.rowId)];
        node?.focus();
        node?.select();
      }
      // Task title caret/focus is owned by InlineEditableText when `editing` becomes true.
      setFocusRequest(null);
      return;
    }
    const selector = `[data-task-cell="${focusRequest.rowId}:${focusRequest.field}"]`;
    const node = document.querySelector<HTMLElement>(selector);
    node?.focus();
    setFocusRequest(null);
  }, [focusRequest, tasks.length]);

  const handleAddTitleKeyDown = (
    event: KeyboardEvent<HTMLInputElement>,
    pathKey: string,
    path: GroupPathSegment[],
  ) => {
    if (event.key === "Enter") {
      event.preventDefault();
      skipAddBlurCommitRef.current = true;
      commitAddRow(pathKey, path);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setAddTitles((prev) => ({ ...prev, [pathKey]: "" }));
      setActiveCell(null);
      return;
    }
    if (event.key === "Tab") {
      event.preventDefault();
      skipAddBlurCommitRef.current = true;
      const created = commitAddRow(pathKey, path);
      if (!created) {
        moveActiveCell(addRowIdForPath(pathKey), "title", event.shiftKey ? -1 : 1);
      }
    }
  };

  const renderAddRow = (
    path: GroupPathSegment[],
    pathKey: string,
    groupLabel: string,
    depth: number,
  ): ReactNode => {
    const addRowId = addRowIdForPath(pathKey);
    const dropHandlers = path.length > 0 ? pathDropHandlers(path, pathKey) : {};
    return (
      <TableRow key={addRowId} className="hover:bg-muted/40" {...dropHandlers}>
        <TableCell className="px-3 py-2" colSpan={1}>
          <div style={{ paddingLeft: TREE_STEP_PX * 2 + depth * 16 }}>
            <Input
              ref={(node) => {
                addTitleInputRefs.current[pathKey] = node;
              }}
              value={addTitles[pathKey] ?? ""}
              onChange={(event) =>
                setAddTitles((prev) => ({ ...prev, [pathKey]: event.target.value }))
              }
              onFocus={() => setActiveCell({ rowId: addRowId, field: "title" })}
              onBlur={() => {
                if (skipAddBlurCommitRef.current) {
                  skipAddBlurCommitRef.current = false;
                  return;
                }
                commitAddRow(pathKey, path);
              }}
              onKeyDown={(event) => handleAddTitleKeyDown(event, pathKey, path)}
              placeholder="New task"
              aria-label={`New task title in ${groupLabel}`}
              className="h-8 border-dashed"
            />
          </div>
        </TableCell>
        <TableCell className="px-3 py-2" />
        <TableCell className="px-3 py-2 text-xs text-muted-foreground">Medium</TableCell>
        <TableCell className="px-3 py-2 text-xs text-muted-foreground">Today</TableCell>
        <TableCell className="px-3 py-2 text-xs text-muted-foreground">Unassigned</TableCell>
      </TableRow>
    );
  };

  const renderTaskRow = (
    task: TodayTask,
    path: GroupPathSegment[],
    depth: number,
  ): ReactNode => {
    const editingTitle = activeCell?.rowId === task.id && activeCell.field === "title";
    const checklistExpanded = expandedTaskIds.has(task.id);
    const checklistProgress = countChecklist(task.checklist ?? []);
    const TaskExpandIcon = checklistExpanded ? ChevronDown : ChevronRight;
    const pathKey = path.length > 0 ? serializeGroupPath(path) : FLAT_PATH_KEY;
    const dropHandlers = path.length > 0 ? pathDropHandlers(path, pathKey) : {};

    return (
      <Fragment key={task.id}>
        <TableRow
          draggable
          onDragStart={(event) => {
            event.dataTransfer.setData("text/plain", task.id);
            event.dataTransfer.effectAllowed = "move";
            setDraggedTaskId(task.id);
          }}
          onDragEnd={() => {
            setDraggedTaskId(null);
            setDragOverPathKey(null);
          }}
          className={cn(draggedTaskId === task.id && "opacity-50")}
          {...dropHandlers}
        >
          <TableCell className="max-w-0 min-w-[12rem] px-3 py-2">
            <div
              className="flex min-w-0 items-center gap-2"
              style={{ paddingLeft: TREE_STEP_PX + depth * 16 }}
            >
              <button
                type="button"
                className="flex size-5 shrink-0 items-center justify-center text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={(event) => {
                  event.stopPropagation();
                  toggleTaskExpanded(task.id);
                }}
                aria-expanded={checklistExpanded}
                aria-label={checklistExpanded ? "Collapse checklist" : "Expand checklist"}
              >
                <TaskExpandIcon className="size-4" aria-hidden />
              </button>
              <span
                aria-hidden
                className={cn("size-2 shrink-0 rounded-full", COLOR_CLASS_BY_TASK[task.color])}
              />
              <InlineEditableText
                ref={editingTitle ? titleEditableRef : null}
                value={task.title}
                editing={editingTitle}
                onBeginEdit={() => beginTitleEdit(task)}
                onCommit={(next) => commitExistingTitle(task, next)}
                onCancel={() => setActiveCell(null)}
                onKeyDown={(event, draft) => {
                  if (event.key !== "Tab") {
                    return false;
                  }
                  event.preventDefault();
                  titleEditableRef.current?.skipNextBlurCommit();
                  commitExistingTitle(task, draft, false);
                  moveActiveCell(task.id, "title", event.shiftKey ? -1 : 1);
                  return true;
                }}
                aria-label={`Edit title for ${task.title}`}
                className={cn("text-foreground", task.done && "text-muted-foreground line-through")}
              />
              {checklistProgress.total > 0 ? (
                <button
                  type="button"
                  className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground outline-none hover:bg-muted/80 focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={(event) => {
                    event.stopPropagation();
                    expandTask(task.id);
                  }}
                  aria-label={`Checklist progress ${checklistProgress.done} of ${checklistProgress.total}`}
                >
                  {checklistProgress.done}/{checklistProgress.total}
                </button>
              ) : null}
              <Link
                href={`/tracker/tasks/${task.id}`}
                draggable={false}
                className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Open task"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => event.stopPropagation()}
              >
                <SquareArrowOutUpRight className="size-3.5" aria-hidden />
              </Link>
            </div>
          </TableCell>
          <TableCell className="px-3 py-2">
            <Switch
              size="sm"
              checked={task.done}
              onCheckedChange={(checked) => updateTask(task.id, { done: checked })}
              aria-label={
                task.done ? `Mark ${task.title} as not done` : `Mark ${task.title} as done`
              }
              onClick={(event) => event.stopPropagation()}
              onPointerDown={(event) => event.stopPropagation()}
            />
          </TableCell>
          <TableCell className="px-3 py-2">
            <Select
              items={PRIORITY_SELECT_ITEMS}
              value={task.priority}
              onValueChange={(value) => {
                if (!value || !(PRIORITY_OPTIONS as string[]).includes(value)) {
                  return;
                }
                updateTask(task.id, { priority: value as TaskPriority });
              }}
            >
              <SelectTrigger
                size="sm"
                className="w-full max-w-[7.5rem] bg-transparent"
                aria-label={`Priority for ${task.title}`}
                data-task-cell={`${task.id}:priority`}
                onFocus={() => setActiveCell({ rowId: task.id, field: "priority" })}
                onKeyDown={(event) => {
                  if (event.key === "Tab") {
                    event.preventDefault();
                    moveActiveCell(task.id, "priority", event.shiftKey ? -1 : 1);
                  }
                }}
              >
                <SelectValue placeholder={PRIORITY_LABELS[task.priority]} />
              </SelectTrigger>
              <SelectContent align="start">
                <SelectGroup>
                  {PRIORITY_OPTIONS.map((priority) => (
                    <SelectItem key={priority} value={priority}>
                      {PRIORITY_LABELS[priority]}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </TableCell>
          <TableCell className="px-3 py-2">
            <Input
              type="date"
              value={toDateInputValue(task.deadlineAt)}
              aria-label={`Deadline for ${task.title}`}
              className="h-8"
              data-task-cell={`${task.id}:deadline`}
              onFocus={() => setActiveCell({ rowId: task.id, field: "deadline" })}
              onChange={(event) => {
                const nextIso = deadlineFromDateInput(event.target.value, task.deadlineAt);
                updateTask(task.id, {
                  deadlineAt: nextIso,
                  deadlineLabel: nextIso ? formatDeadlineLabel(nextIso) : "No deadline",
                  customDateFields: {
                    ...task.customDateFields,
                    planningDate: nextIso,
                  },
                });
              }}
              onKeyDown={(event) => {
                if (event.key === "Tab") {
                  event.preventDefault();
                  moveActiveCell(task.id, "deadline", event.shiftKey ? -1 : 1);
                }
              }}
            />
          </TableCell>
          <TableCell className="px-3 py-2">
            <Select
              items={ASSIGNEE_SELECT_ITEMS}
              value={resolveAssigneeId(task)}
              onValueChange={(value) => {
                if (!value) {
                  return;
                }
                if (value === ASSIGNEE_UNASSIGNED) {
                  updateTask(task.id, {
                    assigneeName: "Unassigned",
                    assigneeAvatarUrl: taskAssigneeAvatarUrl(task.id),
                  });
                  return;
                }
                const assignee = DEMO_TASK_ASSIGNEES.find((item) => item.id === value);
                if (!assignee) {
                  return;
                }
                updateTask(task.id, {
                  assigneeName: assignee.name,
                  assigneeAvatarUrl: taskAssigneeAvatarUrl(assignee.id),
                });
              }}
            >
              <SelectTrigger
                size="sm"
                className="w-full bg-transparent"
                aria-label={`Assignee for ${task.title}`}
                data-task-cell={`${task.id}:assignee`}
                onFocus={() => setActiveCell({ rowId: task.id, field: "assignee" })}
                onKeyDown={(event) => {
                  if (event.key === "Tab") {
                    event.preventDefault();
                    moveActiveCell(task.id, "assignee", event.shiftKey ? -1 : 1);
                  }
                }}
              >
                <SelectValue placeholder={task.assigneeName} />
              </SelectTrigger>
              <SelectContent align="start">
                <SelectGroup>
                  <SelectItem value={ASSIGNEE_UNASSIGNED}>Unassigned</SelectItem>
                  {DEMO_TASK_ASSIGNEES.map((assignee) => (
                    <SelectItem key={assignee.id} value={assignee.id}>
                      {assignee.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </TableCell>
        </TableRow>
        {checklistExpanded ? (
          <TableRow
            className="border-0 hover:bg-transparent"
            onDragStart={(event) => event.preventDefault()}
          >
            <TableCell colSpan={5} className="p-0">
              <TaskChecklist
                items={task.checklist ?? []}
                onChange={(checklist) => updateTask(task.id, { checklist })}
              />
            </TableCell>
          </TableRow>
        ) : null}
      </Fragment>
    );
  };

  const renderGroupNode = (node: TaskGroupNode, depth: number): ReactNode => {
    const pathKey = serializeGroupPath(node.path);
    const collapsed = collapsedPathKeys.has(pathKey);
    const ChevronIcon = collapsed ? ChevronRight : ChevronDown;
    const dropHandlers = pathDropHandlers(node.path, pathKey);
    const taskCount = countNodeTasks(node);

    return (
      <Fragment key={pathKey}>
        <TableRow
          className={cn(
            "bg-muted/40 hover:bg-muted/50",
            dragOverPathKey === pathKey && "ring-2 ring-inset ring-primary/40",
          )}
          {...dropHandlers}
        >
          <TableCell colSpan={5} className="px-3 py-2">
            <button
              type="button"
              className="flex w-full items-center gap-2 text-left text-sm font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              style={{ paddingLeft: 12 + depth * 16 }}
              onClick={() => togglePathCollapsed(pathKey)}
              aria-expanded={!collapsed}
              aria-label={`${collapsed ? "Expand" : "Collapse"} ${node.label}`}
            >
              <span className="flex size-5 shrink-0 items-center justify-center">
                <ChevronIcon className="size-4 text-muted-foreground" aria-hidden />
              </span>
              <span>{node.label}</span>
              <span className="text-xs font-normal text-muted-foreground">{taskCount}</span>
            </button>
          </TableCell>
        </TableRow>

        {!collapsed ? (
          <>
            {node.children.map((child) => renderGroupNode(child, depth + 1))}
            {node.tasks.map((task) => renderTaskRow(task, node.path, depth))}
            {renderAddRow(node.path, pathKey, node.label, depth)}
          </>
        ) : null}
      </Fragment>
    );
  };

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--corportal-border-grey)] bg-card">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="px-3 text-xs">Title</TableHead>
            <TableHead className="w-16 px-3 text-xs">Done</TableHead>
            <TableHead className="w-28 px-3 text-xs">Priority</TableHead>
            <TableHead className="w-36 px-3 text-xs">Deadline</TableHead>
            <TableHead className="w-44 px-3 text-xs">Assignee</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isFlatMode ? (
            <>
              {tasks.map((task) => renderTaskRow(task, [], 0))}
              {renderAddRow([], FLAT_PATH_KEY, "tasks", 0)}
            </>
          ) : (
            groupTree.map((node) => renderGroupNode(node, 0))
          )}
        </TableBody>
      </Table>
    </div>
  );
};

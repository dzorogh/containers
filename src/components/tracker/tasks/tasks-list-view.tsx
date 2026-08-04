"use client";

import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type DragEvent,
  type KeyboardEvent,
  type SetStateAction,
} from "react";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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

const addRowIdForStage = (stageId: DemoTaskStageId) => `__new__:${stageId}`;

const isAddRowId = (rowId: string): rowId is `__new__:${DemoTaskStageId}` =>
  rowId.startsWith("__new__:");

const stageIdFromAddRowId = (rowId: string): DemoTaskStageId => {
  const raw = rowId.slice("__new__:".length);
  return raw === "questions" ? "questions" : DEFAULT_DEMO_TASK_STAGE_ID;
};

const resolveTaskStageId = (task: TodayTask): DemoTaskStageId =>
  task.stageId === "questions" ? "questions" : DEFAULT_DEMO_TASK_STAGE_ID;

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
  const deadlineAt = new Date().toISOString();
  return {
    id: taskId,
    href: `/tracker/tasks?task=${taskId}`,
    title,
    projectName: "No project",
    priority: "medium",
    comments: 0,
    color: "blue",
    deadlineAt,
    deadlineLabel: formatDeadlineLabel(deadlineAt),
    createdAt: deadlineAt,
    customDateFields: { planningDate: deadlineAt },
    assigneeName: "Unassigned",
    assigneeAvatarUrl: taskAssigneeAvatarUrl(taskId),
    spaceId,
    stageId,
    checklist: [],
  };
};

export const TasksListView = ({ tasks, onTasksChange, spaceId }: TasksListViewProps) => {
  const [activeCell, setActiveCell] = useState<ActiveCell | null>(null);
  const [collapsedStageIds, setCollapsedStageIds] = useState<Set<DemoTaskStageId>>(
    () => new Set(),
  );
  const [addTitles, setAddTitles] = useState<Record<DemoTaskStageId, string>>({
    questions: "",
    tasks: "",
  });
  const [focusRequest, setFocusRequest] = useState<ActiveCell | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<DemoTaskStageId | null>(null);
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(() => new Set());

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
  const addTitleInputRefs = useRef<Partial<Record<DemoTaskStageId, HTMLInputElement | null>>>({});
  const skipAddBlurCommitRef = useRef(false);

  const tasksByStage = DEMO_TASK_STAGES.map((stage) => ({
    stage,
    tasks: tasks.filter((task) => resolveTaskStageId(task) === stage.id),
  }));

  const visibleRowIds = tasksByStage.flatMap(({ stage, tasks: stageTasks }) => {
    if (collapsedStageIds.has(stage.id)) {
      return [];
    }
    return [...stageTasks.map((task) => task.id), addRowIdForStage(stage.id)];
  });

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
        const node = addTitleInputRefs.current[stageIdFromAddRowId(focusRequest.rowId)];
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
    stageId: DemoTaskStageId,
  ) => {
    if (event.key === "Enter") {
      event.preventDefault();
      skipAddBlurCommitRef.current = true;
      commitAddRow(stageId);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setAddTitles((prev) => ({ ...prev, [stageId]: "" }));
      setActiveCell(null);
      return;
    }
    if (event.key === "Tab") {
      event.preventDefault();
      skipAddBlurCommitRef.current = true;
      const created = commitAddRow(stageId);
      if (!created) {
        moveActiveCell(addRowIdForStage(stageId), "title", event.shiftKey ? -1 : 1);
      }
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--corportal-border-grey)] bg-card">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="px-3 text-xs">Title</TableHead>
            <TableHead className="w-28 px-3 text-xs">Priority</TableHead>
            <TableHead className="w-36 px-3 text-xs">Deadline</TableHead>
            <TableHead className="w-44 px-3 text-xs">Assignee</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasksByStage.map(({ stage, tasks: stageTasks }) => {
            const collapsed = collapsedStageIds.has(stage.id);
            const addRowId = addRowIdForStage(stage.id);
            const ChevronIcon = collapsed ? ChevronRight : ChevronDown;
            const stageDropHandlers = {
              onDragOver: (event: DragEvent) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                setDragOverStageId((current) => (current === stage.id ? current : stage.id));
              },
              onDrop: (event: DragEvent) => {
                event.preventDefault();
                handleDropToStage(stage.id);
              },
            };

            return (
              <Fragment key={stage.id}>
                <TableRow
                  className={cn(
                    "bg-muted/40 hover:bg-muted/50",
                    dragOverStageId === stage.id && "ring-2 ring-inset ring-primary/40",
                  )}
                  {...stageDropHandlers}
                >
                  <TableCell colSpan={4} className="px-3 py-2">
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 text-left text-sm font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => toggleStageCollapsed(stage.id)}
                      aria-expanded={!collapsed}
                      aria-label={`${collapsed ? "Expand" : "Collapse"} ${stage.name}`}
                    >
                      <span className="flex size-5 shrink-0 items-center justify-center">
                        <ChevronIcon className="size-4 text-muted-foreground" aria-hidden />
                      </span>
                      <span>{stage.name}</span>
                      <span className="text-xs font-normal text-muted-foreground">
                        {stageTasks.length}
                      </span>
                    </button>
                  </TableCell>
                </TableRow>

                {!collapsed &&
                  stageTasks.map((task) => {
                    const editingTitle = activeCell?.rowId === task.id && activeCell.field === "title";
                    const checklistExpanded = expandedTaskIds.has(task.id);
                    const checklistProgress = countChecklist(task.checklist ?? []);
                    const TaskExpandIcon = checklistExpanded ? ChevronDown : ChevronRight;

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
                            setDragOverStageId(null);
                          }}
                          className={cn(draggedTaskId === task.id && "opacity-50")}
                          {...stageDropHandlers}
                        >
                          <TableCell className="max-w-0 min-w-[12rem] px-3 py-2">
                            <div
                              className="flex min-w-0 items-center gap-2"
                              style={{ paddingLeft: TREE_STEP_PX }}
                            >
                              <button
                                type="button"
                                className="flex size-5 shrink-0 items-center justify-center text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  toggleTaskExpanded(task.id);
                                }}
                                aria-expanded={checklistExpanded}
                                aria-label={
                                  checklistExpanded ? "Collapse checklist" : "Expand checklist"
                                }
                              >
                                <TaskExpandIcon className="size-4" aria-hidden />
                              </button>
                              <span
                                aria-hidden
                                className={cn(
                                  "size-2 shrink-0 rounded-full",
                                  COLOR_CLASS_BY_TASK[task.color],
                                )}
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
                                className="text-foreground"
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
                            </div>
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
                                const nextIso = deadlineFromDateInput(
                                  event.target.value,
                                  task.deadlineAt,
                                );
                                updateTask(task.id, {
                                  deadlineAt: nextIso,
                                  deadlineLabel: formatDeadlineLabel(nextIso),
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
                            <TableCell colSpan={4} className="p-0">
                              <TaskChecklist
                                items={task.checklist ?? []}
                                onChange={(checklist) => updateTask(task.id, { checklist })}
                              />
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </Fragment>
                    );
                  })}

                {!collapsed && (
                  <TableRow className="hover:bg-muted/40" {...stageDropHandlers}>
                    <TableCell className="px-3 py-2" colSpan={1}>
                      <div style={{ paddingLeft: TREE_STEP_PX * 2 }}>
                        <Input
                          ref={(node) => {
                            addTitleInputRefs.current[stage.id] = node;
                          }}
                          value={addTitles[stage.id]}
                          onChange={(event) =>
                            setAddTitles((prev) => ({ ...prev, [stage.id]: event.target.value }))
                          }
                          onFocus={() => setActiveCell({ rowId: addRowId, field: "title" })}
                          onBlur={() => {
                            if (skipAddBlurCommitRef.current) {
                              skipAddBlurCommitRef.current = false;
                              return;
                            }
                            commitAddRow(stage.id);
                          }}
                          onKeyDown={(event) => handleAddTitleKeyDown(event, stage.id)}
                          placeholder="New task"
                          aria-label={`New task title in ${stage.name}`}
                          className="h-8 border-dashed"
                        />
                      </div>
                    </TableCell>
                    <TableCell className="px-3 py-2 text-xs text-muted-foreground">Medium</TableCell>
                    <TableCell className="px-3 py-2 text-xs text-muted-foreground">Today</TableCell>
                    <TableCell className="px-3 py-2 text-xs text-muted-foreground">Unassigned</TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};

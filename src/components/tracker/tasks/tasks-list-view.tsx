"use client";

import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type KeyboardEvent,
  type SetStateAction,
} from "react";
import {
  DEMO_TASK_ASSIGNEES,
  DEFAULT_DEMO_TASK_STAGE_ID,
  taskAssigneeAvatarUrl,
  type TaskPriority,
  type TodayTask,
} from "@/components/home/tasks-today-demo-data";
import { COLOR_CLASS_BY_TASK } from "@/components/tracker/tasks/calendar/calendar-color-map";
import { formatDeadlineLabel } from "@/components/tracker/tasks/calendar/calendar-utils";
import { Checkbox } from "@/components/ui/checkbox";
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

const ADD_ROW_ID = "__new__";

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

const buildCreatedTask = (title: string, spaceId: string): TodayTask => {
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
    stageId: DEFAULT_DEMO_TASK_STAGE_ID,
  };
};

export const TasksListView = ({ tasks, onTasksChange, spaceId }: TasksListViewProps) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeCell, setActiveCell] = useState<ActiveCell | null>(null);
  const [titleDraft, setTitleDraft] = useState("");
  const [addTitle, setAddTitle] = useState("");
  const [focusRequest, setFocusRequest] = useState<ActiveCell | null>(null);

  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const addTitleInputRef = useRef<HTMLInputElement | null>(null);
  const skipAddBlurCommitRef = useRef(false);
  const skipTitleBlurCommitRef = useRef(false);

  const toggleSelected = (taskId: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(taskId);
      } else {
        next.delete(taskId);
      }
      return next;
    });
  };

  const updateTask = (taskId: string, patch: Partial<TodayTask>) => {
    onTasksChange((prev) => prev.map((task) => (task.id === taskId ? { ...task, ...patch } : task)));
  };

  const commitExistingTitle = (task: TodayTask, rawValue: string, clearActive = true) => {
    const trimmed = rawValue.trim();
    if (!trimmed) {
      setTitleDraft(task.title);
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

  const commitAddRow = () => {
    const trimmed = addTitle.trim();
    if (!trimmed) {
      return false;
    }
    const nextTask = buildCreatedTask(trimmed, spaceId);
    onTasksChange((prev) => [...prev, nextTask]);
    setAddTitle("");
    setActiveCell({ rowId: ADD_ROW_ID, field: "title" });
    setFocusRequest({ rowId: ADD_ROW_ID, field: "title" });
    return true;
  };

  const moveActiveCell = (rowId: string, field: EditableField, delta: 1 | -1) => {
    const rowIds = [...tasks.map((task) => task.id), ADD_ROW_ID];
    const rowIndex = rowIds.indexOf(rowId);
    const fieldIndex = EDITABLE_FIELDS.indexOf(field);
    if (rowIndex < 0 || fieldIndex < 0) {
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
    // Add row only edits title; skip other fields.
    if (nextRowId === ADD_ROW_ID && EDITABLE_FIELDS[nextFieldIndex] !== "title") {
      if (delta === 1) {
        setActiveCell({ rowId: ADD_ROW_ID, field: "title" });
        setFocusRequest({ rowId: ADD_ROW_ID, field: "title" });
      } else {
        const previousTaskId = rowIds[nextRowIndex - 1];
        if (!previousTaskId || previousTaskId === ADD_ROW_ID) {
          return;
        }
        setActiveCell({ rowId: previousTaskId, field: "assignee" });
        setFocusRequest({ rowId: previousTaskId, field: "assignee" });
      }
      return;
    }

    const next: ActiveCell = { rowId: nextRowId, field: EDITABLE_FIELDS[nextFieldIndex] };
    if (next.field === "title" && next.rowId !== ADD_ROW_ID) {
      const task = tasks.find((item) => item.id === next.rowId);
      setTitleDraft(task?.title ?? "");
    }
    setActiveCell(next);
    setFocusRequest(next);
  };

  const beginTitleEdit = (task: TodayTask) => {
    setTitleDraft(task.title);
    setActiveCell({ rowId: task.id, field: "title" });
    setFocusRequest({ rowId: task.id, field: "title" });
  };

  useEffect(() => {
    if (!focusRequest) {
      return;
    }
    if (focusRequest.field === "title") {
      const node = focusRequest.rowId === ADD_ROW_ID ? addTitleInputRef.current : titleInputRef.current;
      node?.focus();
      node?.select();
      setFocusRequest(null);
      return;
    }
    const selector = `[data-task-cell="${focusRequest.rowId}:${focusRequest.field}"]`;
    const node = document.querySelector<HTMLElement>(selector);
    node?.focus();
    setFocusRequest(null);
  }, [focusRequest, tasks.length]);

  const handleTitleKeyDown = (event: KeyboardEvent<HTMLInputElement>, task: TodayTask) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitExistingTitle(task, titleDraft);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setTitleDraft(task.title);
      setActiveCell(null);
      return;
    }
    if (event.key === "Tab") {
      event.preventDefault();
      skipTitleBlurCommitRef.current = true;
      commitExistingTitle(task, titleDraft, false);
      moveActiveCell(task.id, "title", event.shiftKey ? -1 : 1);
    }
  };

  const handleAddTitleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      skipAddBlurCommitRef.current = true;
      commitAddRow();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setAddTitle("");
      setActiveCell(null);
      return;
    }
    if (event.key === "Tab") {
      event.preventDefault();
      skipAddBlurCommitRef.current = true;
      const created = commitAddRow();
      if (!created && !event.shiftKey) {
        return;
      }
      if (!created && event.shiftKey) {
        const lastTask = tasks[tasks.length - 1];
        if (lastTask) {
          setActiveCell({ rowId: lastTask.id, field: "assignee" });
          setFocusRequest({ rowId: lastTask.id, field: "assignee" });
        }
      }
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--corportal-border-grey)] bg-card">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-10 px-3" />
            <TableHead className="px-3 text-xs">Title</TableHead>
            <TableHead className="w-28 px-3 text-xs">Priority</TableHead>
            <TableHead className="w-36 px-3 text-xs">Deadline</TableHead>
            <TableHead className="w-44 px-3 text-xs">Assignee</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => {
            const selected = selectedIds.has(task.id);
            const editingTitle = activeCell?.rowId === task.id && activeCell.field === "title";

            return (
              <TableRow key={task.id} data-state={selected ? "selected" : undefined}>
                <TableCell className="px-3 py-2">
                  <Checkbox
                    checked={selected}
                    onCheckedChange={(value) => toggleSelected(task.id, value === true)}
                    aria-label={`Select task ${task.title}`}
                  />
                </TableCell>
                <TableCell className="max-w-0 min-w-[12rem] px-3 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      aria-hidden
                      className={cn("size-2 shrink-0 rounded-full", COLOR_CLASS_BY_TASK[task.color])}
                    />
                    {editingTitle ? (
                      <Input
                        ref={titleInputRef}
                        value={titleDraft}
                        onChange={(event) => setTitleDraft(event.target.value)}
                        onBlur={() => {
                          if (skipTitleBlurCommitRef.current) {
                            skipTitleBlurCommitRef.current = false;
                            return;
                          }
                          commitExistingTitle(task, titleDraft);
                        }}
                        onKeyDown={(event) => handleTitleKeyDown(event, task)}
                        aria-label={`Edit title for ${task.title}`}
                        className="h-8"
                      />
                    ) : (
                      <button
                        type="button"
                        className="min-w-0 truncate text-left text-sm font-medium text-foreground outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() => beginTitleEdit(task)}
                      >
                        {task.title}
                      </button>
                    )}
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
                      const nextIso = deadlineFromDateInput(event.target.value, task.deadlineAt);
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
            );
          })}

          <TableRow className="hover:bg-muted/40">
            <TableCell className="px-3 py-2" />
            <TableCell className="px-3 py-2" colSpan={1}>
              <Input
                ref={addTitleInputRef}
                value={addTitle}
                onChange={(event) => setAddTitle(event.target.value)}
                onFocus={() => setActiveCell({ rowId: ADD_ROW_ID, field: "title" })}
                onBlur={() => {
                  if (skipAddBlurCommitRef.current) {
                    skipAddBlurCommitRef.current = false;
                    return;
                  }
                  commitAddRow();
                }}
                onKeyDown={handleAddTitleKeyDown}
                placeholder="New task"
                aria-label="New task title"
                className="h-8 border-dashed"
              />
            </TableCell>
            <TableCell className="px-3 py-2 text-xs text-muted-foreground">Medium</TableCell>
            <TableCell className="px-3 py-2 text-xs text-muted-foreground">Today</TableCell>
            <TableCell className="px-3 py-2 text-xs text-muted-foreground">Unassigned</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
};

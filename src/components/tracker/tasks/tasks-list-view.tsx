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
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Plus, SquareArrowOutUpRight } from "lucide-react";
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
import {
  countChecklist,
  extractChecklistSubtree,
  insertChecklistSubtree,
  moveChecklistItem,
  type ChecklistDropPosition,
} from "@/components/tracker/tasks/checklist-tree";
import {
  InlineEditableText,
  type InlineEditableTextHandle,
} from "@/components/tracker/tasks/inline-editable-text";
import {
  CHECKLIST_DND_MIME,
  TaskChecklist,
  TREE_STEP_PX,
} from "@/components/tracker/tasks/task-checklist";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
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
  insertTaskAmongSiblings,
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
const DRAFT_ROW_ID = "__draft__";

const countNodeTasks = (node: TaskGroupNode): number =>
  node.tasks.length + node.children.reduce((sum, child) => sum + countNodeTasks(child), 0);

const findLeafNodeByPathKey = (
  nodes: TaskGroupNode[],
  pathKey: string,
): TaskGroupNode | null => {
  for (const node of nodes) {
    if (serializeGroupPath(node.path) === pathKey) {
      return node;
    }
    const nested = findLeafNodeByPathKey(node.children, pathKey);
    if (nested) {
      return nested;
    }
  }
  return null;
};

type EditableField = "title" | "priority" | "deadline" | "assignee";

const EDITABLE_FIELDS: EditableField[] = ["title", "priority", "deadline", "assignee"];

type ActiveCell = {
  rowId: string;
  field: EditableField;
};

type TaskDraft = {
  pathKey: string;
  path: GroupPathSegment[];
  insertIndex: number;
  title: string;
};

type HoverInsert = {
  pathKey: string;
  edgeIndex: number;
};

type ChecklistDragState = {
  sourceTaskId: string;
  itemId: string;
};

type ChecklistTaskDrop = {
  taskId: string;
  position: "before" | "after" | "into";
};

const moveChecklistAcrossTasks = (
  prev: TodayTask[],
  sourceTaskId: string,
  itemId: string,
  targetTaskId: string,
  targetItemId: string | null,
  position: ChecklistDropPosition,
): TodayTask[] => {
  const source = prev.find((task) => task.id === sourceTaskId);
  const target = prev.find((task) => task.id === targetTaskId);
  if (!source || !target) {
    return prev;
  }

  if (sourceTaskId === targetTaskId) {
    if (targetItemId === null) {
      const { next, node } = extractChecklistSubtree(source.checklist ?? [], itemId);
      if (!node) {
        return prev;
      }
      return prev.map((task) =>
        task.id === sourceTaskId
          ? { ...task, checklist: insertChecklistSubtree(next, node, null, "into") }
          : task,
      );
    }
    return prev.map((task) =>
      task.id === sourceTaskId
        ? {
            ...task,
            checklist: moveChecklistItem(task.checklist ?? [], itemId, targetItemId, position),
          }
        : task,
    );
  }

  const { next: sourceNext, node } = extractChecklistSubtree(source.checklist ?? [], itemId);
  if (!node) {
    return prev;
  }
  const targetNext = insertChecklistSubtree(
    target.checklist ?? [],
    node,
    targetItemId,
    targetItemId === null ? "into" : position,
  );
  return prev.map((task) => {
    if (task.id === sourceTaskId) {
      return { ...task, checklist: sourceNext };
    }
    if (task.id === targetTaskId) {
      return { ...task, checklist: targetNext };
    }
    return task;
  });
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
  draft: TaskDraft | null,
): string[] => {
  const ids: string[] = [];
  for (const node of nodes) {
    const pathKey = serializeGroupPath(node.path);
    if (collapsedPathKeys.has(pathKey)) {
      continue;
    }
    ids.push(...collectVisibleRowIds(node.children, collapsedPathKeys, draft));
    if (node.children.length === 0) {
      node.tasks.forEach((task, index) => {
        if (draft?.pathKey === pathKey && draft.insertIndex === index) {
          ids.push(DRAFT_ROW_ID);
        }
        ids.push(task.id);
      });
      if (draft?.pathKey === pathKey && draft.insertIndex >= node.tasks.length) {
        ids.push(DRAFT_ROW_ID);
      }
    }
  }
  return ids;
};

const collectFlatVisibleRowIds = (tasks: TodayTask[], draft: TaskDraft | null): string[] => {
  const ids: string[] = [];
  tasks.forEach((task, index) => {
    if (draft?.pathKey === FLAT_PATH_KEY && draft.insertIndex === index) {
      ids.push(DRAFT_ROW_ID);
    }
    ids.push(task.id);
  });
  if (draft?.pathKey === FLAT_PATH_KEY && draft.insertIndex >= tasks.length) {
    ids.push(DRAFT_ROW_ID);
  }
  return ids;
};

export const TasksListView = ({
  tasks,
  onTasksChange,
  spaceId,
  groupingLevels,
}: TasksListViewProps) => {
  const router = useRouter();
  const [activeCell, setActiveCell] = useState<ActiveCell | null>(null);
  const [collapsedPathKeys, setCollapsedPathKeys] = useState<Set<string>>(() => new Set());
  const [draft, setDraft] = useState<TaskDraft | null>(null);
  const [focusRequest, setFocusRequest] = useState<ActiveCell | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverPathKey, setDragOverPathKey] = useState<string | null>(null);
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(() => new Set());
  const [hoverInsert, setHoverInsert] = useState<HoverInsert | null>(null);
  const [draggingChecklist, setDraggingChecklist] = useState<ChecklistDragState | null>(null);
  const [checklistTaskDrop, setChecklistTaskDrop] = useState<ChecklistTaskDrop | null>(null);
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
  const draftInputRef = useRef<HTMLInputElement | null>(null);
  const skipDraftBlurCommitRef = useRef(false);

  const groupTree = groupTasks(tasks, groupingLevels, DEMO_REFERENCE_NOW);
  const isFlatMode = groupingLevels.length === 0;

  const visibleRowIds = isFlatMode
    ? collectFlatVisibleRowIds(tasks, draft)
    : collectVisibleRowIds(groupTree, collapsedPathKeys, draft);

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

  const openDraft = (pathKey: string, path: GroupPathSegment[], insertIndex: number) => {
    setDraft({ pathKey, path, insertIndex, title: "" });
    setActiveCell({ rowId: DRAFT_ROW_ID, field: "title" });
    setFocusRequest({ rowId: DRAFT_ROW_ID, field: "title" });
  };

  const siblingIdsForPath = (pathKey: string, path: GroupPathSegment[]): string[] => {
    if (pathKey === FLAT_PATH_KEY || path.length === 0) {
      return tasks.map((task) => task.id);
    }
    const node = findLeafNodeByPathKey(groupTree, pathKey);
    return node?.tasks.map((task) => task.id) ?? [];
  };

  const commitDraft = () => {
    if (!draft) {
      return false;
    }
    const trimmed = draft.title.trim();
    if (!trimmed) {
      setDraft(null);
      setActiveCell(null);
      return false;
    }
    const nextTask =
      draft.pathKey === FLAT_PATH_KEY || draft.path.length === 0
        ? buildCreatedTask(trimmed, spaceId, DEFAULT_DEMO_TASK_STAGE_ID)
        : createFromPath(trimmed, draft.path);
    const siblings = siblingIdsForPath(draft.pathKey, draft.path);
    onTasksChange((prev) => insertTaskAmongSiblings(prev, siblings, nextTask, draft.insertIndex));
    setDraft(null);
    setActiveCell(null);
    return true;
  };

  const cancelDraft = () => {
    setDraft(null);
    setActiveCell(null);
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
      if (draggingChecklist) {
        return;
      }
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      setDragOverPathKey((current) => (current === pathKey ? current : pathKey));
    },
    onDrop: (event: DragEvent) => {
      if (draggingChecklist) {
        return;
      }
      event.preventDefault();
      handleDropToPath(path);
    },
  });

  const clearChecklistDrag = () => {
    setDraggingChecklist(null);
    setChecklistTaskDrop(null);
  };

  const expandTaskChecklist = (taskId: string) => {
    setExpandedTaskIds((prev) => {
      if (prev.has(taskId)) {
        return prev;
      }
      const next = new Set(prev);
      next.add(taskId);
      return next;
    });
  };

  const promoteChecklistItemToTask = (
    prev: TodayTask[],
    sourceTaskId: string,
    itemId: string,
    path: GroupPathSegment[],
    pathKey: string,
    insertIndex: number,
  ): TodayTask[] => {
    const source = prev.find((task) => task.id === sourceTaskId);
    if (!source) {
      return prev;
    }
    const { next: sourceNext, node } = extractChecklistSubtree(source.checklist ?? [], itemId);
    if (!node) {
      return prev;
    }

    const title = node.title.trim() || "Untitled";
    const base = buildCreatedTask(title, spaceId, DEFAULT_DEMO_TASK_STAGE_ID);
    const withPath =
      pathKey === FLAT_PATH_KEY || path.length === 0
        ? base
        : applyGroupPathToTask(base, path, DEMO_REFERENCE_NOW);
    const nextTask: TodayTask = {
      ...withPath,
      checklist: node.children,
    };

    const withSource = prev.map((task) =>
      task.id === sourceTaskId ? { ...task, checklist: sourceNext } : task,
    );
    const siblings = siblingIdsForPath(pathKey, path);
    return insertTaskAmongSiblings(withSource, siblings, nextTask, insertIndex);
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

  const moveActiveCell = (rowId: string, field: EditableField, delta: 1 | -1) => {
    const rowIds = visibleRowIds;
    const rowIndex = rowIds.indexOf(rowId);
    const fieldIndex = EDITABLE_FIELDS.indexOf(field);
    if (rowIndex < 0 || fieldIndex < 0) {
      return;
    }

    if (rowId === DRAFT_ROW_ID) {
      const nextRowIndex = rowIndex + delta;
      if (nextRowIndex < 0 || nextRowIndex >= rowIds.length) {
        return;
      }
      const nextRowId = rowIds[nextRowIndex];
      if (nextRowId === DRAFT_ROW_ID) {
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
    if (nextRowId === DRAFT_ROW_ID) {
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
      if (focusRequest.rowId === DRAFT_ROW_ID) {
        draftInputRef.current?.focus();
        draftInputRef.current?.select();
      }
      setFocusRequest(null);
      return;
    }
    const selector = `[data-task-cell="${focusRequest.rowId}:${focusRequest.field}"]`;
    const node = document.querySelector<HTMLElement>(selector);
    node?.focus();
    setFocusRequest(null);
  }, [focusRequest, tasks.length, draft]);

  const handleDraftTitleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      skipDraftBlurCommitRef.current = true;
      commitDraft();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      skipDraftBlurCommitRef.current = true;
      cancelDraft();
      return;
    }
    if (event.key === "Tab") {
      event.preventDefault();
      skipDraftBlurCommitRef.current = true;
      const created = commitDraft();
      if (!created && draft) {
        // Draft cancelled (empty) — nothing to tab from.
        return;
      }
    }
  };

  const renderDraftRow = (depth: number): ReactNode => {
    if (!draft) {
      return null;
    }
    const dropHandlers = draft.path.length > 0 ? pathDropHandlers(draft.path, draft.pathKey) : {};
    return (
      <TableRow key={DRAFT_ROW_ID} className="hover:bg-muted/40" {...dropHandlers}>
        <TableCell className="px-3 py-1" colSpan={1}>
          <div style={{ paddingLeft: (depth + 2) * TREE_STEP_PX }}>
            <Input
              ref={draftInputRef}
              value={draft.title}
              onChange={(event) =>
                setDraft((prev) => (prev ? { ...prev, title: event.target.value } : prev))
              }
              onFocus={() => setActiveCell({ rowId: DRAFT_ROW_ID, field: "title" })}
              onBlur={() => {
                if (skipDraftBlurCommitRef.current) {
                  skipDraftBlurCommitRef.current = false;
                  return;
                }
                commitDraft();
              }}
              onKeyDown={handleDraftTitleKeyDown}
              placeholder="New task"
              aria-label="New task title"
              className="h-7 border-dashed"
            />
          </div>
        </TableCell>
        <TableCell className="px-3 py-1" />
        <TableCell className="px-3 py-1 text-xs text-muted-foreground">Medium</TableCell>
        <TableCell className="px-3 py-1 text-xs text-muted-foreground">Today</TableCell>
        <TableCell className="px-3 py-1 text-xs text-muted-foreground">Unassigned</TableCell>
      </TableRow>
    );
  };

  const renderTaskRowsWithDraft = (
    groupTasksList: TodayTask[],
    path: GroupPathSegment[],
    pathKey: string,
    depth: number,
  ): ReactNode[] => {
    const nodes: ReactNode[] = [];
    groupTasksList.forEach((task, index) => {
      if (draft?.pathKey === pathKey && draft.insertIndex === index) {
        nodes.push(renderDraftRow(depth));
      }
      nodes.push(renderTaskRow(task, path, depth, index, pathKey));
    });
    if (draft?.pathKey === pathKey && draft.insertIndex >= groupTasksList.length) {
      nodes.push(renderDraftRow(depth));
    }
    return nodes;
  };

  const renderTaskRow = (
    task: TodayTask,
    path: GroupPathSegment[],
    depth: number,
    taskIndex: number,
    pathKey: string,
  ): ReactNode => {
    const editingTitle = activeCell?.rowId === task.id && activeCell.field === "title";
    const checklistExpanded = expandedTaskIds.has(task.id);
    const checklistProgress = countChecklist(task.checklist ?? []);
    const TaskExpandIcon = checklistExpanded ? ChevronDown : ChevronRight;
    const dropHandlers =
      path.length > 0
        ? pathDropHandlers(path, pathKey)
        : {
            onDragOver: (_event: DragEvent) => undefined,
            onDrop: (_event: DragEvent) => undefined,
          };
    const showTopInsert =
      hoverInsert?.pathKey === pathKey && hoverInsert.edgeIndex === taskIndex;
    const showBottomInsert =
      hoverInsert?.pathKey === pathKey && hoverInsert.edgeIndex === taskIndex + 1;
    const checklistDropOnRow =
      draggingChecklist && checklistTaskDrop?.taskId === task.id ? checklistTaskDrop : null;

    const checklistRowDragHandlers = {
      onDragOver: (event: DragEvent<HTMLTableRowElement>) => {
        const isChecklist =
          Boolean(draggingChecklist) ||
          Array.from(event.dataTransfer.types).includes(CHECKLIST_DND_MIME);
        if (!isChecklist) {
          dropHandlers.onDragOver(event);
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = "move";
        const bounds = event.currentTarget.getBoundingClientRect();
        const ratio = (event.clientY - bounds.top) / bounds.height;
        const position: ChecklistTaskDrop["position"] =
          ratio < 0.25 ? "before" : ratio > 0.75 ? "after" : "into";
        setChecklistTaskDrop((current) =>
          current?.taskId === task.id && current.position === position
            ? current
            : { taskId: task.id, position },
        );
      },
      onDrop: (event: DragEvent<HTMLTableRowElement>) => {
        if (!draggingChecklist) {
          dropHandlers.onDrop(event);
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        const position = checklistTaskDrop?.taskId === task.id ? checklistTaskDrop.position : "into";
        if (position === "into") {
          onTasksChange((prev) =>
            moveChecklistAcrossTasks(
              prev,
              draggingChecklist.sourceTaskId,
              draggingChecklist.itemId,
              task.id,
              null,
              "into",
            ),
          );
          expandTaskChecklist(task.id);
        } else {
          const insertIndex = position === "before" ? taskIndex : taskIndex + 1;
          onTasksChange((prev) =>
            promoteChecklistItemToTask(
              prev,
              draggingChecklist.sourceTaskId,
              draggingChecklist.itemId,
              path,
              pathKey,
              insertIndex,
            ),
          );
        }
        clearChecklistDrag();
      },
      onDragLeave: () => {
        setChecklistTaskDrop((current) => (current?.taskId === task.id ? null : current));
      },
    };

    return (
      <Fragment key={task.id}>
        <ContextMenu>
          <ContextMenuTrigger
            render={
              <TableRow
                draggable
                onDragStart={(event) => {
                  if (draggingChecklist) {
                    event.preventDefault();
                    return;
                  }
                  event.dataTransfer.setData("text/plain", task.id);
                  event.dataTransfer.effectAllowed = "move";
                  setDraggedTaskId(task.id);
                }}
                onDragEnd={() => {
                  setDraggedTaskId(null);
                  setDragOverPathKey(null);
                }}
                onMouseMove={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect();
                  const isUpper = event.clientY < rect.top + rect.height / 2;
                  setHoverInsert({
                    pathKey,
                    edgeIndex: isUpper ? taskIndex : taskIndex + 1,
                  });
                }}
                onMouseLeave={() => {
                  setHoverInsert((current) =>
                    current?.pathKey === pathKey ? null : current,
                  );
                }}
                className={cn(
                  "relative",
                  draggedTaskId === task.id && "opacity-50",
                  checklistDropOnRow?.position === "into" &&
                    "bg-primary/5 ring-2 ring-inset ring-primary/40",
                  checklistDropOnRow?.position === "before" && "border-t-2 border-t-primary",
                  checklistDropOnRow?.position === "after" &&
                    "shadow-[inset_0_-2px_0_0_var(--color-primary)]",
                )}
                {...dropHandlers}
                {...checklistRowDragHandlers}
              />
            }
          >
            <TableCell className="relative max-w-0 min-w-[12rem] px-3 py-1">
              {showTopInsert ? (
                <button
                  type="button"
                  aria-label="Insert task above"
                  className="absolute left-1/2 top-0 z-10 flex size-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm hover:text-foreground"
                  onClick={(event) => {
                    event.stopPropagation();
                    openDraft(pathKey, path, taskIndex);
                  }}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() =>
                    setHoverInsert({ pathKey, edgeIndex: taskIndex })
                  }
                >
                  <Plus className="size-3" aria-hidden />
                </button>
              ) : null}
              {showBottomInsert ? (
                <button
                  type="button"
                  aria-label="Insert task below"
                  className="absolute left-1/2 bottom-0 z-10 flex size-5 -translate-x-1/2 translate-y-1/2 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm hover:text-foreground"
                  onClick={(event) => {
                    event.stopPropagation();
                    openDraft(pathKey, path, taskIndex + 1);
                  }}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() =>
                    setHoverInsert({ pathKey, edgeIndex: taskIndex + 1 })
                  }
                >
                  <Plus className="size-3" aria-hidden />
                </button>
              ) : null}
              <div
                className="flex min-w-0 items-center gap-2"
                style={{ paddingLeft: (depth + 1) * TREE_STEP_PX }}
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
                  onKeyDown={(event, draftTitle) => {
                    if (event.key !== "Tab") {
                      return false;
                    }
                    event.preventDefault();
                    titleEditableRef.current?.skipNextBlurCommit();
                    commitExistingTitle(task, draftTitle, false);
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
                  className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Open task"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => event.stopPropagation()}
                >
                  <SquareArrowOutUpRight className="size-3.5" aria-hidden />
                </Link>
              </div>
            </TableCell>
            <TableCell className="px-3 py-1">
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
            <TableCell className="px-3 py-1">
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
            <TableCell className="px-3 py-1">
              <Input
                type="date"
                value={toDateInputValue(task.deadlineAt)}
                aria-label={`Deadline for ${task.title}`}
                className="h-7"
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
            <TableCell className="px-3 py-1">
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
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem
              onClick={() => {
                router.push(`/tracker/tasks/${task.id}`);
              }}
            >
              Open task
            </ContextMenuItem>
            <ContextMenuItem onClick={() => updateTask(task.id, { done: !task.done })}>
              {task.done ? "Mark as not done" : "Mark as done"}
            </ContextMenuItem>
            <ContextMenuItem onClick={() => openDraft(pathKey, path, taskIndex + 1)}>
              Add task below
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              variant="destructive"
              onClick={() => onTasksChange((prev) => prev.filter((item) => item.id !== task.id))}
            >
              Delete
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
        {checklistExpanded ? (
          <TableRow
            className="border-0 hover:bg-transparent"
            onDragStart={(event) => event.preventDefault()}
          >
            <TableCell colSpan={5} className="p-0">
              <TaskChecklist
                taskId={task.id}
                items={task.checklist ?? []}
                baseLevel={depth + 2}
                externalDraggingId={
                  draggingChecklist && draggingChecklist.sourceTaskId !== task.id
                    ? draggingChecklist.itemId
                    : null
                }
                onChecklistDragStart={(itemId) =>
                  setDraggingChecklist({ sourceTaskId: task.id, itemId })
                }
                onChecklistDragEnd={clearChecklistDrag}
                onChange={(checklist) => updateTask(task.id, { checklist })}
                onExternalDropOnItem={(itemId, position) => {
                  if (!draggingChecklist) {
                    return;
                  }
                  onTasksChange((prev) =>
                    moveChecklistAcrossTasks(
                      prev,
                      draggingChecklist.sourceTaskId,
                      draggingChecklist.itemId,
                      task.id,
                      itemId,
                      position,
                    ),
                  );
                  expandTaskChecklist(task.id);
                  clearChecklistDrag();
                }}
                onExternalDropOnRoot={() => {
                  if (!draggingChecklist) {
                    return;
                  }
                  onTasksChange((prev) =>
                    moveChecklistAcrossTasks(
                      prev,
                      draggingChecklist.sourceTaskId,
                      draggingChecklist.itemId,
                      task.id,
                      null,
                      "into",
                    ),
                  );
                  expandTaskChecklist(task.id);
                  clearChecklistDrag();
                }}
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
    const isLeaf = node.children.length === 0;

    return (
      <Fragment key={pathKey}>
        <TableRow
          className={cn(
            "bg-muted/40 hover:bg-muted/50",
            dragOverPathKey === pathKey && "ring-2 ring-inset ring-primary/40",
          )}
          {...dropHandlers}
        >
          <TableCell colSpan={5} className="px-3 py-1">
            <div
              className="flex w-full items-center gap-2"
              style={{ paddingLeft: depth * TREE_STEP_PX }}
            >
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => togglePathCollapsed(pathKey)}
                aria-expanded={!collapsed}
                aria-label={`${collapsed ? "Expand" : "Collapse"} ${node.label}`}
              >
                <span className="flex size-5 shrink-0 items-center justify-center">
                  <ChevronIcon className="size-4 text-muted-foreground" aria-hidden />
                </span>
                <span className="truncate">{node.label}</span>
                <span className="text-xs font-normal text-muted-foreground">{taskCount}</span>
              </button>
              {isLeaf ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0"
                  aria-label="Add task"
                  onClick={(event) => {
                    event.stopPropagation();
                    openDraft(pathKey, node.path, 0);
                  }}
                >
                  <Plus className="size-3.5" aria-hidden />
                </Button>
              ) : null}
            </div>
          </TableCell>
        </TableRow>

        {!collapsed ? (
          <>
            {node.children.map((child) => renderGroupNode(child, depth + 1))}
            {isLeaf ? renderTaskRowsWithDraft(node.tasks, node.path, pathKey, depth) : null}
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
            <TableHead className="h-8 px-3 text-xs">Title</TableHead>
            <TableHead className="h-8 w-16 px-3 text-xs">Done</TableHead>
            <TableHead className="h-8 w-28 px-3 text-xs">Priority</TableHead>
            <TableHead className="h-8 w-36 px-3 text-xs">Deadline</TableHead>
            <TableHead className="h-8 w-44 px-3 text-xs">Assignee</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isFlatMode ? (
            <>
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={5} className="px-3 py-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label="Add task"
                    onClick={() => openDraft(FLAT_PATH_KEY, [], 0)}
                  >
                    <Plus className="size-3.5" aria-hidden />
                    Add task
                  </Button>
                </TableCell>
              </TableRow>
              {renderTaskRowsWithDraft(tasks, [], FLAT_PATH_KEY, 0)}
            </>
          ) : (
            groupTree.map((node) => renderGroupNode(node, 0))
          )}
        </TableBody>
      </Table>
    </div>
  );
};

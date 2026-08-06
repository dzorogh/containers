"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import type { ChecklistItem } from "@/components/home/tasks-today-demo-data";
import {
  addChecklistItem,
  indentChecklistItem,
  insertChecklistSiblingAfter,
  moveChecklistItem,
  outdentChecklistItem,
  removeChecklistItem,
  renameChecklistItem,
  toggleChecklistItem,
  type ChecklistDropPosition,
} from "@/components/tracker/tasks/checklist-tree";
import {
  InlineEditableText,
  type InlineEditableTextHandle,
} from "@/components/tracker/tasks/inline-editable-text";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export const CHECKLIST_DND_MIME = "application/x-oryx-checklist-item";

export type ChecklistDragPayload = {
  type: "checklist-item";
  sourceTaskId: string;
  itemId: string;
};

type TaskChecklistProps = {
  items: ChecklistItem[];
  onChange: (next: ChecklistItem[]) => void;
  /** Tree level of root checklist items (task is level−1). Matches group/task ladder. */
  baseLevel?: number;
  taskId: string;
  /** When set, an item from another task is being dragged */
  externalDraggingId?: string | null;
  onChecklistDragStart?: (itemId: string) => void;
  onChecklistDragEnd?: () => void;
  /** Cross-task drop onto an item (parent performs extract+insert) */
  onExternalDropOnItem?: (itemId: string, position: ChecklistDropPosition) => void;
  /** Cross-task drop onto empty / root panel */
  onExternalDropOnRoot?: () => void;
};

/** Shared tree indent step so group → task → checklist chevrons form a ladder. */
export const TREE_STEP_PX = 20;
/** Table title cell `px-3` — checklist rows use `p-0`, so recreate that inset. */
const CELL_PAD_X_PX = 12;

const newId = () => `cli-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const collectParentIds = (nodes: ChecklistItem[]): Set<string> => {
  const ids = new Set<string>();
  const walk = (list: ChecklistItem[]) => {
    for (const node of list) {
      if (node.children.length > 0) {
        ids.add(node.id);
        walk(node.children);
      }
    }
  };
  walk(nodes);
  return ids;
};

const isChecklistDrag = (event: DragEvent, externalDraggingId?: string | null) =>
  Boolean(externalDraggingId) ||
  Array.from(event.dataTransfer.types).includes(CHECKLIST_DND_MIME);

export const TaskChecklist = ({
  items,
  onChange,
  baseLevel = 2,
  taskId,
  externalDraggingId = null,
  onChecklistDragStart,
  onChecklistDragEnd,
  onExternalDropOnItem,
  onExternalDropOnRoot,
}: TaskChecklistProps) => {
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => collectParentIds(items));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    id: string;
    position: ChecklistDropPosition;
  } | null>(null);
  const [rootDropActive, setRootDropActive] = useState(false);
  const editableRef = useRef<InlineEditableTextHandle | null>(null);

  const activeDragId = draggingId ?? externalDraggingId;

  const onDragOverItem = (event: DragEvent, id: string) => {
    event.preventDefault();
    event.stopPropagation();
    const dragId = draggingId ?? (isChecklistDrag(event, externalDraggingId) ? externalDraggingId : null);
    if (!dragId || dragId === id) {
      return;
    }
    const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const y = event.clientY - bounds.top;
    const ratio = y / bounds.height;
    const position: ChecklistDropPosition =
      ratio < 0.25 ? "before" : ratio > 0.75 ? "after" : "into";
    setDropTarget({ id, position });
    setRootDropActive(false);
  };

  const onDropItem = (event: DragEvent, id: string) => {
    event.preventDefault();
    event.stopPropagation();
    if (!dropTarget || dropTarget.id !== id) {
      setDraggingId(null);
      setDropTarget(null);
      setRootDropActive(false);
      return;
    }
    if (draggingId) {
      onChange(moveChecklistItem(items, draggingId, id, dropTarget.position));
    } else if (externalDraggingId && onExternalDropOnItem) {
      onExternalDropOnItem(id, dropTarget.position);
    }
    setDraggingId(null);
    setDropTarget(null);
    setRootDropActive(false);
  };

  useEffect(() => {
    if (!focusId) {
      return;
    }
    setEditingId(focusId);
    requestAnimationFrame(() => {
      // Caret stays at end for newly created items (no click offset).
      editableRef.current?.focus();
    });
    setFocusId(null);
  }, [focusId]);

  const toggleCollapsed = (id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const beginEdit = (item: ChecklistItem) => {
    setEditingId(item.id);
  };

  const commitEdit = (item: ChecklistItem, raw: string, clear = true) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      if (item.title === "") {
        onChange(removeChecklistItem(items, item.id));
      }
      if (clear) {
        setEditingId(null);
      }
      return;
    }
    if (trimmed !== item.title) {
      onChange(renameChecklistItem(items, item.id, trimmed));
    }
    if (clear) {
      setEditingId(null);
    }
  };

  const handleAddRoot = () => {
    const id = newId();
    onChange(addChecklistItem(items, null, "", id));
    setFocusId(id);
  };

  const handleAddChild = (parentId: string) => {
    const id = newId();
    onChange(addChecklistItem(items, parentId, "", id));
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      next.delete(parentId);
      return next;
    });
    setFocusId(id);
  };

  const renderItems = (nodes: ChecklistItem[], depth: number) =>
    nodes.map((item) => {
      const hasChildren = item.children.length > 0;
      const collapsed = collapsedIds.has(item.id);
      const editing = editingId === item.id;
      const ChevronIcon = collapsed ? ChevronRight : ChevronDown;

      return (
        <div key={item.id}>
          <div
            draggable={!editing}
            className={cn(
              "group flex items-center gap-2 border-b border-border py-1 pr-3 transition-colors hover:bg-muted/50",
              !editing && "cursor-grab active:cursor-grabbing",
              activeDragId === item.id && "opacity-50",
              dropTarget?.id === item.id &&
                dropTarget.position === "into" &&
                "bg-primary/5 ring-2 ring-inset ring-primary/40",
              dropTarget?.id === item.id &&
                dropTarget.position === "before" &&
                "border-t-2 border-t-primary",
              dropTarget?.id === item.id &&
                dropTarget.position === "after" &&
                "shadow-[inset_0_-2px_0_0_var(--color-primary)]",
            )}
            onDragStart={(event) => {
              if (editing) {
                event.preventDefault();
                return;
              }
              event.stopPropagation();
              const payload: ChecklistDragPayload = {
                type: "checklist-item",
                sourceTaskId: taskId,
                itemId: item.id,
              };
              event.dataTransfer.setData(CHECKLIST_DND_MIME, JSON.stringify(payload));
              event.dataTransfer.setData("text/plain", item.id);
              event.dataTransfer.effectAllowed = "move";
              setDraggingId(item.id);
              onChecklistDragStart?.(item.id);
            }}
            onDragEnd={() => {
              setDraggingId(null);
              setDropTarget(null);
              setRootDropActive(false);
              onChecklistDragEnd?.();
            }}
            onDragOver={(event) => onDragOverItem(event, item.id)}
            onDrop={(event) => onDropItem(event, item.id)}
            onDragLeave={() => {
              setDropTarget((current) => (current?.id === item.id ? null : current));
            }}
          >
            {/* Cell pad + level×step: group@N, task@N+1, item@baseLevel+depth */}
            <div
              className="flex min-w-0 flex-1 items-center gap-2"
              style={{ paddingLeft: CELL_PAD_X_PX + TREE_STEP_PX * (baseLevel + depth) }}
            >
              <button
                type="button"
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center text-muted-foreground",
                  !hasChildren && "invisible",
                )}
                onClick={() => toggleCollapsed(item.id)}
                onMouseDown={(event) => event.stopPropagation()}
                aria-label={collapsed ? "Expand item" : "Collapse item"}
                tabIndex={hasChildren ? 0 : -1}
              >
                <ChevronIcon className="size-4" aria-hidden />
              </button>
              <Checkbox
                checked={item.done}
                onCheckedChange={() => onChange(toggleChecklistItem(items, item.id))}
                onMouseDown={(event) => event.stopPropagation()}
                aria-label={`Mark ${item.title || "item"} done`}
                className="cursor-pointer"
              />
              <InlineEditableText
                ref={editing ? editableRef : null}
                value={item.title}
                editing={editing}
                placeholder="Untitled"
                onBeginEdit={() => beginEdit(item)}
                onCommit={(next) => commitEdit(item, next)}
                onCancel={() => setEditingId(null)}
                onKeyDown={(event, draft) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    editableRef.current?.skipNextBlurCommit();
                    const committedTitle = draft.trim();
                    if (!committedTitle) {
                      setEditingId(null);
                      return true;
                    }
                    const id = newId();
                    let next = items;
                    if (committedTitle !== item.title) {
                      next = renameChecklistItem(items, item.id, committedTitle);
                    }
                    next = insertChecklistSiblingAfter(next, item.id, "", id);
                    onChange(next);
                    setEditingId(null);
                    setFocusId(id);
                    return true;
                  }
                  if (event.key === "Tab") {
                    event.preventDefault();
                    editableRef.current?.skipNextBlurCommit();
                    const committedTitle = draft.trim() || item.title;
                    let next =
                      committedTitle !== item.title
                        ? renameChecklistItem(items, item.id, committedTitle)
                        : items;
                    next = event.shiftKey
                      ? outdentChecklistItem(next, item.id)
                      : indentChecklistItem(next, item.id);
                    onChange(next);
                    setFocusId(item.id);
                    return true;
                  }
                  if ((event.key === "Backspace" || event.key === "Delete") && draft === "") {
                    event.preventDefault();
                    editableRef.current?.skipNextBlurCommit();
                    onChange(removeChecklistItem(items, item.id));
                    setEditingId(null);
                    return true;
                  }
                  return false;
                }}
                aria-label="Edit checklist item"
                className={cn(
                  "flex-1",
                  item.done && !editing && "text-muted-foreground line-through",
                )}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="opacity-0 group-hover:opacity-100"
                onClick={() => handleAddChild(item.id)}
                onMouseDown={(event) => event.stopPropagation()}
                aria-label="Add child item"
              >
                <Plus className="size-3.5" />
              </Button>
            </div>
          </div>
          {hasChildren && !collapsed ? renderItems(item.children, depth + 1) : null}
        </div>
      );
    });

  return (
    <div
      onMouseDown={(event) => event.stopPropagation()}
      className={cn(rootDropActive && "bg-primary/5 ring-2 ring-inset ring-primary/40")}
      onDragOver={(event) => {
        if (!isChecklistDrag(event, externalDraggingId)) {
          return;
        }
        // Only highlight root when not over a specific item drop target
        if (dropTarget) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        setRootDropActive(true);
      }}
      onDragLeave={() => setRootDropActive(false)}
      onDrop={(event) => {
        if (!isChecklistDrag(event, externalDraggingId)) {
          return;
        }
        if (dropTarget) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        if (externalDraggingId && onExternalDropOnRoot) {
          onExternalDropOnRoot();
        } else if (draggingId) {
          const lastRoot = items[items.length - 1];
          if (lastRoot && lastRoot.id !== draggingId) {
            onChange(moveChecklistItem(items, draggingId, lastRoot.id, "after"));
          }
        }
        setDraggingId(null);
        setDropTarget(null);
        setRootDropActive(false);
      }}
    >
      {items.length > 0 ? renderItems(items, 0) : null}
      <button
        type="button"
        className="flex w-full items-center border-b border-border py-1 pr-3 text-left text-sm text-muted-foreground transition-colors hover:bg-muted/40"
        onClick={handleAddRoot}
        onDragOver={(event) => {
          if (!isChecklistDrag(event, externalDraggingId)) {
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          setDropTarget(null);
          setRootDropActive(true);
        }}
        onDrop={(event) => {
          if (!isChecklistDrag(event, externalDraggingId)) {
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          if (externalDraggingId && onExternalDropOnRoot) {
            onExternalDropOnRoot();
          } else if (draggingId) {
            const lastRoot = items[items.length - 1];
            if (lastRoot && lastRoot.id !== draggingId) {
              onChange(moveChecklistItem(items, draggingId, lastRoot.id, "after"));
            }
          }
          setDraggingId(null);
          setDropTarget(null);
          setRootDropActive(false);
        }}
      >
        <span
          className="flex min-w-0 flex-1 items-center gap-2"
          style={{ paddingLeft: CELL_PAD_X_PX + TREE_STEP_PX * baseLevel }}
        >
          <span className="size-5 shrink-0" aria-hidden />
          <span className="truncate">Add item</span>
        </span>
      </button>
    </div>
  );
};

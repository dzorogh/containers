"use client";

import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import { ChevronDown, ChevronRight, GripVertical, Plus } from "lucide-react";
import type { ChecklistItem } from "@/components/home/tasks-today-demo-data";
import {
  addChecklistItem,
  countChecklist,
  findChecklistItem,
  indentChecklistItem,
  insertChecklistSiblingAfter,
  moveChecklistItem,
  outdentChecklistItem,
  removeChecklistItem,
  renameChecklistItem,
  toggleChecklistItem,
  type ChecklistDropPosition,
} from "@/components/tracker/tasks/checklist-tree";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type TaskChecklistProps = {
  items: ChecklistItem[];
  onChange: (next: ChecklistItem[]) => void;
};

const newId = () => `cli-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const TaskChecklist = ({ items, onChange }: TaskChecklistProps) => {
  const { done, total } = countChecklist(items);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [focusId, setFocusId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    id: string;
    position: ChecklistDropPosition;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const skipBlurCommitRef = useRef(false);

  const onDragOverItem = (event: DragEvent, id: string) => {
    event.preventDefault();
    event.stopPropagation();
    if (!draggingId || draggingId === id) {
      return;
    }
    const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const y = event.clientY - bounds.top;
    const ratio = y / bounds.height;
    const position: ChecklistDropPosition =
      ratio < 0.25 ? "before" : ratio > 0.75 ? "after" : "into";
    setDropTarget({ id, position });
  };

  const onDropItem = (event: DragEvent, id: string) => {
    event.preventDefault();
    event.stopPropagation();
    if (!draggingId || !dropTarget || dropTarget.id !== id) {
      setDraggingId(null);
      setDropTarget(null);
      return;
    }
    onChange(moveChecklistItem(items, draggingId, id, dropTarget.position));
    setDraggingId(null);
    setDropTarget(null);
  };

  useEffect(() => {
    if (!focusId) {
      return;
    }
    setEditingId(focusId);
    const node = findChecklistItem(items, focusId);
    setDraft(node?.title ?? "");
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    setFocusId(null);
  }, [focusId, items]);

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
    setDraft(item.title);
  };

  const commitEdit = (item: ChecklistItem, raw: string, clear = true) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      if (item.title === "") {
        onChange(removeChecklistItem(items, item.id));
      } else {
        setDraft(item.title);
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

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>, item: ChecklistItem) => {
    if (event.key === "Enter") {
      event.preventDefault();
      skipBlurCommitRef.current = true;
      const committedTitle = draft.trim();
      if (!committedTitle) {
        setDraft(item.title);
        setEditingId(null);
        return;
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
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setDraft(item.title);
      setEditingId(null);
      return;
    }
    if (event.key === "Tab") {
      event.preventDefault();
      skipBlurCommitRef.current = true;
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
      return;
    }
    if ((event.key === "Backspace" || event.key === "Delete") && draft === "") {
      event.preventDefault();
      skipBlurCommitRef.current = true;
      onChange(removeChecklistItem(items, item.id));
      setEditingId(null);
    }
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
            className={cn(
              "group flex items-center gap-1 rounded-md px-1 py-0.5 hover:bg-muted/60",
              draggingId === item.id && "opacity-50",
              dropTarget?.id === item.id &&
                dropTarget.position === "into" &&
                "ring-2 ring-primary/40",
              dropTarget?.id === item.id &&
                dropTarget.position === "before" &&
                "border-t-2 border-primary",
              dropTarget?.id === item.id &&
                dropTarget.position === "after" &&
                "border-b-2 border-primary",
            )}
            style={{ paddingLeft: depth * 16 }}
            onDragOver={(event) => onDragOverItem(event, item.id)}
            onDrop={(event) => onDropItem(event, item.id)}
            onDragLeave={() => {
              setDropTarget((current) => (current?.id === item.id ? null : current));
            }}
          >
            <button
              type="button"
              className={cn(
                "flex size-5 shrink-0 items-center justify-center text-muted-foreground",
                !hasChildren && "invisible",
              )}
              onClick={() => toggleCollapsed(item.id)}
              aria-label={collapsed ? "Expand item" : "Collapse item"}
              tabIndex={hasChildren ? 0 : -1}
            >
              <ChevronIcon className="size-3.5" aria-hidden />
            </button>
            <Checkbox
              checked={item.done}
              onCheckedChange={() => onChange(toggleChecklistItem(items, item.id))}
              aria-label={`Mark ${item.title || "item"} done`}
            />
            {editing ? (
              <Input
                ref={inputRef}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onBlur={() => {
                  if (skipBlurCommitRef.current) {
                    skipBlurCommitRef.current = false;
                    return;
                  }
                  commitEdit(item, draft);
                }}
                onKeyDown={(event) => handleKeyDown(event, item)}
                aria-label="Edit checklist item"
                className="h-7 flex-1"
              />
            ) : (
              <button
                type="button"
                className={cn(
                  "min-w-0 flex-1 truncate text-left text-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring",
                  item.done && "text-muted-foreground line-through",
                )}
                onClick={() => beginEdit(item)}
              >
                {item.title || "Untitled"}
              </button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="opacity-0 group-hover:opacity-100"
              onClick={() => handleAddChild(item.id)}
              aria-label="Add child item"
            >
              <Plus className="size-3.5" />
            </Button>
            <span
              draggable
              onDragStart={(event) => {
                event.stopPropagation();
                event.dataTransfer.setData("text/plain", item.id);
                event.dataTransfer.effectAllowed = "move";
                setDraggingId(item.id);
              }}
              onDragEnd={() => {
                setDraggingId(null);
                setDropTarget(null);
              }}
              className="flex size-5 cursor-grab items-center justify-center text-muted-foreground opacity-0 group-hover:opacity-100"
              data-checklist-drag-handle
              role="button"
              aria-label="Drag checklist item"
            >
              <GripVertical className="size-3.5" />
            </span>
          </div>
          {hasChildren && !collapsed ? renderItems(item.children, depth + 1) : null}
        </div>
      );
    });

  return (
    <div className="space-y-2" onMouseDown={(event) => event.stopPropagation()}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">
          Checklist{" "}
          <span className="font-normal text-muted-foreground">
            {done}/{total}
          </span>
        </p>
        <Button type="button" variant="ghost" size="sm" onClick={handleAddRoot}>
          <Plus className="size-3.5" />
          Add item
        </Button>
      </div>
      {items.length === 0 ? (
        <button
          type="button"
          className="w-full rounded-md border border-dashed border-border px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted/40"
          onClick={handleAddRoot}
        >
          Add checklist item…
        </button>
      ) : (
        <div className="space-y-0.5">{renderItems(items, 0)}</div>
      )}
    </div>
  );
};

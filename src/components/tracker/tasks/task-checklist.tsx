"use client";

import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import type { ChecklistItem } from "@/components/home/tasks-today-demo-data";
import {
  addChecklistItem,
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

/** Shared tree indent step so stage → task → checklist chevrons form a ladder. */
export const TREE_STEP_PX = 20;

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

export const TaskChecklist = ({ items, onChange }: TaskChecklistProps) => {
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => collectParentIds(items));
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
            draggable={!editing}
            className={cn(
              "group flex items-center gap-2 border-b border-border py-2 pr-3 transition-colors hover:bg-muted/50",
              !editing && "cursor-grab active:cursor-grabbing",
              draggingId === item.id && "opacity-50",
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
              event.dataTransfer.setData("text/plain", item.id);
              event.dataTransfer.effectAllowed = "move";
              setDraggingId(item.id);
            }}
            onDragEnd={() => {
              setDraggingId(null);
              setDropTarget(null);
            }}
            onDragOver={(event) => onDragOverItem(event, item.id)}
            onDrop={(event) => onDropItem(event, item.id)}
            onDragLeave={() => {
              setDropTarget((current) => (current?.id === item.id ? null : current));
            }}
          >
            {/* Matches table cell px-3 (12px): stage@0, task@1×step, item@(depth+2)×step */}
            <div
              className="flex min-w-0 flex-1 items-center gap-2"
              style={{ paddingLeft: 12 + TREE_STEP_PX * (depth + 2) }}
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
                  onMouseDown={(event) => event.stopPropagation()}
                  aria-label="Edit checklist item"
                  className="h-8 flex-1"
                />
              ) : (
                <button
                  type="button"
                  className={cn(
                    "min-w-0 flex-1 truncate text-left text-sm font-medium outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring",
                    item.done && "font-normal text-muted-foreground line-through",
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
    <div onMouseDown={(event) => event.stopPropagation()}>
      {items.length > 0 ? renderItems(items, 0) : null}
      <button
        type="button"
        className="flex w-full items-center border-b border-border py-2 pr-3 text-left text-sm text-muted-foreground transition-colors hover:bg-muted/40"
        onClick={handleAddRoot}
      >
        <span
          className="flex min-w-0 flex-1 items-center gap-2"
          style={{ paddingLeft: 12 + TREE_STEP_PX * 2 }}
        >
          <span className="size-5 shrink-0" aria-hidden />
          <span className="truncate">Add item</span>
        </span>
      </button>
    </div>
  );
};

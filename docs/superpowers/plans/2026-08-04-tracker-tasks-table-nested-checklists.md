# Tracker Tasks Table Nested Checklists — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Spec: `docs/superpowers/specs/2026-08-04-tracker-tasks-table-nested-checklists-design.md`.

**Goal:** Expand a task row in the tracker table to show an arbitrarily nested checklist with toggle, rename, add/delete, indent/outdent, and HTML5 drag reparent — demo state only.

**Architecture:** Add `ChecklistItem` + `checklist` on `TodayTask`. Pure immutable helpers in `checklist-tree.ts` own all tree mutations. `TaskChecklist` renders the expanded panel; `TasksListView` owns expand state and wires mutations through existing `onTasksChange` / `updateTask`.

**Tech Stack:** React client components, shadcn `Checkbox` / `Input` / `Button` / `Table`, lucide icons, native HTML5 DnD, Vitest unit tests under `tests/unit/`.

---

## File map

| File | Responsibility |
|------|----------------|
| `src/components/home/tasks-today-demo-data.ts` | `ChecklistItem` type; `checklist` on `TodayTask`; seed trees; `createTask` default `[]` |
| `src/components/tracker/tasks/checklist-tree.ts` | Pure tree count + mutations |
| `tests/unit/checklist-tree.test.ts` | Unit tests for helpers |
| `src/components/tracker/tasks/task-checklist.tsx` | Nested checklist UI, local item collapse, DnD, inline edit |
| `src/components/tracker/tasks/tasks-list-view.tsx` | Expand chevron, progress badge, expanded `colSpan` row |
| `app/tracker/tasks/page.tsx` | New tasks get `checklist: []` |
| `src/components/tracker/tasks/calendar/tasks-month-calendar.tsx` | Quick-create gets `checklist: []` |

---

### Task 1: Types, defaults, and seed data

**Files:**
- Modify: `src/components/home/tasks-today-demo-data.ts`
- Modify: `app/tracker/tasks/page.tsx`
- Modify: `src/components/tracker/tasks/tasks-list-view.tsx` (`buildCreatedTask`)
- Modify: `src/components/tracker/tasks/calendar/tasks-month-calendar.tsx`

- [ ] **Step 1: Add `ChecklistItem` and field on `TodayTask`**

In `tasks-today-demo-data.ts`, after `DemoTaskStage` / before `TodayTask`:

```ts
export type ChecklistItem = {
  id: string;
  title: string;
  done: boolean;
  children: ChecklistItem[];
};
```

Add to `TodayTask`:

```ts
checklist: ChecklistItem[];
```

- [ ] **Step 2: Thread through `createTask`**

Extend `createTask` config with optional `checklist?: ChecklistItem[]`. In the returned object:

```ts
checklist: config.checklist ?? [],
```

- [ ] **Step 3: Seed sample trees**

Pass `checklist` on these tasks (others keep default `[]`):

**`task-8`** (“Complete pre-release checklist”) — depth ≥ 3:

```ts
checklist: [
  {
    id: "cli-8-1",
    title: "Pre-flight",
    done: false,
    children: [
      {
        id: "cli-8-1-1",
        title: "Build green",
        done: true,
        children: [
          {
            id: "cli-8-1-1-1",
            title: "Typecheck",
            done: true,
            children: [],
          },
          {
            id: "cli-8-1-1-2",
            title: "Unit tests",
            done: false,
            children: [],
          },
        ],
      },
      {
        id: "cli-8-1-2",
        title: "Changelog updated",
        done: false,
        children: [],
      },
    ],
  },
  {
    id: "cli-8-2",
    title: "Notify stakeholders",
    done: false,
    children: [],
  },
],
```

**`task-11`** (“Prepare QA checklist…”) — shallow:

```ts
checklist: [
  { id: "cli-11-1", title: "Smoke login", done: true, children: [] },
  { id: "cli-11-2", title: "Create order", done: false, children: [] },
  { id: "cli-11-3", title: "Export report", done: false, children: [] },
],
```

- [ ] **Step 4: Fix create sites**

Add `checklist: []` to:

1. `buildCreatedTask` in `tasks-list-view.tsx`
2. `handleCreateTask` object in `app/tracker/tasks/page.tsx`
3. Quick-create object in `tasks-month-calendar.tsx` (~line 280)

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/home/tasks-today-demo-data.ts \
  app/tracker/tasks/page.tsx \
  src/components/tracker/tasks/tasks-list-view.tsx \
  src/components/tracker/tasks/calendar/tasks-month-calendar.tsx
git commit -m "$(cat <<'EOF'
feat(tracker): add checklist field to demo tasks

EOF
)"
```

---

### Task 2: Tree helpers — count, map, toggle, rename, add, remove

**Files:**
- Create: `src/components/tracker/tasks/checklist-tree.ts`
- Create: `tests/unit/checklist-tree.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from "vitest";
import type { ChecklistItem } from "@/components/home/tasks-today-demo-data";
import {
  addChecklistItem,
  countChecklist,
  insertChecklistSiblingAfter,
  removeChecklistItem,
  renameChecklistItem,
  toggleChecklistItem,
} from "@/components/tracker/tasks/checklist-tree";

const sample = (): ChecklistItem[] => [
  {
    id: "a",
    title: "A",
    done: false,
    children: [
      { id: "a1", title: "A1", done: true, children: [] },
      { id: "a2", title: "A2", done: false, children: [] },
    ],
  },
  { id: "b", title: "B", done: false, children: [] },
];

describe("countChecklist", () => {
  it("counts all nodes", () => {
    expect(countChecklist(sample())).toEqual({ done: 1, total: 4 });
  });

  it("returns zeros for empty", () => {
    expect(countChecklist([])).toEqual({ done: 0, total: 0 });
  });
});

describe("toggleChecklistItem", () => {
  it("toggles only the matched node", () => {
    const next = toggleChecklistItem(sample(), "a");
    expect(next[0].done).toBe(true);
    expect(next[0].children[0].done).toBe(true);
    expect(next[0].children[1].done).toBe(false);
  });
});

describe("renameChecklistItem", () => {
  it("renames the matched node", () => {
    const next = renameChecklistItem(sample(), "a2", "Renamed");
    expect(next[0].children[1].title).toBe("Renamed");
  });
});

describe("addChecklistItem", () => {
  it("appends a root when parentId is null", () => {
    const next = addChecklistItem(sample(), null, "C", "c");
    expect(next).toHaveLength(3);
    expect(next[2]).toMatchObject({ id: "c", title: "C", done: false, children: [] });
  });

  it("appends under a parent", () => {
    const next = addChecklistItem(sample(), "a", "A3", "a3");
    expect(next[0].children.map((c) => c.id)).toEqual(["a1", "a2", "a3"]);
  });
});

describe("insertChecklistSiblingAfter", () => {
  it("inserts after a sibling under the same parent", () => {
    const next = insertChecklistSiblingAfter(sample(), "a1", "Mid", "mid");
    expect(next[0].children.map((c) => c.id)).toEqual(["a1", "mid", "a2"]);
  });
});

describe("removeChecklistItem", () => {
  it("promotes children to the parent", () => {
    const next = removeChecklistItem(sample(), "a");
    expect(next.map((c) => c.id)).toEqual(["a1", "a2", "b"]);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npx vitest run tests/unit/checklist-tree.test.ts`

Expected: FAIL (module not found / exports missing)

- [ ] **Step 3: Implement helpers**

Create `src/components/tracker/tasks/checklist-tree.ts`:

```ts
import type { ChecklistItem } from "@/components/home/tasks-today-demo-data";

export type ChecklistDropPosition = "before" | "after" | "into";

export const countChecklist = (items: ChecklistItem[]): { done: number; total: number } => {
  let done = 0;
  let total = 0;
  const walk = (nodes: ChecklistItem[]) => {
    for (const node of nodes) {
      total += 1;
      if (node.done) {
        done += 1;
      }
      walk(node.children);
    }
  };
  walk(items);
  return { done, total };
};

const mapTree = (
  items: ChecklistItem[],
  fn: (item: ChecklistItem) => ChecklistItem,
): ChecklistItem[] => items.map((item) => fn({ ...item, children: mapTree(item.children, fn) }));

export const toggleChecklistItem = (items: ChecklistItem[], id: string): ChecklistItem[] =>
  mapTree(items, (item) => (item.id === id ? { ...item, done: !item.done } : item));

export const renameChecklistItem = (
  items: ChecklistItem[],
  id: string,
  title: string,
): ChecklistItem[] =>
  mapTree(items, (item) => (item.id === id ? { ...item, title } : item));

const newItem = (title: string, id: string): ChecklistItem => ({
  id,
  title,
  done: false,
  children: [],
});

export const addChecklistItem = (
  items: ChecklistItem[],
  parentId: string | null,
  title: string,
  id: string,
): ChecklistItem[] => {
  const item = newItem(title, id);
  if (parentId === null) {
    return [...items, item];
  }
  return items.map((node) => {
    if (node.id === parentId) {
      return { ...node, children: [...node.children, item] };
    }
    return { ...node, children: addChecklistItem(node.children, parentId, title, id) };
  });
};

export const insertChecklistSiblingAfter = (
  items: ChecklistItem[],
  afterId: string,
  title: string,
  id: string,
): ChecklistItem[] => {
  const item = newItem(title, id);
  const index = items.findIndex((node) => node.id === afterId);
  if (index >= 0) {
    const next = [...items];
    next.splice(index + 1, 0, item);
    return next;
  }
  return items.map((node) => ({
    ...node,
    children: insertChecklistSiblingAfter(node.children, afterId, title, id),
  }));
};

export const removeChecklistItem = (items: ChecklistItem[], id: string): ChecklistItem[] => {
  const result: ChecklistItem[] = [];
  for (const node of items) {
    if (node.id === id) {
      result.push(...node.children);
      continue;
    }
    result.push({ ...node, children: removeChecklistItem(node.children, id) });
  }
  return result;
};

/** Returns true if `ancestorId` is `nodeId` or an ancestor of it. */
export const isDescendantOrSelf = (
  items: ChecklistItem[],
  ancestorId: string,
  nodeId: string,
): boolean => {
  if (ancestorId === nodeId) {
    return true;
  }
  const find = (nodes: ChecklistItem[]): ChecklistItem | null => {
    for (const node of nodes) {
      if (node.id === ancestorId) {
        return node;
      }
      const nested = find(node.children);
      if (nested) {
        return nested;
      }
    }
    return null;
  };
  const ancestor = find(items);
  if (!ancestor) {
    return false;
  }
  const contains = (nodes: ChecklistItem[]): boolean =>
    nodes.some((n) => n.id === nodeId || contains(n.children));
  return contains(ancestor.children);
};

export const findChecklistItem = (
  items: ChecklistItem[],
  id: string,
): ChecklistItem | null => {
  for (const node of items) {
    if (node.id === id) {
      return node;
    }
    const nested = findChecklistItem(node.children, id);
    if (nested) {
      return nested;
    }
  }
  return null;
};

const extractItem = (
  items: ChecklistItem[],
  id: string,
): { tree: ChecklistItem[]; extracted: ChecklistItem | null } => {
  let extracted: ChecklistItem | null = null;
  const tree: ChecklistItem[] = [];
  for (const node of items) {
    if (node.id === id) {
      extracted = node;
      continue;
    }
    const childResult = extractItem(node.children, id);
    if (childResult.extracted) {
      extracted = childResult.extracted;
    }
    tree.push({ ...node, children: childResult.tree });
  }
  return { tree, extracted };
};

const insertAt = (
  items: ChecklistItem[],
  targetId: string,
  position: ChecklistDropPosition,
  item: ChecklistItem,
): ChecklistItem[] | null => {
  if (position === "into") {
    let found = false;
    const mapped = items.map((node) => {
      if (node.id === targetId) {
        found = true;
        return { ...node, children: [...node.children, item] };
      }
      const children = insertAt(node.children, targetId, position, item);
      if (children) {
        found = true;
        return { ...node, children };
      }
      return node;
    });
    return found ? mapped : null;
  }

  const index = items.findIndex((node) => node.id === targetId);
  if (index >= 0) {
    const next = [...items];
    next.splice(position === "before" ? index : index + 1, 0, item);
    return next;
  }

  let found = false;
  const mapped = items.map((node) => {
    const children = insertAt(node.children, targetId, position, item);
    if (children) {
      found = true;
      return { ...node, children };
    }
    return node;
  });
  return found ? mapped : null;
};

export const moveChecklistItem = (
  items: ChecklistItem[],
  id: string,
  targetId: string,
  position: ChecklistDropPosition,
): ChecklistItem[] => {
  if (id === targetId) {
    return items;
  }
  // Cannot drop onto self or into/onto a descendant.
  if (isDescendantOrSelf(items, id, targetId)) {
    return items;
  }

  const { tree, extracted } = extractItem(items, id);
  if (!extracted) {
    return items;
  }
  const inserted = insertAt(tree, targetId, position, extracted);
  return inserted ?? items;
};

export const indentChecklistItem = (items: ChecklistItem[], id: string): ChecklistItem[] => {
  const tryIndent = (nodes: ChecklistItem[]): ChecklistItem[] | null => {
    const index = nodes.findIndex((n) => n.id === id);
    if (index > 0) {
      const prev = nodes[index - 1];
      const current = nodes[index];
      const next = [...nodes];
      next.splice(index, 1);
      next[index - 1] = { ...prev, children: [...prev.children, current] };
      return next;
    }
    let changed: ChecklistItem[] | null = null;
    const mapped = nodes.map((node) => {
      const children = tryIndent(node.children);
      if (children) {
        changed = children;
        return { ...node, children };
      }
      return node;
    });
    return changed ? mapped : null;
  };
  return tryIndent(items) ?? items;
};

export const outdentChecklistItem = (items: ChecklistItem[], id: string): ChecklistItem[] => {
  const tryOutdent = (nodes: ChecklistItem[]): ChecklistItem[] | null => {
    for (let i = 0; i < nodes.length; i += 1) {
      const node = nodes[i];
      const childIndex = node.children.findIndex((c) => c.id === id);
      if (childIndex >= 0) {
        const child = node.children[childIndex];
        const remainingChildren = [
          ...node.children.slice(0, childIndex),
          ...node.children.slice(childIndex + 1),
        ];
        const updatedParent = { ...node, children: remainingChildren };
        const next = [...nodes];
        next[i] = updatedParent;
        next.splice(i + 1, 0, child);
        return next;
      }
      const nested = tryOutdent(node.children);
      if (nested) {
        const next = [...nodes];
        next[i] = { ...node, children: nested };
        return next;
      }
    }
    return null;
  };
  return tryOutdent(items) ?? items;
};
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `npx vitest run tests/unit/checklist-tree.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/tracker/tasks/checklist-tree.ts tests/unit/checklist-tree.test.ts
git commit -m "$(cat <<'EOF'
feat(tracker): add checklist tree helpers and tests

EOF
)"
```

---

### Task 3: Tree helpers — indent, outdent, move

**Files:**
- Modify: `tests/unit/checklist-tree.test.ts`
- Modify: `src/components/tracker/tasks/checklist-tree.ts` (already has impl from Task 2 — only add tests)

- [ ] **Step 1: Append failing tests**

```ts
import {
  // ...existing
  indentChecklistItem,
  moveChecklistItem,
  outdentChecklistItem,
} from "@/components/tracker/tasks/checklist-tree";

describe("indentChecklistItem", () => {
  it("nests under the previous sibling", () => {
    const next = indentChecklistItem(sample(), "a2");
    expect(next[0].children.map((c) => c.id)).toEqual(["a1"]);
    expect(next[0].children[0].children.map((c) => c.id)).toEqual(["a2"]);
  });

  it("no-ops for the first child", () => {
    expect(indentChecklistItem(sample(), "a1")).toEqual(sample());
  });
});

describe("outdentChecklistItem", () => {
  it("lifts the item after its parent", () => {
    const next = outdentChecklistItem(sample(), "a1");
    expect(next.map((c) => c.id)).toEqual(["a", "a1", "b"]);
    expect(next[0].children.map((c) => c.id)).toEqual(["a2"]);
  });
});

describe("moveChecklistItem", () => {
  it("moves before a target", () => {
    const next = moveChecklistItem(sample(), "b", "a", "before");
    expect(next.map((c) => c.id)).toEqual(["b", "a"]);
  });

  it("moves into a target", () => {
    const next = moveChecklistItem(sample(), "b", "a", "into");
    expect(next).toHaveLength(1);
    expect(next[0].children.map((c) => c.id)).toEqual(["a1", "a2", "b"]);
  });

  it("rejects move into a descendant", () => {
    const next = moveChecklistItem(sample(), "a", "a1", "into");
    expect(next).toEqual(sample());
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run tests/unit/checklist-tree.test.ts`

Expected: PASS (implementation already in Task 2). If FAIL, fix helpers until green.

- [ ] **Step 3: Commit**

```bash
git add tests/unit/checklist-tree.test.ts src/components/tracker/tasks/checklist-tree.ts
git commit -m "$(cat <<'EOF'
test(tracker): cover checklist indent, outdent, and move

EOF
)"
```

---

### Task 4: `TaskChecklist` UI (no DnD yet)

**Files:**
- Create: `src/components/tracker/tasks/task-checklist.tsx`

- [ ] **Step 1: Create component**

```tsx
"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ChevronDown, ChevronRight, GripVertical, Plus } from "lucide-react";
import type { ChecklistItem } from "@/components/home/tasks-today-demo-data";
import {
  addChecklistItem,
  countChecklist,
  indentChecklistItem,
  insertChecklistSiblingAfter,
  outdentChecklistItem,
  removeChecklistItem,
  renameChecklistItem,
  toggleChecklistItem,
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
  const inputRef = useRef<HTMLInputElement | null>(null);
  const skipBlurCommitRef = useRef(false);

  useEffect(() => {
    if (!focusId) {
      return;
    }
    setEditingId(focusId);
    const node = items && findTitle(items, focusId);
    setDraft(node?.title ?? "");
    // focus after paint
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
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      // ensure roots visible
      return next;
    });
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
            className="group flex items-center gap-1 rounded-md px-1 py-0.5 hover:bg-muted/60"
            style={{ paddingLeft: depth * 16 }}
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
              className="flex size-5 cursor-grab items-center justify-center text-muted-foreground opacity-0 group-hover:opacity-100"
              aria-hidden
              data-checklist-drag-handle
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

const findTitle = (nodes: ChecklistItem[], id: string): ChecklistItem | null => {
  for (const node of nodes) {
    if (node.id === id) {
      return node;
    }
    const nested = findTitle(node.children, id);
    if (nested) {
      return nested;
    }
  }
  return null;
};
```

Optional: import `findChecklistItem` from `checklist-tree` and delete local `findTitle`.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`

Expected: PASS (component unused until Task 5 is ok, or wire a temporary import — prefer unused export until Task 5).

- [ ] **Step 3: Commit**

```bash
git add src/components/tracker/tasks/task-checklist.tsx
git commit -m "$(cat <<'EOF'
feat(tracker): add TaskChecklist panel component

EOF
)"
```

---

### Task 5: Wire expand row into `TasksListView`

**Files:**
- Modify: `src/components/tracker/tasks/tasks-list-view.tsx`

- [ ] **Step 1: Imports and expand state**

```ts
import { TaskChecklist } from "@/components/tracker/tasks/task-checklist";
import { countChecklist } from "@/components/tracker/tasks/checklist-tree";
```

```ts
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
```

- [ ] **Step 2: Title cell — chevron + progress**

Inside the task row title cell, before the color dot / title button, add expand control + optional badge. Structure:

```tsx
<div className="flex min-w-0 items-center gap-2">
  <button
    type="button"
    className="flex size-5 shrink-0 items-center justify-center text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
    onClick={(event) => {
      event.stopPropagation();
      toggleTaskExpanded(task.id);
    }}
    aria-expanded={expandedTaskIds.has(task.id)}
    aria-label={
      expandedTaskIds.has(task.id) ? "Collapse checklist" : "Expand checklist"
    }
  >
    {expandedTaskIds.has(task.id) ? (
      <ChevronDown className="size-4" aria-hidden />
    ) : (
      <ChevronRight className="size-4" aria-hidden />
    )}
  </button>
  <span
    aria-hidden
    className={cn("size-2 shrink-0 rounded-full", COLOR_CLASS_BY_TASK[task.color])}
  />
  {/* existing title edit / button */}
  {(() => {
    const { done, total } = countChecklist(task.checklist ?? []);
    if (total === 0) {
      return null;
    }
    return (
      <button
        type="button"
        className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground outline-none hover:bg-muted/80 focus-visible:ring-2 focus-visible:ring-ring"
        onClick={(event) => {
          event.stopPropagation();
          expandTask(task.id);
        }}
        aria-label={`Checklist progress ${done} of ${total}`}
      >
        {done}/{total}
      </button>
    );
  })()}
</div>
```

- [ ] **Step 3: Expanded `colSpan` row**

After each task `TableRow`, when expanded:

```tsx
{expandedTaskIds.has(task.id) ? (
  <TableRow key={`${task.id}-checklist`} className="bg-muted/20 hover:bg-muted/20">
    <TableCell colSpan={5} className="px-3 py-3 pl-12">
      <TaskChecklist
        items={task.checklist ?? []}
        onChange={(checklist) => updateTask(task.id, { checklist })}
      />
    </TableCell>
  </TableRow>
) : null}
```

Wrap the task row + checklist row in a `Fragment` with `key={task.id}` (move `key` off the task row onto the Fragment).

- [ ] **Step 4: Stop checklist panel from starting stage drag**

On the expanded checklist `TableRow` / cell wrapper:

```tsx
onDragStart={(event) => event.preventDefault()}
```

Keep task row `draggable` as today.

- [ ] **Step 5: Manual smoke + typecheck**

Run: `npm run typecheck`

Open: `http://localhost:3000/tracker/tasks?scope=space-it&view=table`

Check: expand `Complete pre-release checklist`, toggle items, progress updates, Add item, Tab indent.

- [ ] **Step 6: Commit**

```bash
git add src/components/tracker/tasks/tasks-list-view.tsx
git commit -m "$(cat <<'EOF'
feat(tracker): expand task rows to show nested checklists

EOF
)"
```

---

### Task 6: HTML5 DnD for checklist items

**Files:**
- Modify: `src/components/tracker/tasks/task-checklist.tsx`

- [ ] **Step 1: Add drag state and drop zones**

At top of `TaskChecklist`:

```ts
import {
  // existing imports...
  moveChecklistItem,
  type ChecklistDropPosition,
} from "@/components/tracker/tasks/checklist-tree";
import type { DragEvent } from "react";

const [draggingId, setDraggingId] = useState<string | null>(null);
const [dropTarget, setDropTarget] = useState<{
  id: string;
  position: ChecklistDropPosition;
} | null>(null);
```

On each item row container:

```tsx
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
```

Make the **grip** the draggable source:

```tsx
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
  className="..."
  data-checklist-drag-handle
  role="button"
  aria-label="Drag checklist item"
>
  <GripVertical className="size-3.5" />
</span>
```

Wire `onDragOver` / `onDrop` / `onDragLeave` on the item row. Visuals:

```tsx
className={cn(
  "group flex items-center gap-1 rounded-md px-1 py-0.5 hover:bg-muted/60",
  draggingId === item.id && "opacity-50",
  dropTarget?.id === item.id && dropTarget.position === "into" && "ring-2 ring-primary/40",
  dropTarget?.id === item.id &&
    dropTarget.position === "before" &&
    "border-t-2 border-primary",
  dropTarget?.id === item.id &&
    dropTarget.position === "after" &&
    "border-b-2 border-primary",
)}
```

- [ ] **Step 2: Manual verify DnD**

On seeded `task-8`: drag “Notify stakeholders” into “Pre-flight”; drag “Unit tests” before “Typecheck”; attempt drag parent into child — no change.

Confirm stage drag of a collapsed task still works.

- [ ] **Step 3: Typecheck + unit tests**

Run:

```bash
npm run typecheck
npx vitest run tests/unit/checklist-tree.test.ts
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/tracker/tasks/task-checklist.tsx
git commit -m "$(cat <<'EOF'
feat(tracker): drag-and-drop reorder nested checklist items

EOF
)"
```

---

### Task 7: Polish + verification

**Files:**
- Modify only if smoke finds bugs: `task-checklist.tsx`, `tasks-list-view.tsx`

- [ ] **Step 1: Manual checklist on `?scope=space-it&view=table`**

- [ ] Expand/collapse chevron on task row
- [ ] Progress badge `done/total` visible on seeded tasks; click expands
- [ ] Toggle checkbox updates badge without cascade
- [ ] Rename, Enter adds sibling, Tab/Shift+Tab indent/outdent
- [ ] Add item / Add child / empty placeholder
- [ ] Delete empty title with Backspace; delete parent promotes children
- [ ] DnD before / after / into; reject into descendant
- [ ] Stage DnD still moves tasks between Questions / Tasks
- [ ] English labels only (`Checklist`, `Add item`, `Add checklist item…`)

- [ ] **Step 2: Project checks**

```bash
npm run typecheck
npm run test
npm run check:ui-english
```

Expected: PASS (or pre-existing failures unrelated — do not expand scope)

- [ ] **Step 3: Final commit if polish edits exist**

```bash
git add src/components/tracker/tasks/task-checklist.tsx \
  src/components/tracker/tasks/tasks-list-view.tsx
git commit -m "$(cat <<'EOF'
fix(tracker): polish nested checklist table interactions

EOF
)"
```

Skip this commit if the working tree is clean.

---

## Spec coverage (self-review)

| Spec requirement | Task |
|------------------|------|
| Expand row + colSpan checklist | 5 |
| Single tree, unlimited nesting | 1–4 |
| Independent checkboxes | 2, 4 |
| Progress all nodes + badge | 2, 5 |
| Add / rename / delete / indent / outdent | 2–4 |
| HTML5 DnD before/after/into + cycle guard | 2, 3, 6 |
| Demo seed depth ≥ 3 | 1 |
| Soft-delete / cascade / module page | Out of scope — no tasks |
| Tests for tree helpers | 2, 3 |

**Placeholder scan:** clean.

**Type consistency:** `ChecklistItem`, `ChecklistDropPosition`, helper names match across tasks; create sites all set `checklist: []`. Simplify: Task 2 ships full helper file including indent/outdent/move; Task 3 only adds tests.

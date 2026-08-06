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

export const extractChecklistSubtree = (
  items: ChecklistItem[],
  id: string,
): { next: ChecklistItem[]; node: ChecklistItem | null } => {
  const { tree, extracted } = extractItem(items, id);
  return { next: tree, node: extracted };
};

export const insertChecklistSubtree = (
  items: ChecklistItem[],
  node: ChecklistItem,
  targetId: string | null,
  position: ChecklistDropPosition,
): ChecklistItem[] => {
  if (targetId === null) {
    return [...items, node];
  }
  if (findChecklistItem(items, node.id)) {
    return items;
  }
  if (isDescendantOrSelf(items, node.id, targetId)) {
    return items;
  }
  return insertAt(items, targetId, position, node) ?? items;
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
    let changed = false;
    const mapped = nodes.map((node) => {
      const children = tryIndent(node.children);
      if (children) {
        changed = true;
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

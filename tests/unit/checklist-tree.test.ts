import { describe, expect, it } from "vitest";
import type { ChecklistItem } from "@/components/home/tasks-today-demo-data";
import {
  addChecklistItem,
  countChecklist,
  extractChecklistSubtree,
  indentChecklistItem,
  insertChecklistSiblingAfter,
  insertChecklistSubtree,
  moveChecklistItem,
  outdentChecklistItem,
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

describe("extractChecklistSubtree", () => {
  it("removes node with children intact", () => {
    const { next, node } = extractChecklistSubtree(sample(), "a");
    expect(node?.id).toBe("a");
    expect(node?.children.map((c) => c.id)).toEqual(["a1", "a2"]);
    expect(next.map((c) => c.id)).toEqual(["b"]);
  });

  it("returns null node when missing", () => {
    const { next, node } = extractChecklistSubtree(sample(), "missing");
    expect(node).toBeNull();
    expect(next).toEqual(sample());
  });
});

describe("insertChecklistSubtree", () => {
  it("appends at root when targetId is null", () => {
    const node = { id: "x", title: "X", done: false, children: [] };
    const next = insertChecklistSubtree(sample(), node, null, "into");
    expect(next.map((c) => c.id)).toEqual(["a", "b", "x"]);
  });

  it("inserts before / after / into", () => {
    const node = { id: "x", title: "X", done: false, children: [] };
    expect(insertChecklistSubtree(sample(), node, "b", "before").map((c) => c.id)).toEqual([
      "a",
      "x",
      "b",
    ]);
    expect(
      insertChecklistSubtree(sample(), node, "a", "into")[0].children.map((c) => c.id),
    ).toEqual(["a1", "a2", "x"]);
    expect(insertChecklistSubtree(sample(), node, "a", "after").map((c) => c.id)).toEqual([
      "a",
      "x",
      "b",
    ]);
  });

  it("rejects insert when node id already exists in tree", () => {
    const dup = sample()[0];
    expect(insertChecklistSubtree(sample(), dup, "b", "before")).toEqual(sample());
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

describe("cross-tree move and promote mapping", () => {
  it("moves a subtree into another tree", () => {
    const source = sample();
    const target: ChecklistItem[] = [{ id: "t", title: "T", done: false, children: [] }];
    const { next: sourceNext, node } = extractChecklistSubtree(source, "a");
    expect(node).not.toBeNull();
    const targetNext = insertChecklistSubtree(target, node!, "t", "into");
    expect(sourceNext.map((c) => c.id)).toEqual(["b"]);
    expect(targetNext[0].children.map((c) => c.id)).toEqual(["a"]);
    expect(targetNext[0].children[0].children.map((c) => c.id)).toEqual(["a1", "a2"]);
  });

  it("maps promoted item children to a new checklist", () => {
    const { next: sourceNext, node } = extractChecklistSubtree(sample(), "a");
    expect(node).not.toBeNull();
    const newTaskChecklist = node!.children;
    expect(sourceNext.map((c) => c.id)).toEqual(["b"]);
    expect(newTaskChecklist.map((c) => c.id)).toEqual(["a1", "a2"]);
  });
});

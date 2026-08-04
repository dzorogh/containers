import { describe, expect, it } from "vitest";
import type { ChecklistItem } from "@/components/home/tasks-today-demo-data";
import {
  addChecklistItem,
  countChecklist,
  indentChecklistItem,
  insertChecklistSiblingAfter,
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

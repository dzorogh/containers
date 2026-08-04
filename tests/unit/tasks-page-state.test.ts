import { describe, expect, it } from "vitest";
import {
  buildTasksHref,
  getBreadcrumbSegments,
  isSpaceScope,
  parseTasksPageState,
} from "@/features/tracker/tasks/tasks-page-state";

describe("isSpaceScope", () => {
  it("returns true for space scopes", () => {
    expect(isSpaceScope("space-it")).toBe(true);
    expect(isSpaceScope("space-holding")).toBe(true);
  });

  it("returns false for all/today", () => {
    expect(isSpaceScope("all")).toBe(false);
    expect(isSpaceScope("today")).toBe(false);
  });
});

describe("parseTasksPageState", () => {
  it("accepts view=overview for space scope", () => {
    const state = parseTasksPageState(
      new URLSearchParams("scope=space-it&view=overview"),
    );
    expect(state).toEqual({ scope: "space-it", view: "overview" });
  });

  it("falls back overview to table when scope is not a space", () => {
    const state = parseTasksPageState(
      new URLSearchParams("scope=all&view=overview"),
    );
    expect(state).toEqual({ scope: "all", view: "table" });
  });
});

describe("buildTasksHref", () => {
  it("includes overview view", () => {
    expect(buildTasksHref({ scope: "space-it", view: "overview" })).toBe(
      "/tracker/tasks?scope=space-it&view=overview",
    );
  });
});

describe("getBreadcrumbSegments", () => {
  it("appends Overview for space overview view", () => {
    const labels = getBreadcrumbSegments("space-it", "overview").map((s) => s.label);
    expect(labels.at(-1)).toBe("Overview");
    expect(labels).toContain("IT");
  });

  it("does not append Overview for table view", () => {
    const labels = getBreadcrumbSegments("space-it", "table").map((s) => s.label);
    expect(labels.at(-1)).not.toBe("Overview");
  });
});

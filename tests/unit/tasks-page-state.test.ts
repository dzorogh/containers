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
  it("accepts table and calendar views", () => {
    expect(parseTasksPageState(new URLSearchParams("scope=space-it&view=table"))).toEqual({
      scope: "space-it",
      view: "table",
    });
    expect(parseTasksPageState(new URLSearchParams("scope=space-it&view=calendar"))).toEqual({
      scope: "space-it",
      view: "calendar",
    });
  });

  it("falls back unknown views to calendar", () => {
    expect(parseTasksPageState(new URLSearchParams("scope=space-it&view=overview"))).toEqual({
      scope: "space-it",
      view: "calendar",
    });
  });
});

describe("buildTasksHref", () => {
  it("includes view query", () => {
    expect(buildTasksHref({ scope: "space-it", view: "table" })).toBe(
      "/tracker/tasks?scope=space-it&view=table",
    );
  });
});

describe("getBreadcrumbSegments", () => {
  it("includes space labels without Overview crumb", () => {
    const labels = getBreadcrumbSegments("space-it", "table").map((s) => s.label);
    expect(labels).toContain("IT");
    expect(labels).not.toContain("Overview");
  });
});

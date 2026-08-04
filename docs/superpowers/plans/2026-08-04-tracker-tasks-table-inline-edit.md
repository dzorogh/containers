# Tracker Tasks Table Inline Edit — Implementation Plan

> **For agentic workers:** Implement task-by-task. Steps use checkbox (`- [ ]`) syntax. Spec: `docs/superpowers/specs/2026-08-04-tracker-tasks-table-inline-edit-design.md`.

**Goal:** Excel-lite inline edit (Title / Priority / Deadline / Assignee), always-visible quick-add row, remove Project column. Shared demo state with calendar.

---

## Task 1: Export shared demo helpers

**Files:**
- Modify: `src/components/home/tasks-today-demo-data.ts`

- [x] Export demo assignees list (+ Unassigned helper / avatar URL builder)
- [x] Export `formatDeadlineLabel` (or thin wrapper) for deadline cell edits — reuse calendar-utils
- [x] Keep existing `DEMO_REFERENCE_NOW` usable for “today” defaults

---

## Task 2: Editable table view

**Files:**
- Modify: `src/components/tracker/tasks/tasks-list-view.tsx`
- Optional: `src/components/tracker/tasks/tasks-table-cells.tsx`

- [x] Props: `tasks`, `onTasksChange`, `spaceId` (for inline create)
- [x] Columns: checkbox | Title | Priority | Deadline | Assignee (no Project)
- [x] Always show table + empty add row (even when `tasks.length === 0`)
- [x] Active cell state; Title input with Enter / blur commit, Esc cancel
- [x] Priority Select; Deadline date input; Assignee Select
- [x] Tab / Shift+Tab across editable cells and rows (including add row)
- [x] Add row: Enter/blur with non-empty title → append task with defaults, focus new empty Title
- [x] English labels only

---

## Task 3: Wire page

**Files:**
- Modify: `app/tracker/tasks/page.tsx`

- [x] Pass `onTasksChange={handleVisibleTasksChange}` and create `spaceId` into `TasksListView`
- [x] Keep toolbar create dialog unchanged

---

## Task 4: Verify

- [x] `npm run typecheck` (or project equivalent) on touched files
- [x] Manual: quick-add Enter + title click-to-edit verified in browser; Project column gone; Select simplified for hydration

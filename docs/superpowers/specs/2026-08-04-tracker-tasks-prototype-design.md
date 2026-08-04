# Tracker Tasks Prototype — Design Spec

**Date:** 2026-08-04  
**Status:** Approved for implementation planning  
**Surface:** `/tracker/tasks`

## Goal

Evolve the existing Tasks prototype toward a Tracker-like shell: hybrid left aside, full page header with view switching, and a simple table list view alongside the existing month calendar. Demo/static only — no backend.

## Decisions

| Topic | Choice |
|-------|--------|
| Aside model | Hybrid (C): keep Tracker modules nav, add My Tasks / Favorites / Spaces below |
| Header | Full screenshot-style header (A): breadcrumb, title, view tabs, + Task, Add filter row |
| List view | Compact table (A): checkbox, title, project, priority, deadline, assignee |
| Aside ↔ view sync | Option A: My Tasks “Calendar” sets `view=calendar`; All Tasks / For Today open table with scope |
| State | URL query params (approach 1) |
| UI language | English (project convention) |

## Architecture

### URL state

```
/tracker/tasks?scope=<scope>&view=<view>
```

- `scope`: `all` | `today` | `space-it` | `space-management` | `space-qa` | … (demo ids)
- `view`: `table` | `calendar`
- Defaults when params missing: `scope=all`, `view=calendar` (matches current prototype landing)
- All Tasks / For Today always set `view=table`

### Shell wiring

- `app/tracker/layout.tsx` passes `asideContent={<TrackerAsideContent />}` into `ModuleShell`.
- `nav-rail.tsx` rail flyout + mobile overlay for `/tracker` reuse the same `TrackerAsideContent` (Team/Store pattern).

### Page orchestration

`app/tracker/tasks/page.tsx`:

1. Read `scope` / `view` from `useSearchParams`.
2. Filter shared task list by scope.
3. Render breadcrumb + `TasksToolbar` + `TasksListView` **or** `TasksMonthCalendar`.
4. Lift task list state so list and calendar share the same in-session demo data.

## Aside (`TrackerAsideContent`)

Top → bottom:

1. **Modules** — existing `TRACKER_SUBNAV_ITEMS` via `ModuleSubnav`.
2. **My Tasks**
   - All Tasks → `?scope=all&view=table`
   - For Today → `?scope=today&view=table`
   - Calendar → keep current `scope`, set `view=calendar`
3. **Favorites** — section title + “Add to favorites” button (no persistence).
4. **Spaces** — demo tree, e.g. Holding → Management / IT / QA; extra flat spaces; “Add space” placeholder.
   - Space click → `?scope=<spaceId>`, keep current `view`.

Active styles from pathname + query. Holding expand/collapse is local UI state (no persistence required).

## Header (`TasksToolbar`)

**Breadcrumb** (outside white card, on `bg-muted/30`):

- Space scope: `Tracker / Holding / {Space name}`
- My Tasks all/today: `Tracker / My Tasks` (append `/ Calendar` when `view=calendar` and scope is all/today)

**Toolbar card rows:**

1. Title (from scope) + view tabs: Table | Board (disabled, “Coming soon”) | Calendar | “+” view (disabled) | primary **+ Task**
2. “+ Add filter” (stub) + decorative utility icons (Search, Layout, More, Refresh). Refresh may call `router.refresh()`; others are visual only.

Space Settings / Project Settings remain available (secondary outline buttons or under More) so existing modals stay reachable.

**+ Task:** opens the existing calendar quick-create flow when `view=calendar`; in table view opens a minimal create dialog or reuses the same dialog with today’s date.

View tab clicks update `view` while preserving `scope`.

## List view (`TasksListView`)

Columns:

| Checkbox | Title | Project | Priority | Deadline | Assignee |
|----------|-------|---------|----------|----------|----------|

- Checkbox: local selection only (no bulk actions).
- Title shows existing color indicator.
- Priority: High / Medium / Low badge.
- Deadline: existing `deadlineLabel`.
- Assignee: demo `assigneeName` + `i.pravatar.cc` avatar.
- Empty: “No tasks in this view”.
- Row title click: soft navigation or toast; `?task=` may be kept for continuity without a full detail panel.

## Calendar view

Keep `TasksMonthCalendar` behavior (drag between days, time edit, quick create, view settings). Feed it the same filtered task array for the active scope. Do not redesign the grid in this iteration.

## Data model (demo)

Extend `TodayTask` (or parallel tracker demo type) with:

- `assigneeName: string`
- `assigneeAvatarUrl: string` (pravatar)
- `spaceId: string` (e.g. `space-it`)

Filtering:

- `all` — all tasks
- `today` — deadline on demo “today” (`DEMO_REFERENCE_NOW` date)
- `space-*` — `task.spaceId === scope`

## File plan

| Path | Action |
|------|--------|
| `src/features/tracker/tracker-aside-content.tsx` | Add |
| `src/features/tracker/tasks/tasks-page-state.ts` | Add (parse scope/view, labels, href builders) |
| `src/components/tracker/tasks/tasks-list-view.tsx` | Add |
| `src/components/tracker/tasks/tasks-toolbar.tsx` | Expand |
| `app/tracker/tasks/page.tsx` | Orchestrate views + query |
| `app/tracker/layout.tsx` | Wire asideContent |
| `src/components/layout/nav-rail.tsx` | Tracker flyout/mobile → TrackerAsideContent |
| `src/components/home/tasks-today-demo-data.ts` (or tracker demo) | assignee + spaceId |

## Out of scope

- Real filter builder logic
- Board view implementation
- Favorites persistence / Add space / Add view
- Task detail page / API / auth
- Russian UI copy
- Changing global nav-rail icon set to match external screenshot pixel-perfectly

## Verification

```bash
npm run lint
npm run typecheck
npm run check:ui-english
npm run check:static-images
```

Manual: switch Table ↔ Calendar; click All Tasks / For Today / Calendar / Space IT; confirm breadcrumb, title, and filtered rows/cells update via URL.

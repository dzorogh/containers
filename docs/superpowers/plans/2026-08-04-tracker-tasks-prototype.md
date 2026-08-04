# Tracker Tasks Prototype — Implementation Plan

> **For agentic workers:** Implement task-by-task. Steps use checkbox (`- [ ]`) syntax. Do not skip verification. Spec: `docs/superpowers/specs/2026-08-04-tracker-tasks-prototype-design.md`.

**Goal:** Hybrid Tracker aside + screenshot-style tasks header + Table/Calendar view switch via URL + simple tasks table.

**Tech note:** Prefer `nuqs` only if already used in repo; otherwise `useSearchParams` + `useRouter` from Next.js (match existing patterns).

---

## Task 1: Demo data — assignee + spaceId

**Files:**
- Modify: `src/components/home/tasks-today-demo-data.ts`

- [ ] Extend `TodayTask` with `assigneeName`, `assigneeAvatarUrl`, `spaceId`
- [ ] In `createTask`, accept/assign these fields; use `https://i.pravatar.cc/40?u=<id>` for avatars
- [ ] Map existing tasks to demo spaces (`space-it`, `space-management`, `space-qa`, etc.) so Space IT filter returns a non-empty set
- [ ] Export `DEMO_REFERENCE_NOW` (or a helper `isTaskDueOnDemoToday`) if needed for `scope=today` filtering
- [ ] Run typecheck on touched file

---

## Task 2: URL state helpers

**Files:**
- Create: `src/features/tracker/tasks/tasks-page-state.ts`

- [ ] Define types: `TasksScope`, `TasksView` (`table` | `calendar`)
- [ ] `parseTasksPageState(searchParams)` → `{ scope, view }` with defaults `all` / `calendar`
- [ ] `buildTasksHref({ scope, view })` → `/tracker/tasks?...`
- [ ] Labels: `getScopeTitle(scope)`, `getBreadcrumbSegments(scope, view)`
- [ ] `filterTasksByScope(tasks, scope)` implementing all / today / space-*
- [ ] Demo spaces constant used by aside + breadcrumbs (Holding children + flat spaces)

---

## Task 3: Tracker aside content

**Files:**
- Create: `src/features/tracker/tracker-aside-content.tsx`
- Modify: `app/tracker/layout.tsx`
- Modify: `src/components/layout/nav-rail.tsx`

- [ ] Build `TrackerAsideContent` (optional `onItemClick`) mirroring Team aside section titles:
  1. Modules → `ModuleSubnav` + `TRACKER_SUBNAV_ITEMS`
  2. My Tasks → Links using `buildTasksHref`
  3. Favorites → stub “Add to favorites”
  4. Spaces → Holding tree + flat spaces + stub “Add space”
- [ ] Active item: compare current searchParams scope/view (and pathname for module links)
- [ ] Calendar link: preserve scope, set `view=calendar`
- [ ] Space link: set scope, preserve view
- [ ] Wire `asideContent` in `app/tracker/layout.tsx`
- [ ] In `nav-rail.tsx`: RailFlyout for `/tracker` and mobile overlay use `TrackerAsideContent` (same as Pulse/Team)

---

## Task 4: Tasks list view

**Files:**
- Create: `src/components/tracker/tasks/tasks-list-view.tsx`

- [ ] Table columns: checkbox | title (+ color dot) | project | priority badge | deadline | assignee (avatar + name)
- [ ] Local checkbox selection state only
- [ ] Empty state copy: “No tasks in this view”
- [ ] Title click: `toast` or Link with existing `href` / `?task=`
- [ ] English labels only

---

## Task 5: Expand TasksToolbar

**Files:**
- Modify: `src/components/tracker/tasks/tasks-toolbar.tsx`

- [ ] Props: `title`, `scope`, `view`, `onViewChange` (or hrefs), `onAddTask`, settings callbacks
- [ ] Row 1: title + tabs Table / Board(disabled) / Calendar / +(disabled) + primary “+ Task”
- [ ] Row 2: “+ Add filter” stub + utility icon buttons (Search, Layout, More, Refresh)
- [ ] Keep Space Settings / Project Settings reachable (outline buttons or More menu)
- [ ] Use `HomeFilterChip` or equivalent tab pattern from Thanks toolbar

---

## Task 6: Page orchestration + shared task state

**Files:**
- Modify: `app/tracker/tasks/page.tsx`
- Modify: `src/components/tracker/tasks/calendar/tasks-month-calendar.tsx` (only if needed to accept controlled tasks / expose create)

- [ ] `useSearchParams` → parse state; breadcrumb from helpers
- [ ] `useState` for tasks initialized from `ALL_TASKS`; filter by scope for display
- [ ] Conditionally render `TasksListView` vs `TasksMonthCalendar`
- [ ] View tab / toolbar updates URL via `router.replace` preserving the other param
- [ ] `+ Task`: calendar view → trigger calendar quick-create (expose callback/prop if needed); table view → simple dialog that appends a demo task
- [ ] Pass filtered tasks into calendar; sync calendar mutations back to page state (lift state or `onTasksChange`)

**Calendar state lift (minimal):** Prefer adding optional `tasks` + `onTasksChange` props to `TasksMonthCalendar` while keeping internal state fallback if unset — or always controlled from page. Choose controlled-from-page for shared list/calendar.

---

## Task 7: Verification

- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm run check:ui-english`
- [ ] `npm run check:static-images`
- [ ] Manual smoke:
  - `/tracker/tasks` → calendar, aside hybrid
  - Table tab → list columns populated
  - All Tasks / For Today / Space IT → title, breadcrumb, filter
  - Aside Calendar preserves scope
  - Rail flyout + mobile show rich Tracker aside
  - Space/Project settings modals still open

---

## Dependency order

```
Task 1 (data) → Task 2 (state helpers) → Task 3 (aside) + Task 4 (list) + Task 5 (toolbar)
                                        ↘
                                      Task 6 (page) → Task 7 (verify)
```

Tasks 3–5 can proceed in parallel after Task 2.

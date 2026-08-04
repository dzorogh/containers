# Tracker Task Open Modal Design Spec

**Date:** 2026-08-04  
**Status:** Approved for implementation planning  
**Surface:** `/tracker/tasks?view=table` → `/tracker/tasks/[taskId]`  
**Related:**
- [2026-08-04-tracker-tasks-prototype-design.md](./2026-08-04-tracker-tasks-prototype-design.md)
- [2026-08-04-tracker-tasks-table-inline-edit-design.md](./2026-08-04-tracker-tasks-table-inline-edit-design.md)

## Goal

Add an explicit **Open task** control on each table row that navigates to a dedicated task route. The route presents a read-only detail dialog (modal) for the demo task. No edit, checklist, comments, or backend.

## Decisions

| Topic | Choice |
|-------|--------|
| Open target | Dedicated route `/tracker/tasks/[taskId]` |
| Presentation | Centered `Dialog` (modal), not sheet / side panel |
| Soft navigation overlay | No Next.js intercepting routes (`(.)`) in v1 |
| Content | Read-only: title, project, priority, deadline, assignee |
| Out of scope (v1) | Description, comments, checklist, editing, stage |
| Deep link query `?task=` | Not used; path param replaces it |
| Language | English UI labels |
| Data source | `ALL_TASKS` lookup by id (demo static) |

## Routing

### Page

- New App Router page: `app/tracker/tasks/[taskId]/page.tsx`
- Uses existing `app/tracker/layout.tsx` shell
- Background: `bg-muted/30` (same as list page)
- Dialog opens immediately (`open={true}`)

### Close behavior

- Triggers: Dialog X, Esc, overlay click, optional **Close** footer button
- Prefer `router.back()` when history exists
- Fallback: `/tracker/tasks` (default list entry)
- Do not attempt to restore prior `scope`/`view` from referrer in v1

### Links

- Table Open button → `/tracker/tasks/${task.id}`
- Update `TodayTask.href` / create helpers from `/tracker/tasks?task=…` to `/tracker/tasks/${id}` where touched
- Comment entity hrefs already use `/tracker/tasks/GP-…` style; leave unrelated surfaces alone unless create paths are edited

## UI

### Table button (`TasksListView`)

- Ghost icon button after title (and after checklist progress badge when present)
- Icon: `SquareArrowOutUpRight` (or equivalent lucide “open”)
- `aria-label="Open task"`
- Implemented as `Link` (or button + `router.push`) to `/tracker/tasks/${task.id}`
- Must not start inline title edit
- English label only (no Russian UI copy)

### Modal (`TaskDetailModal`)

Component: `src/components/tracker/tasks/task-detail-modal.tsx`

**Found task**

- Dialog width: `sm:max-w-md` (aligned with Create task / View settings)
- Header title: color dot + task title
- Description: `Project · {projectName}`
- Body fields (label + value, no inputs):
  - Priority — High / Medium / Low
  - Deadline — formatted from `deadlineAt` (fallback `deadlineLabel`)
  - Assignee — avatar + name, or Unassigned
- Footer optional: **Close**

**Not found**

- Dialog title: `Task not found`
- Short message + **Back to tasks** → `/tracker/tasks`

## Data

- Resolve: `ALL_TASKS.find((task) => task.id === taskId)`
- Tasks created only in client session state on the list page are not visible on the detail route in v1 (accepted limitation)
- No shared store / URL sync beyond the path param

## Files (expected)

| Area | Path |
|------|------|
| Route | `app/tracker/tasks/[taskId]/page.tsx` |
| Modal UI | `src/components/tracker/tasks/task-detail-modal.tsx` |
| Open control | `src/components/tracker/tasks/tasks-list-view.tsx` |
| href helpers / demo create | `tasks-today-demo-data.ts`, list/calendar create paths as needed |

## Non-goals

- Intercepting modal that keeps the table mounted underneath
- Editable fields inside the dialog
- Checklist / comments / description
- Persisting newly created session tasks into detail lookup
- Changing Board view or calendar open behavior (calendar may keep existing `?task=` until a follow-up)

## Success criteria

1. Each table task row has an accessible Open control.
2. Clicking Open navigates to `/tracker/tasks/{id}` and shows a read-only modal with title, project, priority, deadline, assignee.
3. Closing returns via history back or to `/tracker/tasks`.
4. Unknown id shows not-found dialog with back action.
5. UI copy is English; existing list conventions unchanged.

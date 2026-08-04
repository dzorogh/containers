# Tracker Project Overview View Design Spec

**Date:** 2026-08-04  
**Status:** Approved for implementation planning  
**Surface:** `/tracker/tasks?scope=space-*&view=overview`  
**Related:**
- [2026-08-04-tracker-tasks-prototype-design.md](./2026-08-04-tracker-tasks-prototype-design.md)
- Project Settings modal: `src/components/tracker/tasks/project-settings-modal.tsx`

## Goal

Add an **Overview** control in the tasks toolbar (left of view tabs, with a separator) that switches the page into a project card view: title, basic metadata, and an editable WYSIWYG description. Replaces Table / Calendar content for the current space scope. Demo-only; no backend.

## Decisions

| Topic | Choice |
|-------|--------|
| Navigation model | New `TasksView` value `"overview"` in URL (`?view=overview`) |
| Visibility | Overview button only when `scope` is a space (`space-*`); hidden for `all` / `today` |
| Invalid URL | If `view=overview` with non-space scope → treat as `table` |
| Card content | Name, Space, Status (Active/Archived), member count, WYSIWYG description |
| Editor | Lightweight TipTap (StarterKit + Placeholder + basic toolbar); **not** full `CommentEditor` |
| Persistence | In-memory React state + toast on Save; no API |
| Out of scope (v1) | Members editing, archive actions, Project Settings merge, mentions/slash/AI |
| Language | English UI labels |

## URL / state

Extend `TasksView`:

```ts
export type TasksView = "table" | "calendar" | "overview";
```

- `parseTasksPageState` accepts `view=overview`
- `buildTasksHref` passes it through
- Breadcrumb: for space scopes with `view=overview`, append `Overview` as the last crumb after the space label

`replacePageState({ view: "overview" })` same path as other views.

## Toolbar UI

File: `src/components/tracker/tasks/tasks-toolbar.tsx`

Layout in the title row (left cluster):

```
[Title]  [Overview]  |  [Table] [Board] [Calendar] [+]
```

- Overview: `HomeFilterChip`, same visual language as view tabs
- Icon: `FileText` (lucide)
- Label: `Overview`
- `active={view === "overview"}`
- `onClick` → `onViewChange("overview")`
- Render Overview + separator **only** when `showOverview` prop is true (parent: space scope)
- Vertical separator: `h-5 w-px bg-border` (or project equivalent) between Overview and the view chips
- Overview is part of the same `role="tablist"` as Table / Board / Calendar when visible, so exactly one view tab is selected

Right-side actions (Space Settings, Project Settings, Task) unchanged.

Filters row below remains visible on overview (no special hide in v1).

## Page content

File: `app/tracker/tasks/page.tsx`

When `pageState.view === "overview"` and scope is space:

- Render `ProjectOverviewCard` instead of `TasksListView` / `TasksMonthCalendar`
- Pass `spaceId` (= scope) and demo card data / setters

When view is table/calendar: existing behavior.

## Project overview card

New component: `src/components/tracker/tasks/project-overview-card.tsx`

### Layout

- Full-width page shell (no root `max-w-*` / `mx-auto`); overview body is a single `Card` with `max-w-3xl` on the card only so the description stays readable on ultra-wide screens
- Sections:
  1. **Header** — project/space display name (`h2` / strong title)
  2. **Metadata row** — Space name · Status badge (Active / Archived) · `{n} members`
  3. **Description** — label + TipTap editor + toolbar + **Save** button

### Editor

- TipTap `useEditor` with StarterKit + Placeholder (`"Add a project description…"`)
- Toolbar buttons: Bold, Italic, Bullet list, Ordered list (minimum)
- Content model: HTML string in demo state
- Save: write current editor HTML into parent/local state, `toast.success("Description saved")`
- No dirty-state UX in v1; Save is always enabled

Do **not** import `CommentEditor` (mentions, slash, AI).

### Data

New demo seed file (or extend existing):  
`src/components/tracker/tasks/project-overview-demo-data.ts`

Per space id used in `TasksScope`:

```ts
type ProjectOverviewDemo = {
  spaceId: string;
  name: string;
  spaceName: string;
  isArchived: boolean;
  memberCount: number;
  descriptionHtml: string;
};
```

Seed can align names with `TRACKER_DEMO_SPACES` / project settings seed where sensible (e.g. IT space). Missing space → sensible defaults from `getScopeTitle(scope)`.

Page keeps `useState` map or single draft for current space; switching space resets from seed (or keeps per-space drafts in a `Record`—prefer `Record<spaceId, draft>` so edits survive scope switches within the session).

## Accessibility

- Overview chip: `aria-label="Overview"` / `aria-selected` when active
- Editor region: `aria-label="Project description"`
- Status and member count as plain text / badge, not interactive in v1

## Verification

```bash
npm run lint
npm run typecheck
npm run check:ui-english
```

Manual: open `/tracker/tasks?scope=space-it&view=table` → Overview left of tabs → card replaces table → edit description → Save toast → Table restores list; `all` / `today` have no Overview button.

## Out of scope

- Backend / Supabase persistence
- Syncing description with Project Settings modal plain-text field
- Member list management on the card
- Board view enablement
- Intercepting routes / separate `/tracker/projects/[id]` page

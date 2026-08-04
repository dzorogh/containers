# Tracker Project Overview View — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Spec: `docs/superpowers/specs/2026-08-04-tracker-project-overview-view-design.md`.

**Goal:** Add an Overview view (`?view=overview`) for space scopes that shows a project card with metadata and a TipTap WYSIWYG description instead of the tasks table/calendar.

**Architecture:** Extend `TasksView` URL state with `"overview"`. Toolbar shows an Overview chip left of view tabs (separator) only for `space-*` scopes. Page swaps list/calendar for `ProjectOverviewCard`. Demo drafts live in a per-space `Record` in page state; TipTap is a lightweight editor (not `CommentEditor`).

**Tech Stack:** Next.js App Router, React client components, TipTap (`@tiptap/react` + StarterKit + Placeholder), shadcn `Card` / `Button` / `Badge`, lucide `FileText`, sonner toast, vitest for pure state helpers.

---

## File map

| File | Responsibility |
|------|----------------|
| `src/features/tracker/tasks/tasks-page-state.ts` | `TasksView` includes `overview`; parse/fallback; `isSpaceScope`; breadcrumb Overview crumb |
| `tests/unit/tasks-page-state.test.ts` | Unit tests for parse / space check / breadcrumb |
| `src/components/tracker/tasks/project-overview-demo-data.ts` | Seed map + `getProjectOverviewDemo(spaceId)` |
| `src/components/tracker/tasks/project-overview-card.tsx` | Card UI + TipTap description editor + Save |
| `src/components/tracker/tasks/tasks-toolbar.tsx` | Overview chip + separator when `showOverview` |
| `app/tracker/tasks/page.tsx` | Wire overview view, draft state, render card |

---

### Task 1: URL state — `overview` view + space helpers

**Files:**
- Modify: `src/features/tracker/tasks/tasks-page-state.ts`
- Create: `tests/unit/tasks-page-state.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
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
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npm run test -- tests/unit/tasks-page-state.test.ts
```

Expected: FAIL (`isSpaceScope` / `overview` not defined or assertions fail).

- [ ] **Step 3: Implement state changes**

In `src/features/tracker/tasks/tasks-page-state.ts`:

```ts
export type TasksView = "table" | "calendar" | "overview";

export const isSpaceScope = (scope: TasksScope): boolean =>
  scope.startsWith("space-");

const isTasksView = (value: string | null): value is TasksView =>
  value === "table" || value === "calendar" || value === "overview";

export const parseTasksPageState = (
  searchParams: URLSearchParams | { get: (key: string) => string | null },
): TasksPageState => {
  const rawScope = searchParams.get("scope");
  const rawView = searchParams.get("view");

  const scope: TasksScope = isTasksScope(rawScope) ? rawScope : "all";
  let view: TasksView = isTasksView(rawView) ? rawView : "calendar";

  if (view === "overview" && !isSpaceScope(scope)) {
    view = "table";
  }

  return { scope, view };
};
```

In `getBreadcrumbSegments`, after pushing the space label for space scopes, if `view === "overview"` push `{ label: "Overview" }`.

Keep `buildTasksHref` as-is aside from the widened `TasksView` type (it already sets `view` from the argument).

- [ ] **Step 4: Run tests — expect PASS**

```bash
npm run test -- tests/unit/tasks-page-state.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/tracker/tasks/tasks-page-state.ts tests/unit/tasks-page-state.test.ts
git commit -m "$(cat <<'EOF'
feat(tracker): add overview view to tasks URL state

EOF
)"
```

---

### Task 2: Demo data for project overview

**Files:**
- Create: `src/components/tracker/tasks/project-overview-demo-data.ts`

- [ ] **Step 1: Add types + seed + getter**

```ts
import type { TasksScope } from "@/features/tracker/tasks/tasks-page-state";
import { getScopeTitle, isSpaceScope } from "@/features/tracker/tasks/tasks-page-state";

export type ProjectOverviewDemo = {
  spaceId: string;
  name: string;
  spaceName: string;
  isArchived: boolean;
  memberCount: number;
  descriptionHtml: string;
};

const SEED: Record<string, ProjectOverviewDemo> = {
  "space-it": {
    spaceId: "space-it",
    name: "IT",
    spaceName: "Holding / IT",
    isArchived: false,
    memberCount: 12,
    descriptionHtml:
      "<p>Workspace for engineering delivery, infra, and product tooling.</p><ul><li>Sprint rituals</li><li>On-call notes</li></ul>",
  },
  "space-management": {
    spaceId: "space-management",
    name: "Management",
    spaceName: "Holding / Management",
    isArchived: false,
    memberCount: 8,
    descriptionHtml: "<p>Leadership planning and cross-team coordination.</p>",
  },
  "space-qa": {
    spaceId: "space-qa",
    name: "QA",
    spaceName: "Holding / QA",
    isArchived: false,
    memberCount: 6,
    descriptionHtml: "<p>Quality assurance processes and release checklists.</p>",
  },
  "space-holding": {
    spaceId: "space-holding",
    name: "Holding",
    spaceName: "Holding",
    isArchived: false,
    memberCount: 24,
    descriptionHtml: "<p>Parent space for Holding departments.</p>",
  },
  "space-it-cp": {
    spaceId: "space-it-cp",
    name: "IT CP",
    spaceName: "IT CP",
    isArchived: false,
    memberCount: 5,
    descriptionHtml: "<p>IT CP project space.</p>",
  },
  "space-qwe": {
    spaceId: "space-qwe",
    name: "qwe",
    spaceName: "qwe",
    isArchived: true,
    memberCount: 2,
    descriptionHtml: "<p>Archived demo space.</p>",
  },
};

/** Returns a deep-enough copy for session drafts (descriptionHtml is a string). */
export const getProjectOverviewDemo = (spaceId: TasksScope): ProjectOverviewDemo => {
  if (!isSpaceScope(spaceId)) {
    const title = getScopeTitle(spaceId);
    return {
      spaceId,
      name: title,
      spaceName: title,
      isArchived: false,
      memberCount: 0,
      descriptionHtml: "<p></p>",
    };
  }

  const seeded = SEED[spaceId];
  if (seeded) {
    return { ...seeded };
  }

  const title = getScopeTitle(spaceId);
  return {
    spaceId,
    name: title,
    spaceName: title,
    isArchived: false,
    memberCount: 0,
    descriptionHtml: `<p>Description for ${title}.</p>`,
  };
};
```

- [ ] **Step 2: Commit**

```bash
git add src/components/tracker/tasks/project-overview-demo-data.ts
git commit -m "$(cat <<'EOF'
feat(tracker): add project overview demo seed data

EOF
)"
```

---

### Task 3: `ProjectOverviewCard` + TipTap editor

**Files:**
- Create: `src/components/tracker/tasks/project-overview-card.tsx`

- [ ] **Step 1: Scaffold component API**

```tsx
"use client";

import { useEffect } from "react";
import { Bold, Italic, List, ListOrdered } from "lucide-react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { toast } from "sonner";
import type { ProjectOverviewDemo } from "@/components/tracker/tasks/project-overview-demo-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type ProjectOverviewCardProps = {
  draft: ProjectOverviewDemo;
  onDescriptionSaved: (descriptionHtml: string) => void;
};
```

- [ ] **Step 2: TipTap editor**

```tsx
export const ProjectOverviewCard = ({ draft, onDescriptionSaved }: ProjectOverviewCardProps) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
      }),
      Placeholder.configure({ placeholder: "Add a project description…" }),
    ],
    content: draft.descriptionHtml,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "min-h-40 px-3 py-2 text-sm outline-none prose prose-sm max-w-none dark:prose-invert",
        "aria-label": "Project description",
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (current !== draft.descriptionHtml) {
      editor.commands.setContent(draft.descriptionHtml, { emitUpdate: false });
    }
  }, [draft.spaceId, draft.descriptionHtml, editor]);

  const handleSave = () => {
    if (!editor) return;
    onDescriptionSaved(editor.getHTML());
    toast.success("Description saved");
  };

  // …render below
};
```

Notes:
- Use `immediatelyRender: false` for Next.js SSR safety (same concern as other TipTap clients).
- Do **not** import `@/features/comments/comment-editor`.
- If `prose` classes are unavailable in the project, use plain `text-sm` + element spacing (`[&_ul]:list-disc [&_ul]:pl-5` etc.) instead of relying on Typography plugin.

- [ ] **Step 3: Card layout**

```tsx
return (
  <Card size="sm" className="max-w-3xl ring-1 ring-[var(--corportal-border-grey)]">
    <CardHeader className="gap-2 space-y-0">
      <h2 className="text-xl font-semibold text-foreground">{draft.name}</h2>
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>Space · {draft.spaceName}</span>
        <span aria-hidden>·</span>
        <Badge variant={draft.isArchived ? "secondary" : "outline"}>
          {draft.isArchived ? "Archived" : "Active"}
        </Badge>
        <span aria-hidden>·</span>
        <span>
          {draft.memberCount} {draft.memberCount === 1 ? "member" : "members"}
        </span>
      </div>
    </CardHeader>
    <CardContent className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">Description</p>
        <Button type="button" size="sm" onClick={handleSave} disabled={!editor}>
          Save
        </Button>
      </div>
      <div className="rounded-lg border border-input bg-background focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
        <div className="flex flex-wrap items-center gap-1 border-b border-input px-2 py-1.5">
          <ToolbarButton
            label="Bold"
            active={editor?.isActive("bold") ?? false}
            onClick={() => editor?.chain().focus().toggleBold().run()}
          >
            <Bold className="size-3.5" aria-hidden />
          </ToolbarButton>
          <ToolbarButton
            label="Italic"
            active={editor?.isActive("italic") ?? false}
            onClick={() => editor?.chain().focus().toggleItalic().run()}
          >
            <Italic className="size-3.5" aria-hidden />
          </ToolbarButton>
          <ToolbarButton
            label="Bullet list"
            active={editor?.isActive("bulletList") ?? false}
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
          >
            <List className="size-3.5" aria-hidden />
          </ToolbarButton>
          <ToolbarButton
            label="Ordered list"
            active={editor?.isActive("orderedList") ?? false}
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          >
            <ListOrdered className="size-3.5" aria-hidden />
          </ToolbarButton>
        </div>
        <EditorContent editor={editor} />
      </div>
    </CardContent>
  </Card>
);
```

Local helper:

```tsx
const ToolbarButton = ({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <Button
    type="button"
    variant="ghost"
    size="icon-sm"
    aria-label={label}
    aria-pressed={active}
    onClick={onClick}
    className={cn(active && "bg-muted")}
  >
    {children}
  </Button>
);
```

All user-visible strings in English.

- [ ] **Step 4: Commit**

```bash
git add src/components/tracker/tasks/project-overview-card.tsx
git commit -m "$(cat <<'EOF'
feat(tracker): add project overview card with TipTap description

EOF
)"
```

---

### Task 4: Toolbar — Overview chip left of view tabs

**Files:**
- Modify: `src/components/tracker/tasks/tasks-toolbar.tsx`

- [ ] **Step 1: Extend props**

```ts
type TasksToolbarProps = {
  title: string;
  view: TasksView;
  onViewChange: (view: TasksView) => void;
  onAddTask: () => void;
  onRefresh?: () => void;
  onOpenSpaceSettings: () => void;
  onOpenProjectSettings: () => void;
  showOverview?: boolean;
};
```

Default `showOverview = false`.

- [ ] **Step 2: Insert Overview + separator before Table**

Import `FileText` from `lucide-react`.

Inside the existing `role="tablist"` div, **before** the Table chip:

```tsx
{showOverview ? (
  <>
    <HomeFilterChip
      active={view === "overview"}
      role="tab"
      aria-selected={view === "overview"}
      ariaLabel="Overview"
      onClick={() => onViewChange("overview")}
      className="gap-1.5"
    >
      <FileText aria-hidden className="size-3.5" />
      Overview
    </HomeFilterChip>
    <div className="mx-1 h-5 w-px shrink-0 bg-border" aria-hidden />
  </>
) : null}
```

Keep Board / Calendar / Plus unchanged. When `view === "overview"`, Table and Calendar chips are inactive (`active={false}` already via `view === "table"` / `"calendar"`).

- [ ] **Step 3: Commit**

```bash
git add src/components/tracker/tasks/tasks-toolbar.tsx
git commit -m "$(cat <<'EOF'
feat(tracker): add Overview control to tasks toolbar

EOF
)"
```

---

### Task 5: Wire page — drafts + conditional render

**Files:**
- Modify: `app/tracker/tasks/page.tsx`

- [ ] **Step 1: Imports**

```tsx
import { ProjectOverviewCard } from "@/components/tracker/tasks/project-overview-card";
import {
  getProjectOverviewDemo,
  type ProjectOverviewDemo,
} from "@/components/tracker/tasks/project-overview-demo-data";
import {
  buildTasksHref,
  filterTasksByScope,
  getBreadcrumbSegments,
  getScopeTitle,
  isSpaceScope,
  parseTasksPageState,
  type TasksScope,
  type TasksView,
} from "@/features/tracker/tasks/tasks-page-state";
```

- [ ] **Step 2: Draft state**

```tsx
const [overviewDrafts, setOverviewDrafts] = useState<Record<string, ProjectOverviewDemo>>({});

const overviewDraft = useMemo(() => {
  if (!isSpaceScope(pageState.scope)) {
    return null;
  }
  return overviewDrafts[pageState.scope] ?? getProjectOverviewDemo(pageState.scope);
}, [overviewDrafts, pageState.scope]);
```

- [ ] **Step 3: Toolbar + body**

```tsx
<TasksToolbar
  title={getScopeTitle(pageState.scope)}
  view={pageState.view}
  onViewChange={(view) => replacePageState({ view })}
  onAddTask={handleAddTask}
  onRefresh={() => router.refresh()}
  onOpenSpaceSettings={() => setIsSpaceSettingsOpen(true)}
  onOpenProjectSettings={() => setIsProjectSettingsOpen(true)}
  showOverview={isSpaceScope(pageState.scope)}
/>

{pageState.view === "overview" && overviewDraft ? (
  <ProjectOverviewCard
    draft={overviewDraft}
    onDescriptionSaved={(descriptionHtml) => {
      setOverviewDrafts((prev) => ({
        ...prev,
        [pageState.scope]: {
          ...(prev[pageState.scope] ?? getProjectOverviewDemo(pageState.scope)),
          descriptionHtml,
        },
      }));
    }}
  />
) : pageState.view === "table" ? (
  <TasksListView
    tasks={visibleTasks}
    onTasksChange={handleVisibleTasksChange}
    spaceId={pageState.scope.startsWith("space-") ? pageState.scope : "space-holding"}
  />
) : (
  <TasksMonthCalendar tasks={visibleTasks} onTasksChange={handleVisibleTasksChange} />
)}
```

- [ ] **Step 4: Commit**

```bash
git add app/tracker/tasks/page.tsx
git commit -m "$(cat <<'EOF'
feat(tracker): wire project overview view on tasks page

EOF
)"
```

---

### Task 6: Verify

- [ ] **Step 1: Automated checks**

```bash
npm run test -- tests/unit/tasks-page-state.test.ts
npm run typecheck
npm run lint
npm run check:ui-english
```

Expected: all pass.

- [ ] **Step 2: Manual browser checks**

1. Open `http://localhost:3000/tracker/tasks?scope=space-it&view=table`
2. Overview chip is left of Table, with a vertical separator
3. Click Overview → URL becomes `view=overview`, card shows name / metadata / editor
4. Edit description → Save → toast "Description saved"
5. Click Table → list returns; click Overview again → saved HTML still present (same session)
6. `/tracker/tasks?scope=all&view=table` — no Overview chip
7. `/tracker/tasks?scope=all&view=overview` — falls back to table (no overview card)

---

## Done when

- Spec decisions are implemented: URL `overview`, space-only chip, separator layout, card + TipTap, demo Save
- Unit tests for page state pass
- English UI only; no CommentEditor reuse; no backend

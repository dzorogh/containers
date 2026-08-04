# Tracker Task Open Modal — Implementation Plan

> **For agentic workers:** Implement task-by-task. Steps use checkbox (`- [ ]`) syntax. Spec: `docs/superpowers/specs/2026-08-04-tracker-task-open-modal-design.md`.

**Goal:** Add an Open control on each tracker table row that navigates to `/tracker/tasks/[taskId]` and shows a read-only task detail Dialog.

**Architecture:** Dedicated App Router page owns the modal lifecycle. Lookup is static `ALL_TASKS` by id. Table uses `Link` for navigation. No intercepting routes, no edit, no shared client store.

**Tech Stack:** Next.js App Router, React client components, shadcn `Dialog` / `Button`, lucide `SquareArrowOutUpRight`, existing `TodayTask` demo data.

---

## File map

| File | Responsibility |
|------|----------------|
| `src/components/tracker/tasks/task-detail-modal.tsx` | Read-only Dialog + not-found state + close handlers |
| `app/tracker/tasks/[taskId]/page.tsx` | Resolve taskId, render modal page shell |
| `src/components/tracker/tasks/tasks-list-view.tsx` | Open icon `Link` on each task row; create href path |
| `src/components/home/tasks-today-demo-data.ts` | `createTask` / seed `href` → `/tracker/tasks/${id}` |
| `app/tracker/tasks/page.tsx` | Create-dialog task `href` path update |
| `src/components/tracker/tasks/calendar/tasks-month-calendar.tsx` | Quick-create `href` path update (same convention) |

---

### Task 1: `TaskDetailModal` component

**Files:**
- Create: `src/components/tracker/tasks/task-detail-modal.tsx`

- [ ] **Step 1: Scaffold props and priority labels**

```tsx
"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import type { TodayTask, TaskPriority } from "@/components/home/tasks-today-demo-data";
import { COLOR_CLASS_BY_TASK } from "@/components/tracker/tasks/calendar/calendar-color-map";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

type TaskDetailModalProps = {
  task: TodayTask | null;
};
```

- [ ] **Step 2: Close helper**

```tsx
const closeToTasks = () => {
  if (typeof window !== "undefined" && window.history.length > 1) {
    router.back();
    return;
  }
  router.push("/tracker/tasks");
};
```

Wire `Dialog` with `open` always true and `onOpenChange={(next) => { if (!next) closeToTasks(); }}`.

- [ ] **Step 3: Not-found branch**

When `task === null`:

- Title: `Task not found`
- Description: `This demo task does not exist or is not available on this route.`
- Footer button **Back to tasks** → `router.push("/tracker/tasks")`

- [ ] **Step 4: Found branch UI**

- `DialogContent` className includes `sm:max-w-md`
- Header: color dot (`COLOR_CLASS_BY_TASK[task.color]`) + `DialogTitle` = `task.title`
- `DialogDescription`: `Project · {task.projectName}`
- Body: definition list / stacked rows:
  - Priority → `PRIORITY_LABELS[task.priority]`
  - Deadline → `new Date(task.deadlineAt)` locale date, fallback `task.deadlineLabel` if invalid
  - Assignee → 20px avatar (`next/image` or `<img>` with `rounded-full`) + `task.assigneeName`
- Footer: **Close** button calling `closeToTasks`

- [ ] **Step 5: English-only labels**

All user-visible strings in English (`Priority`, `Deadline`, `Assignee`, `Close`, `Back to tasks`, etc.).

---

### Task 2: Route page

**Files:**
- Create: `app/tracker/tasks/[taskId]/page.tsx`

- [ ] **Step 1: Client page that reads params**

```tsx
"use client";

import { use } from "react";
import { ALL_TASKS } from "@/components/home/tasks-today-demo-data";
import { TaskDetailModal } from "@/components/tracker/tasks/task-detail-modal";

type TaskDetailPageProps = {
  params: Promise<{ taskId: string }>;
};

const TaskDetailPage = ({ params }: TaskDetailPageProps) => {
  const { taskId } = use(params);
  const task = ALL_TASKS.find((item) => item.id === taskId) ?? null;

  return (
    <main className="min-h-screen bg-muted/30">
      <TaskDetailModal task={task} />
    </main>
  );
};

export default TaskDetailPage;
```

Match the project's Next params style if `params` is already unwrapped elsewhere — prefer whatever `app/` routes currently use.

- [ ] **Step 2: Smoke-check route**

Visit `/tracker/tasks/task-1` (or a real seeded id from `ALL_TASKS`) and confirm modal renders; visit `/tracker/tasks/does-not-exist` for not-found.

---

### Task 3: Open button in table

**Files:**
- Modify: `src/components/tracker/tasks/tasks-list-view.tsx`

- [ ] **Step 1: Imports**

Add `Link` from `next/link`, `SquareArrowOutUpRight` from `lucide-react`.

- [ ] **Step 2: Place control in title cell**

After the checklist progress badge (or after `InlineEditableText` when no badge), add:

```tsx
<Link
  href={`/tracker/tasks/${task.id}`}
  className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
  aria-label="Open task"
  onClick={(event) => event.stopPropagation()}
>
  <SquareArrowOutUpRight className="size-3.5" aria-hidden />
</Link>
```

Do not wrap the title itself; keep inline edit behavior unchanged.

- [ ] **Step 3: Update `buildCreatedTask` href**

```ts
href: `/tracker/tasks/${taskId}`,
```

---

### Task 4: Align `href` on create / seed helpers

**Files:**
- Modify: `src/components/home/tasks-today-demo-data.ts`
- Modify: `app/tracker/tasks/page.tsx`
- Modify: `src/components/tracker/tasks/calendar/tasks-month-calendar.tsx`

- [ ] **Step 1: Demo `createTask`**

Change:

```ts
href: `/tracker/tasks?task=${config.id}`,
```

to:

```ts
href: `/tracker/tasks/${config.id}`,
```

- [ ] **Step 2: Page create dialog**

In `handleCreateTask`, set `href: `/tracker/tasks/${taskId}``.

- [ ] **Step 3: Calendar quick-create**

Same `href` path update for newly created calendar tasks.

Note: calendar item click behavior may still use old query links in UI navigation — only change the `href` field on created/seeded tasks per spec; do not redesign calendar open UX in this plan.

---

### Task 5: Verify

- [ ] **Step 1: Typecheck / lint on touched files**

```bash
npm run typecheck
npm run check:ui-english
```

- [ ] **Step 2: Manual browser checks**

1. `/tracker/tasks?scope=space-it&view=table` — each row has Open icon
2. Click Open on a known task → modal with title, project, priority, deadline, assignee
3. Close (X / Esc / Close) → returns to previous table view when opened from list
4. Direct `/tracker/tasks/not-a-real-id` → not-found + Back to tasks
5. Inline title edit and checklist expand still work; Open does not start edit

---

## Done when

All success criteria from the design spec pass; no Board/calendar open redesign; English UI only.

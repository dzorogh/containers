"use client";

import { Fragment, Suspense, useMemo, useState, type Dispatch, type FormEvent, type SetStateAction } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ALL_TASKS, type TodayTask } from "@/components/home/tasks-today-demo-data";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { TasksMonthCalendar } from "@/components/tracker/tasks/calendar/tasks-month-calendar";
import { ProjectSettingsModal } from "@/components/tracker/tasks/project-settings-modal";
import { SpaceSettingsModal } from "@/components/tracker/tasks/space-settings-modal";
import { TasksListView } from "@/components/tracker/tasks/tasks-list-view";
import { TasksToolbar } from "@/components/tracker/tasks/tasks-toolbar";
import {
  buildTasksHref,
  filterTasksByScope,
  getBreadcrumbSegments,
  getScopeTitle,
  parseTasksPageState,
  type TasksScope,
  type TasksView,
} from "@/features/tracker/tasks/tasks-page-state";

const mergeVisibleTasks = (
  allTasks: TodayTask[],
  scope: TasksScope,
  nextVisible: TodayTask[],
): TodayTask[] => {
  const previousVisible = filterTasksByScope(allTasks, scope);
  const previousVisibleIds = new Set(previousVisible.map((task) => task.id));
  const kept = allTasks.filter((task) => !previousVisibleIds.has(task.id));
  return [...kept, ...nextVisible];
};

const TrackerTasksPageContent = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pageState = useMemo(() => parseTasksPageState(searchParams), [searchParams]);

  const [tasks, setTasks] = useState<TodayTask[]>(ALL_TASKS);
  const [isProjectSettingsOpen, setIsProjectSettingsOpen] = useState(false);
  const [isSpaceSettingsOpen, setIsSpaceSettingsOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createProject, setCreateProject] = useState("");

  const visibleTasks = useMemo(
    () => filterTasksByScope(tasks, pageState.scope),
    [tasks, pageState.scope],
  );

  const breadcrumbSegments = useMemo(
    () => getBreadcrumbSegments(pageState.scope, pageState.view),
    [pageState.scope, pageState.view],
  );

  const replacePageState = (next: { scope?: TasksScope; view?: TasksView }) => {
    const href = buildTasksHref({
      scope: next.scope ?? pageState.scope,
      view: next.view ?? pageState.view,
    });
    router.replace(href);
  };

  const handleVisibleTasksChange: Dispatch<SetStateAction<TodayTask[]>> = (updater) => {
    setTasks((prevAll) => {
      const previousVisible = filterTasksByScope(prevAll, pageState.scope);
      const nextVisible = typeof updater === "function" ? updater(previousVisible) : updater;
      return mergeVisibleTasks(prevAll, pageState.scope, nextVisible);
    });
  };

  const handleAddTask = () => {
    setCreateTitle("");
    setCreateProject("");
    setIsCreateOpen(true);
  };

  const handleCreateTask = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedTitle = createTitle.trim();
    if (!trimmedTitle) {
      toast.error("Enter a task title.");
      return;
    }

    const taskId = `task-${Date.now()}`;
    const deadlineAt = new Date().toISOString();
    const nextTask: TodayTask = {
      id: taskId,
      href: `/tracker/tasks?task=${taskId}`,
      title: trimmedTitle,
      projectName: createProject.trim() || "No project",
      priority: "medium",
      comments: 0,
      color: "blue",
      deadlineAt,
      deadlineLabel: "Today",
      createdAt: deadlineAt,
      customDateFields: { planningDate: deadlineAt },
      assigneeName: "Unassigned",
      assigneeAvatarUrl: `https://i.pravatar.cc/40?u=task-assignee-${taskId}`,
      spaceId: pageState.scope.startsWith("space-") ? pageState.scope : "space-holding",
    };

    setTasks((prev) => [...prev, nextTask]);
    setIsCreateOpen(false);
    toast.success("Task created");
  };

  return (
    <>
      <main className="min-h-screen bg-muted/30">
        <section className="p-4">
          <div className="flex w-full flex-col gap-4">
            <Breadcrumb>
              <BreadcrumbList>
                {breadcrumbSegments.map((segment, index) => {
                  const isLast = index === breadcrumbSegments.length - 1;
                  return (
                    <Fragment key={`${segment.label}-${index}`}>
                      {index > 0 ? <BreadcrumbSeparator /> : null}
                      <BreadcrumbItem>
                        {isLast || !segment.href ? (
                          <BreadcrumbPage>{segment.label}</BreadcrumbPage>
                        ) : (
                          <BreadcrumbLink render={<Link href={segment.href} />}>
                            {segment.label}
                          </BreadcrumbLink>
                        )}
                      </BreadcrumbItem>
                    </Fragment>
                  );
                })}
              </BreadcrumbList>
            </Breadcrumb>

            <TasksToolbar
              title={getScopeTitle(pageState.scope)}
              view={pageState.view}
              onViewChange={(view) => replacePageState({ view })}
              onAddTask={handleAddTask}
              onRefresh={() => router.refresh()}
              onOpenSpaceSettings={() => setIsSpaceSettingsOpen(true)}
              onOpenProjectSettings={() => setIsProjectSettingsOpen(true)}
            />

            {pageState.view === "table" ? (
              <TasksListView
                tasks={visibleTasks}
                onTasksChange={handleVisibleTasksChange}
                spaceId={pageState.scope.startsWith("space-") ? pageState.scope : "space-holding"}
              />
            ) : (
              <TasksMonthCalendar tasks={visibleTasks} onTasksChange={handleVisibleTasksChange} />
            )}
          </div>
        </section>
      </main>

      <ProjectSettingsModal open={isProjectSettingsOpen} onOpenChange={setIsProjectSettingsOpen} />
      <SpaceSettingsModal open={isSpaceSettingsOpen} onOpenChange={setIsSpaceSettingsOpen} />

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create task</DialogTitle>
            <DialogDescription>Add a demo task to the current view.</DialogDescription>
          </DialogHeader>
          <form className="space-y-3" onSubmit={handleCreateTask}>
            <Input
              value={createTitle}
              onChange={(event) => setCreateTitle(event.target.value)}
              placeholder="Task title"
              aria-label="Task title"
              autoFocus
            />
            <Input
              value={createProject}
              onChange={(event) => setCreateProject(event.target.value)}
              placeholder="Project (optional)"
              aria-label="Project name"
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Create</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

const TrackerTasksPage = () => (
  <Suspense
    fallback={
      <main className="min-h-screen bg-muted/30">
        <section className="p-4 text-sm text-muted-foreground">Loading tasks…</section>
      </main>
    }
  >
    <TrackerTasksPageContent />
  </Suspense>
);

export default TrackerTasksPage;

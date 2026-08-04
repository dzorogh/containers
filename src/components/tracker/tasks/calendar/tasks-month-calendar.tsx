"use client";

import { useMemo, useState, type Dispatch, type FormEvent, type SetStateAction } from "react";
import { ChevronLeft, ChevronRight, Plus, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import type { TaskPriority, TodayTask } from "@/components/home/tasks-today-demo-data";
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
import {
  applyDateKeepingTime,
  applyTimeToIso,
  buildMonthGrid,
  formatDateKey,
  formatDeadlineLabel,
  formatTime,
  getWeekdayLabels,
  parseTimeInput,
  resolveTaskDate,
  sortTasksByTime,
} from "./calendar-utils";
import type { CalendarDateProperty, CalendarFirstDayOfWeek, CalendarTask } from "./calendar-types";
import { COLOR_CLASS_BY_TASK } from "./calendar-color-map";
import { CalendarTaskItem } from "./calendar-task-item";

const MAX_VISIBLE_TASKS = 4;

const DATE_PROPERTY_OPTIONS: { value: CalendarDateProperty; label: string }[] = [
  { value: "deadline", label: "Deadline" },
  { value: "createdAt", label: "Created at" },
  { value: "customDateField", label: "Custom date field" },
];

const CUSTOM_DATE_FIELD_OPTIONS = [
  { id: "planningDate", label: "Planning date (demo)" },
];

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

const monthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
});

type TasksMonthCalendarProps = {
  tasks: CalendarTask[];
  onTasksChange: Dispatch<SetStateAction<CalendarTask[]>>;
};

const getInitialAnchorMonthDate = (tasks: TodayTask[]) => {
  const fallbackDate = new Date("2026-04-01T00:00:00.000Z");

  if (tasks.length === 0) {
    return new Date(fallbackDate.getFullYear(), fallbackDate.getMonth(), 1);
  }

  const firstTaskDate = new Date(tasks[0].deadlineAt);
  if (Number.isNaN(firstTaskDate.getTime())) {
    return new Date(fallbackDate.getFullYear(), fallbackDate.getMonth(), 1);
  }

  return new Date(firstTaskDate.getFullYear(), firstTaskDate.getMonth(), 1);
};

export const TasksMonthCalendar = ({ tasks, onTasksChange }: TasksMonthCalendarProps) => {
  const [anchorMonthDate, setAnchorMonthDate] = useState(() => getInitialAnchorMonthDate(tasks));
  const [dateProperty, setDateProperty] = useState<CalendarDateProperty>("deadline");
  const [customDateFieldId, setCustomDateFieldId] = useState(CUSTOM_DATE_FIELD_OPTIONS[0].id);
  const [firstDayOfWeek, setFirstDayOfWeek] = useState<CalendarFirstDayOfWeek>("monday");
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverDateKey, setDragOverDateKey] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTimeValue, setEditingTimeValue] = useState("");
  const [quickCreateDate, setQuickCreateDate] = useState<Date | null>(null);
  const [quickCreateTitle, setQuickCreateTitle] = useState("");
  const [quickCreateProject, setQuickCreateProject] = useState("");
  const [quickCreateTime, setQuickCreateTime] = useState("09:00");
  const [overflowDateKey, setOverflowDateKey] = useState<string | null>(null);
  const [isViewSettingsOpen, setIsViewSettingsOpen] = useState(false);

  const monthGrid = useMemo(() => buildMonthGrid(anchorMonthDate, firstDayOfWeek), [anchorMonthDate, firstDayOfWeek]);
  const weekdayLabels = useMemo(() => getWeekdayLabels(firstDayOfWeek), [firstDayOfWeek]);

  const tasksByDateKey = useMemo(() => {
    const groupedTasks = new Map<string, CalendarTask[]>();

    for (const task of tasks) {
      const date = resolveTaskDate(task, dateProperty, customDateFieldId);
      if (!date) {
        continue;
      }

      const dateKey = formatDateKey(date);
      const dayTasks = groupedTasks.get(dateKey) ?? [];
      dayTasks.push(task);
      groupedTasks.set(dateKey, dayTasks);
    }

    for (const [dateKey, dayTasks] of groupedTasks.entries()) {
      groupedTasks.set(dateKey, sortTasksByTime(dayTasks, dateProperty, customDateFieldId));
    }

    return groupedTasks;
  }, [tasks, dateProperty, customDateFieldId]);

  const overflowDateTasks = overflowDateKey ? tasksByDateKey.get(overflowDateKey) ?? [] : [];

  const monthLabel = monthFormatter.format(anchorMonthDate);

  const getTaskIsoByProperty = (task: CalendarTask) => {
    if (dateProperty === "deadline") {
      return task.deadlineAt;
    }

    if (dateProperty === "createdAt") {
      return task.createdAt;
    }

    return task.customDateFields[customDateFieldId];
  };

  const updateTaskByDateProperty = (task: CalendarTask, nextIso: string) => {
    if (dateProperty === "deadline") {
      return {
        ...task,
        deadlineAt: nextIso,
        deadlineLabel: formatDeadlineLabel(nextIso),
      };
    }

    if (dateProperty === "createdAt") {
      return {
        ...task,
        createdAt: nextIso,
      };
    }

    return {
      ...task,
      customDateFields: {
        ...task.customDateFields,
        [customDateFieldId]: nextIso,
      },
    };
  };

  const handlePrevMonth = () => {
    setAnchorMonthDate((prevDate) => new Date(prevDate.getFullYear(), prevDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setAnchorMonthDate((prevDate) => new Date(prevDate.getFullYear(), prevDate.getMonth() + 1, 1));
  };

  const handleGoToday = () => {
    const now = new Date();
    setAnchorMonthDate(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  const handleDropToDay = (targetDate: Date) => {
    if (!draggedTaskId) {
      return;
    }

    onTasksChange((prevTasks) =>
      prevTasks.map((task) => {
        if (task.id !== draggedTaskId) {
          return task;
        }

        const sourceIso = getTaskIsoByProperty(task);
        if (!sourceIso) {
          return task;
        }

        const nextIso = applyDateKeepingTime(sourceIso, targetDate);
        return updateTaskByDateProperty(task, nextIso);
      }),
    );

    setDragOverDateKey(null);
    setDraggedTaskId(null);
  };

  const startTimeEdit = (task: CalendarTask) => {
    const date = resolveTaskDate(task, dateProperty, customDateFieldId);
    if (!date) {
      return;
    }

    setEditingTaskId(task.id);
    setEditingTimeValue(formatTime(date));
  };

  const finishTimeEdit = (task: CalendarTask, shouldCommit: boolean) => {
    if (!shouldCommit) {
      setEditingTaskId(null);
      setEditingTimeValue("");
      return;
    }

    const parsedTime = parseTimeInput(editingTimeValue);

    if (!parsedTime) {
      toast.error("Invalid time. Use formats like 18, 930, or 18:30.");
      setEditingTaskId(null);
      setEditingTimeValue("");
      return;
    }

    onTasksChange((prevTasks) =>
      prevTasks.map((currentTask) => {
        if (currentTask.id !== task.id) {
          return currentTask;
        }

        const sourceIso = getTaskIsoByProperty(currentTask);
        if (!sourceIso) {
          return currentTask;
        }

        const nextIso = applyTimeToIso(sourceIso, parsedTime.hour, parsedTime.minute);
        return updateTaskByDateProperty(currentTask, nextIso);
      }),
    );

    setEditingTaskId(null);
    setEditingTimeValue("");
  };

  const openQuickCreate = (date: Date) => {
    setQuickCreateDate(date);
    setQuickCreateTitle("");
    setQuickCreateProject("");
    setQuickCreateTime("09:00");
  };

  const closeQuickCreate = () => {
    setQuickCreateDate(null);
    setQuickCreateTitle("");
    setQuickCreateProject("");
    setQuickCreateTime("09:00");
  };

  const handleQuickCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!quickCreateDate) {
      return;
    }

    const trimmedTitle = quickCreateTitle.trim();
    if (!trimmedTitle) {
      toast.error("Enter a task title.");
      return;
    }

    const parsedTime = parseTimeInput(quickCreateTime);
    if (!parsedTime) {
      toast.error("Time not recognized. Examples: 18, 930, 18:30.");
      return;
    }

    const nextDate = new Date(quickCreateDate);
    nextDate.setHours(parsedTime.hour, parsedTime.minute, 0, 0);
    const deadlineAt = nextDate.toISOString();
    const createdAt = new Date().toISOString();
    const taskId = `task-${Date.now()}`;
    const nextTask: CalendarTask = {
      id: taskId,
      href: `/tracker/tasks?task=${taskId}`,
      title: trimmedTitle,
      projectName: quickCreateProject.trim() || "No project",
      priority: "medium",
      comments: 0,
      color: "blue",
      deadlineAt,
      deadlineLabel: formatDeadlineLabel(deadlineAt),
      createdAt,
      customDateFields: {
        planningDate: deadlineAt,
      },
      assigneeName: "Unassigned",
      assigneeAvatarUrl: `https://i.pravatar.cc/40?u=task-assignee-${taskId}`,
      spaceId: "space-holding",
    };

    onTasksChange((prevTasks) => [...prevTasks, nextTask]);
    closeQuickCreate();
  };

  return (
    <>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--corportal-border-grey)] bg-card px-2 py-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1">
              <Button type="button" variant="default" size="xs" onClick={handleGoToday}>
                Today
              </Button>
              <Button type="button" variant="outline" size="icon-xs" onClick={handlePrevMonth} aria-label="Previous month">
                <ChevronLeft className="size-3.5" />
              </Button>
              <Button type="button" variant="outline" size="icon-xs" onClick={handleNextMonth} aria-label="Next month">
                <ChevronRight className="size-3.5" />
              </Button>
            </div>

            <div className="min-w-0">
              <p className="truncate text-sm leading-none font-medium text-foreground capitalize">{monthLabel}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon-xs"
              onClick={() => setIsViewSettingsOpen(true)}
              aria-label="Open calendar view settings"
            >
              <SlidersHorizontal className="size-3.5" />
            </Button>
          </div>
        </div>

        <div className="rounded-lg border border-dashed border-[var(--corportal-border-grey)] bg-muted/20 p-6 text-sm text-muted-foreground lg:hidden">
          Month view is available on desktop screens only.
        </div>

        <div className="hidden lg:block">
          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-[var(--corportal-border-grey)] bg-border">
            {weekdayLabels.map((label) => (
              <div key={label} className="bg-card px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {label}
              </div>
            ))}

            {monthGrid.map((day) => {
              const dayTasks = tasksByDateKey.get(day.dateKey) ?? [];
              const visibleTasks = dayTasks.slice(0, MAX_VISIBLE_TASKS);
              const hiddenTasksCount = Math.max(0, dayTasks.length - MAX_VISIBLE_TASKS);
              const cellIsDropTarget = dragOverDateKey === day.dateKey;

              return (
                <section
                  key={day.dateKey}
                  className={[
                    "min-h-40 bg-card px-1.5 py-1.5 transition",
                    day.isCurrentMonth ? "text-foreground" : "bg-muted/20 text-muted-foreground",
                    cellIsDropTarget ? "ring-2 ring-blue-400 ring-inset" : "",
                  ].join(" ")}
                  onDragOver={(event) => {
                    event.preventDefault();
                    if (draggedTaskId) {
                      setDragOverDateKey(day.dateKey);
                    }
                  }}
                  onDragLeave={() => {
                    setDragOverDateKey((currentDateKey) => (currentDateKey === day.dateKey ? null : currentDateKey));
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    handleDropToDay(day.date);
                  }}
                  aria-label={`Day ${day.date.getDate()}`}
                >
                  <div className="mb-1.5 flex items-center justify-between gap-1.5">
                    <span
                      className={[
                        "inline-flex size-6 items-center justify-center rounded-full text-[11px] font-semibold",
                        day.isToday ? "bg-red-500 text-white" : "text-foreground",
                        !day.isCurrentMonth ? "opacity-70" : "",
                      ].join(" ")}
                    >
                      {day.date.getDate()}
                    </span>
                    <button
                      type="button"
                      className="inline-flex size-5 items-center justify-center rounded-md border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground"
                      aria-label={`Quick add task on day ${day.date.getDate()}`}
                      onClick={() => openQuickCreate(day.date)}
                    >
                      <Plus className="size-3" />
                    </button>
                  </div>

                  <div className="space-y-1">
                    {visibleTasks.map((task) => {
                      const taskDate = resolveTaskDate(task, dateProperty, customDateFieldId);
                      const isTimeEditing = editingTaskId === task.id;

                      return (
                        <CalendarTaskItem
                          key={task.id}
                          task={task}
                          timeLabel={taskDate ? formatTime(taskDate) : "--:--"}
                          isTimeEditing={isTimeEditing}
                          isDragging={draggedTaskId === task.id}
                          editingTimeValue={editingTimeValue}
                          onDragStart={setDraggedTaskId}
                          onDragEnd={() => {
                            setDraggedTaskId(null);
                            setDragOverDateKey(null);
                          }}
                          onStartTimeEdit={startTimeEdit}
                          onTimeValueChange={setEditingTimeValue}
                          onFinishTimeEdit={finishTimeEdit}
                        />
                      );
                    })}

                    {hiddenTasksCount > 0 && (
                      <button
                        type="button"
                        onClick={() => setOverflowDateKey(day.dateKey)}
                        className="w-full rounded-md border border-dashed border-border px-1.5 py-0.5 text-left text-[11px] text-muted-foreground transition hover:bg-muted hover:text-foreground"
                        aria-label={`Show ${hiddenTasksCount} more tasks`}
                      >
                        +{hiddenTasksCount} tasks
                      </button>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </div>

      <Dialog open={Boolean(quickCreateDate)} onOpenChange={(isOpen) => (!isOpen ? closeQuickCreate() : null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create task</DialogTitle>
            <DialogDescription>
              Quick add a task on{" "}
              {quickCreateDate
                ? new Intl.DateTimeFormat("en-US", { day: "2-digit", month: "long", year: "numeric" }).format(quickCreateDate)
                : ""}
              .
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-3" onSubmit={handleQuickCreate}>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground" htmlFor="quick-create-title">
                Title
              </label>
              <Input
                id="quick-create-title"
                value={quickCreateTitle}
                onChange={(event) => setQuickCreateTitle(event.target.value)}
                placeholder="e.g. Prepare weekly report"
                aria-label="New task title"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground" htmlFor="quick-create-time">
                  Time
                </label>
                <Input
                  id="quick-create-time"
                  value={quickCreateTime}
                  onChange={(event) => setQuickCreateTime(event.target.value)}
                  placeholder="18 or 18:30"
                  aria-label="New task time"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground" htmlFor="quick-create-project">
                  Project
                </label>
                <Input
                  id="quick-create-project"
                  value={quickCreateProject}
                  onChange={(event) => setQuickCreateProject(event.target.value)}
                  placeholder="No project"
                  aria-label="New task project"
                />
              </div>
            </div>

            <DialogFooter className="-mx-4 -mb-4 mt-4 border-t bg-muted/30 p-4">
              <Button type="button" variant="outline" onClick={closeQuickCreate}>
                Cancel
              </Button>
              <Button type="submit">Create</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isViewSettingsOpen} onOpenChange={setIsViewSettingsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>View settings</DialogTitle>
            <DialogDescription>
              Choose the date source and the first day of the week for month view.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground" htmlFor="calendar-date-property">
                Date property
              </label>
              <select
                id="calendar-date-property"
                value={dateProperty}
                onChange={(event) => setDateProperty(event.target.value as CalendarDateProperty)}
                className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground outline-none transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
                aria-label="Calendar date property"
              >
                {DATE_PROPERTY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {dateProperty === "customDateField" && (
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground" htmlFor="calendar-custom-field-select">
                  Field
                </label>
                <select
                  id="calendar-custom-field-select"
                  value={customDateFieldId}
                  onChange={(event) => setCustomDateFieldId(event.target.value)}
                  className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground outline-none transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
                  aria-label="Custom date field"
                >
                  {CUSTOM_DATE_FIELD_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground" htmlFor="calendar-week-start-select">
                First day of week
              </label>
              <select
                id="calendar-week-start-select"
                value={firstDayOfWeek}
                onChange={(event) => setFirstDayOfWeek(event.target.value as CalendarFirstDayOfWeek)}
                className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground outline-none transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
                aria-label="First day of week"
              >
                <option value="monday">Monday</option>
                <option value="sunday">Sunday</option>
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" onClick={() => setIsViewSettingsOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(overflowDateKey)} onOpenChange={(isOpen) => (!isOpen ? setOverflowDateKey(null) : null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Tasks for the day</DialogTitle>
            <DialogDescription>
              {overflowDateKey ? `Total tasks: ${overflowDateTasks.length}.` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
            {overflowDateTasks.map((task) => {
              const taskDate = resolveTaskDate(task, dateProperty, customDateFieldId);

              return (
                <article key={task.id} className="rounded-md border border-border bg-background p-2 text-sm">
                  <div className="flex items-start gap-2">
                    <span className={["mt-1 h-4 w-1 rounded-full", COLOR_CLASS_BY_TASK[task.color]].join(" ")} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground">{task.title}</p>
                      <div className="mt-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span>{task.projectName}</span>
                        <span>{taskDate ? formatTime(taskDate) : "--:--"}</span>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOverflowDateKey(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>Total tasks: {tasks.length}</span>
        <span>·</span>
        <span>Date property: {DATE_PROPERTY_OPTIONS.find((item) => item.value === dateProperty)?.label}</span>
        {dateProperty === "customDateField" && <span>· Field: {CUSTOM_DATE_FIELD_OPTIONS.find((item) => item.id === customDateFieldId)?.label}</span>}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        Priorities: high — {PRIORITY_LABELS.high}, medium — {PRIORITY_LABELS.medium}, low — {PRIORITY_LABELS.low}.
      </div>
    </>
  );
};

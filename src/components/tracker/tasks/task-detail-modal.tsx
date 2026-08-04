"use client";

import { useRouter } from "next/navigation";
import { HomeAvatarRing } from "@/components/home/home-avatar-ring";
import type { TaskPriority, TodayTask } from "@/components/home/tasks-today-demo-data";
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

const formatDeadline = (task: TodayTask) => {
  const date = new Date(task.deadlineAt);
  if (Number.isNaN(date.getTime())) {
    return task.deadlineLabel;
  }
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

export const TaskDetailModal = ({ task }: TaskDetailModalProps) => {
  const router = useRouter();

  const closeToTasks = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/tracker/tasks");
  };

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) {
          closeToTasks();
        }
      }}
    >
      {task ? (
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 pr-8">
              <span
                aria-hidden
                className={cn("size-2.5 shrink-0 rounded-full", COLOR_CLASS_BY_TASK[task.color])}
              />
              <span className="min-w-0 truncate">{task.title}</span>
            </DialogTitle>
            <DialogDescription>Project · {task.projectName}</DialogDescription>
          </DialogHeader>

          <dl className="grid gap-3">
            <div className="grid grid-cols-[6.5rem_1fr] items-center gap-3">
              <dt className="text-muted-foreground">Priority</dt>
              <dd>{PRIORITY_LABELS[task.priority]}</dd>
            </div>
            <div className="grid grid-cols-[6.5rem_1fr] items-center gap-3">
              <dt className="text-muted-foreground">Deadline</dt>
              <dd>{formatDeadline(task)}</dd>
            </div>
            <div className="grid grid-cols-[6.5rem_1fr] items-center gap-3">
              <dt className="text-muted-foreground">Assignee</dt>
              <dd className="flex min-w-0 items-center gap-2">
                {task.assigneeName !== "Unassigned" ? (
                  <HomeAvatarRing
                    src={task.assigneeAvatarUrl}
                    alt=""
                    size="20px"
                    className="size-5"
                  />
                ) : null}
                <span className="truncate">{task.assigneeName}</span>
              </dd>
            </div>
          </dl>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeToTasks}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      ) : (
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Task not found</DialogTitle>
            <DialogDescription>
              This demo task does not exist or is not available on this route.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" onClick={() => router.push("/tracker/tasks")}>
              Back to tasks
            </Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
};

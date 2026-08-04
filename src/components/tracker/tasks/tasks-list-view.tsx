"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";
import type { TaskPriority, TodayTask } from "@/components/home/tasks-today-demo-data";
import { COLOR_CLASS_BY_TASK } from "@/components/tracker/tasks/calendar/calendar-color-map";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

const PRIORITY_CLASS: Record<TaskPriority, string> = {
  high: "border-red-200 bg-red-50 text-red-700",
  medium: "border-amber-200 bg-amber-50 text-amber-700",
  low: "border-slate-200 bg-slate-50 text-slate-600",
};

type TasksListViewProps = {
  tasks: TodayTask[];
};

export const TasksListView = ({ tasks }: TasksListViewProps) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelected = (taskId: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(taskId);
      } else {
        next.delete(taskId);
      }
      return next;
    });
  };

  if (tasks.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--corportal-border-grey)] bg-card px-4 py-12 text-center text-sm text-muted-foreground">
        No tasks in this view
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--corportal-border-grey)] bg-card">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-10 px-3" />
            <TableHead className="px-3 text-xs">Title</TableHead>
            <TableHead className="px-3 text-xs">Project</TableHead>
            <TableHead className="w-28 px-3 text-xs">Priority</TableHead>
            <TableHead className="w-36 px-3 text-xs">Deadline</TableHead>
            <TableHead className="w-44 px-3 text-xs">Assignee</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => {
            const selected = selectedIds.has(task.id);

            return (
              <TableRow key={task.id} data-state={selected ? "selected" : undefined}>
                <TableCell className="px-3 py-2">
                  <Checkbox
                    checked={selected}
                    onCheckedChange={(value) => toggleSelected(task.id, value === true)}
                    aria-label={`Select task ${task.title}`}
                  />
                </TableCell>
                <TableCell className="max-w-0 min-w-[12rem] px-3 py-2">
                  <Link
                    href={task.href}
                    className="flex min-w-0 items-center gap-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={(event) => {
                      event.preventDefault();
                      toast.message(task.title, { description: "Task detail prototype is not open yet." });
                    }}
                  >
                    <span
                      aria-hidden
                      className={cn("size-2 shrink-0 rounded-full", COLOR_CLASS_BY_TASK[task.color])}
                    />
                    <span className="truncate text-sm font-medium text-foreground">{task.title}</span>
                  </Link>
                </TableCell>
                <TableCell className="max-w-[10rem] truncate px-3 py-2 text-sm text-muted-foreground">
                  {task.projectName}
                </TableCell>
                <TableCell className="px-3 py-2">
                  <Badge variant="outline" className={cn("font-normal", PRIORITY_CLASS[task.priority])}>
                    {PRIORITY_LABELS[task.priority]}
                  </Badge>
                </TableCell>
                <TableCell className="px-3 py-2 text-sm text-muted-foreground">{task.deadlineLabel}</TableCell>
                <TableCell className="px-3 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="relative size-6 shrink-0 overflow-hidden rounded-full border border-[var(--corportal-border-grey)] bg-muted">
                      <Image
                        src={task.assigneeAvatarUrl}
                        alt={`Avatar of ${task.assigneeName}`}
                        fill
                        sizes="24px"
                        className="object-cover"
                      />
                    </span>
                    <span className="truncate text-sm text-foreground">{task.assigneeName}</span>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};

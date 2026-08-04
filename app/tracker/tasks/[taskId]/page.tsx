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

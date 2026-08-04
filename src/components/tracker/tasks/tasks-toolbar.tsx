"use client";

import {
  CalendarDays,
  Columns3,
  FileText,
  Filter,
  LayoutList,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Table2,
} from "lucide-react";
import { HomeFilterChip } from "@/components/home/home-filter-chip";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import type { TasksView } from "@/features/tracker/tasks/tasks-page-state";
import { cn } from "@/lib/utils";

type TasksToolbarProps = {
  title: string;
  view: TasksView;
  onViewChange: (view: TasksView) => void;
  onAddTask: () => void;
  onRefresh?: () => void;
  onOpenSpaceSettings: () => void;
  onOpenProjectSettings: () => void;
  showOverview?: boolean;
  onOpenOverview?: () => void;
};

export const TasksToolbar = ({
  title,
  view,
  onViewChange,
  onAddTask,
  onRefresh,
  onOpenSpaceSettings,
  onOpenProjectSettings,
  showOverview = false,
  onOpenOverview,
}: TasksToolbarProps) => (
  <Card size="sm" className="ring-1 ring-[var(--corportal-border-grey)]">
    <CardHeader className="gap-0 space-y-3 pb-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <h1 className="text-lg font-semibold text-foreground">{title}</h1>
          <div className="flex flex-wrap items-center gap-1.5">
            {showOverview ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onOpenOverview}
                  aria-label="Open project overview settings"
                  className="gap-1.5 border-[var(--corportal-border-grey)] bg-card hover:bg-muted"
                >
                  <FileText aria-hidden className="size-3.5" />
                  Overview
                </Button>
                <div className="mx-1 h-5 w-px shrink-0 bg-border" aria-hidden />
              </>
            ) : null}
            <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Task views">
              <HomeFilterChip
                active={view === "table"}
                role="tab"
                aria-selected={view === "table"}
                ariaLabel="Table view"
                onClick={() => onViewChange("table")}
                className="gap-1.5"
              >
                <Table2 aria-hidden className="size-3.5" />
                Table
              </HomeFilterChip>
              <HomeFilterChip
                active={false}
                role="tab"
                aria-selected={false}
                ariaLabel="Board view (coming soon)"
                disabled
                title="Coming soon"
                className="gap-1.5 opacity-60"
              >
                <Columns3 aria-hidden className="size-3.5" />
                Board
              </HomeFilterChip>
              <HomeFilterChip
                active={view === "calendar"}
                role="tab"
                aria-selected={view === "calendar"}
                ariaLabel="Calendar view"
                onClick={() => onViewChange("calendar")}
                className="gap-1.5"
              >
                <CalendarDays aria-hidden className="size-3.5" />
                Calendar
              </HomeFilterChip>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                disabled
                title="Coming soon"
                aria-label="Add custom view (coming soon)"
                className="opacity-60"
              >
                <Plus aria-hidden className="size-3.5" />
              </Button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenSpaceSettings}
            aria-label="Open space settings"
            className="shrink-0"
          >
            <Settings aria-hidden className="size-3.5" />
            Space Settings
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenProjectSettings}
            aria-label="Open project settings"
            className="shrink-0"
          >
            <Settings aria-hidden className="size-3.5" />
            Project Settings
          </Button>
          <Button type="button" size="sm" onClick={onAddTask} className="shrink-0" aria-label="Create task">
            <Plus aria-hidden className="size-3.5" />
            Task
          </Button>
        </div>
      </div>

      <div className="-mx-3 border-t border-[var(--corportal-border-grey)]" aria-hidden />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-dashed"
          onClick={() => undefined}
          aria-label="Add filter"
        >
          <Filter aria-hidden className="size-3.5" />
          Add filter
        </Button>

        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Search in view" disabled>
            <Search aria-hidden className="size-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Layout settings" disabled>
            <LayoutList aria-hidden className="size-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="More actions" disabled>
            <MoreHorizontal aria-hidden className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Refresh"
            onClick={onRefresh}
            className={cn(!onRefresh && "pointer-events-none opacity-50")}
          >
            <RefreshCw aria-hidden className="size-3.5" />
          </Button>
        </div>
      </div>
    </CardHeader>
  </Card>
);

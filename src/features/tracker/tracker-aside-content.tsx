"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronRight, Folder, Plus } from "lucide-react";
import { ModuleSubnav } from "@/components/layout/module-subnav";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { TRACKER_SUBNAV_ITEMS } from "@/features/tracker/tracker-nav";
import {
  buildTasksHref,
  parseTasksPageState,
  TRACKER_DEMO_SPACES,
  type TasksScope,
  type TasksView,
} from "@/features/tracker/tasks/tasks-page-state";
import { cn } from "@/lib/utils";

type TrackerAsideContentProps = {
  onItemClick?: () => void;
};

const AsideSectionTitle = ({ children }: { children: string }) => (
  <p className="px-1 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
    {children}
  </p>
);

const AsideNavLink = ({
  href,
  label,
  active,
  onItemClick,
  indent = false,
}: {
  href: string;
  label: string;
  active: boolean;
  onItemClick?: () => void;
  indent?: boolean;
}) => (
  <Button
    variant="ghost"
    nativeButton={false}
    className={cn(
      "h-auto w-full justify-start rounded-lg px-2 py-1.5 text-left text-[12px] font-normal leading-[1.2] text-muted-foreground hover:bg-muted hover:text-foreground",
      indent && "pl-6",
      active && "bg-muted font-medium text-foreground",
    )}
    render={
      <Link
        href={href}
        onClick={onItemClick}
        aria-current={active ? "page" : undefined}
        aria-label={label}
        className="inline-flex w-full items-center gap-2"
      />
    }
  >
    {label}
  </Button>
);

export const TrackerAsideContent = ({ onItemClick }: TrackerAsideContentProps) => {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const pageState = useMemo(() => parseTasksPageState(searchParams), [searchParams]);
  const [holdingExpanded, setHoldingExpanded] = useState(true);

  const isTasksRoute = pathname === "/tracker/tasks" || pathname.startsWith("/tracker/tasks/");

  const hrefFor = (scope: TasksScope, view: TasksView) => buildTasksHref({ scope, view });

  const myTasksItems = [
    {
      id: "all",
      label: "All Tasks",
      href: hrefFor("all", "table"),
      active: isTasksRoute && pageState.scope === "all" && pageState.view === "table",
    },
    {
      id: "today",
      label: "For Today",
      href: hrefFor("today", "table"),
      active: isTasksRoute && pageState.scope === "today" && pageState.view === "table",
    },
    {
      id: "calendar",
      label: "Calendar",
      href: hrefFor(pageState.scope, "calendar"),
      active: isTasksRoute && pageState.view === "calendar",
    },
  ] as const;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
      <div className="flex flex-col gap-2">
        <AsideSectionTitle>Modules</AsideSectionTitle>
        <ModuleSubnav
          items={TRACKER_SUBNAV_ITEMS}
          navAriaLabel="Tracker sections"
          onItemClick={onItemClick}
          className="flex-none"
        />
      </div>

      <Separator />

      <div className="flex flex-col gap-2">
        <AsideSectionTitle>My Tasks</AsideSectionTitle>
        <nav aria-label="My tasks">
          <ul className="flex flex-col gap-0.5">
            {myTasksItems.map((item) => (
              <li key={item.id}>
                <AsideNavLink
                  href={item.href}
                  label={item.label}
                  active={item.active}
                  onItemClick={onItemClick}
                />
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <Separator />

      <div className="flex flex-col gap-2">
        <AsideSectionTitle>Favorites</AsideSectionTitle>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-auto justify-start px-2 py-1.5 text-[12px] font-normal text-muted-foreground"
          onClick={onItemClick}
        >
          <Plus aria-hidden className="size-3.5" />
          Add to favorites
        </Button>
      </div>

      <Separator />

      <div className="flex flex-col gap-2">
        <AsideSectionTitle>Spaces</AsideSectionTitle>
        <nav aria-label="Spaces">
          <ul className="flex flex-col gap-0.5">
            {TRACKER_DEMO_SPACES.map((space) => {
              if (space.children?.length) {
                return (
                  <li key={space.id} className="flex flex-col gap-0.5">
                    <button
                      type="button"
                      className="flex w-full items-center gap-1 rounded-lg px-2 py-1.5 text-left text-[12px] text-muted-foreground hover:bg-muted hover:text-foreground"
                      onClick={() => setHoldingExpanded((prev) => !prev)}
                      aria-expanded={holdingExpanded}
                    >
                      {holdingExpanded ? (
                        <ChevronDown aria-hidden className="size-3.5 shrink-0" />
                      ) : (
                        <ChevronRight aria-hidden className="size-3.5 shrink-0" />
                      )}
                      <Folder aria-hidden className="size-3.5 shrink-0" />
                      <span className="truncate">{space.label}</span>
                    </button>
                    {holdingExpanded
                      ? space.children.map((child) => (
                        <AsideNavLink
                          key={child.id}
                          href={hrefFor(child.id, pageState.view)}
                          label={child.label}
                          active={isTasksRoute && pageState.scope === child.id}
                          onItemClick={onItemClick}
                          indent
                        />
                      ))
                      : null}
                  </li>
                );
              }

              return (
                <li key={space.id}>
                  <AsideNavLink
                    href={hrefFor(space.id, pageState.view)}
                    label={space.label}
                    active={isTasksRoute && pageState.scope === space.id}
                    onItemClick={onItemClick}
                  />
                </li>
              );
            })}
          </ul>
        </nav>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-auto justify-start px-2 py-1.5 text-[12px] font-normal text-muted-foreground"
          onClick={onItemClick}
        >
          <Plus aria-hidden className="size-3.5" />
          Add space
        </Button>
      </div>
    </div>
  );
};

import { Suspense, type ReactNode } from "react";
import { ModuleShell } from "@/components/layout/module-shell";
import { ModuleSubnav } from "@/components/layout/module-subnav";
import { TRACKER_SUBNAV_ITEMS } from "@/features/tracker/tracker-nav";
import { TrackerAsideContent } from "@/features/tracker/tracker-aside-content";

type TrackerLayoutProps = {
  children: ReactNode;
};

const TrackerAsideFallback = () => (
  <ModuleSubnav items={TRACKER_SUBNAV_ITEMS} navAriaLabel="Tracker sections" />
);

const TrackerLayout = ({ children }: TrackerLayoutProps) => (
  <ModuleShell
    moduleTitle="Tracker"
    asideLabel="Tracker"
    subnavItems={TRACKER_SUBNAV_ITEMS}
    subnavAriaLabel="Tracker sections"
    asideContent={
      <Suspense fallback={<TrackerAsideFallback />}>
        <TrackerAsideContent />
      </Suspense>
    }
  >
    {children}
  </ModuleShell>
);

export default TrackerLayout;

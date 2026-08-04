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

/** Returns a copy for session drafts (descriptionHtml is a string). */
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

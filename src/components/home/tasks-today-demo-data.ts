export type TaskPriority = "high" | "medium" | "low";
export type TaskColor = "red" | "orange" | "blue" | "violet" | "emerald" | "pink";

export type TaskDateProperty = "deadline" | "createdAt" | "customDateField";

export type DemoTaskStageId = "questions" | "tasks";

export type DemoTaskStage = {
  id: DemoTaskStageId;
  name: string;
  order: number;
};

export const DEMO_TASK_STAGES: DemoTaskStage[] = [
  { id: "questions", name: "Questions", order: 1 },
  { id: "tasks", name: "Tasks", order: 2 },
];

export const DEFAULT_DEMO_TASK_STAGE_ID: DemoTaskStageId = "tasks";

export type ChecklistItem = {
  id: string;
  title: string;
  done: boolean;
  children: ChecklistItem[];
};

export type TodayTask = {
  id: string;
  /** Текст дедлайна для карточек в старом списке задач. */
  deadlineLabel: string;
  /** Дедлайн задачи в ISO-формате. */
  deadlineAt: string;
  /** Дата создания задачи в ISO-формате. */
  createdAt: string;
  /** Кастомные поля даты. Пока используем задел для календарной настройки. */
  customDateFields: Record<string, string>;
  color: TaskColor;
  priority: TaskPriority;
  title: string;
  /** Whether the task is marked complete. */
  done: boolean;
  projectName: string;
  comments: number;
  href: string;
  assigneeName: string;
  assigneeAvatarUrl: string;
  spaceId: string;
  stageId: DemoTaskStageId;
  checklist: ChecklistItem[];
};

export const DEMO_TASK_ASSIGNEES = [
  { id: "anna-petrova", name: "Anna Petrova" },
  { id: "dmitry-sokolov", name: "Dmitry Sokolov" },
  { id: "maria-egorova", name: "Maria Egorova" },
  { id: "pavel-gromov", name: "Pavel Gromov" },
] as const;

const DEMO_ASSIGNEES = DEMO_TASK_ASSIGNEES;

export const taskAssigneeAvatarUrl = (assigneeId: string) =>
  `https://i.pravatar.cc/40?u=task-assignee-${assigneeId}`;

const assigneeAvatarUrl = taskAssigneeAvatarUrl;

const pickAssignee = (taskId: string) => {
  const index = Math.abs(
    Array.from(taskId).reduce((hash, char) => hash + char.charCodeAt(0), 0),
  ) % DEMO_ASSIGNEES.length;
  return DEMO_ASSIGNEES[index];
};

const inferSpaceId = (projectName: string): string => {
  if (projectName.includes("IT ·") || projectName.startsWith("IT ")) {
    return "space-it";
  }
  if (projectName.includes("QA")) {
    return "space-qa";
  }
  if (projectName.includes("HR ·") || projectName.includes("Agile ·")) {
    return "space-management";
  }
  return "space-holding";
};

const pad2 = (value: number) => String(value).padStart(2, "0");

const addDays = (baseDate: Date, offset: number) => {
  const date = new Date(baseDate);
  date.setDate(date.getDate() + offset);
  return date;
};

const buildDateTime = (baseDate: Date, dayOffset: number, hour: number, minute: number) => {
  const date = addDays(baseDate, dayOffset);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
};

const formatDeadlineLabel = (isoDate: string, now: Date) => {
  const date = new Date(isoDate);
  const startOfTarget = new Date(date);
  startOfTarget.setHours(0, 0, 0, 0);
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const diffMs = startOfTarget.getTime() - startOfToday.getTime();
  const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));
  const time = `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;

  if (diffDays === 0) {
    return `Today, ${time}`;
  }

  if (diffDays === 1) {
    return `Tomorrow, ${time}`;
  }

  return `${pad2(date.getDate())}.${pad2(date.getMonth() + 1)}, ${time}`;
};

/**
 * Фиксированная точка времени для demo-данных.
 * Нужна, чтобы SSR/CSR генерировали одинаковый HTML и не ломали hydration.
 */
export const DEMO_REFERENCE_NOW = new Date("2026-04-19T09:00:00.000Z");

export const isTaskDueOnDemoToday = (task: TodayTask) => {
  const deadline = new Date(task.deadlineAt);
  if (Number.isNaN(deadline.getTime())) {
    return false;
  }

  return (
    deadline.getFullYear() === DEMO_REFERENCE_NOW.getFullYear() &&
    deadline.getMonth() === DEMO_REFERENCE_NOW.getMonth() &&
    deadline.getDate() === DEMO_REFERENCE_NOW.getDate()
  );
};

const createTask = (config: {
  id: string;
  title: string;
  projectName: string;
  priority: TaskPriority;
  comments: number;
  color: TaskColor;
  /** Omit deadline fields for Questions (no due date). */
  deadlineOffsetDays?: number;
  deadlineHour?: number;
  deadlineMinute?: number;
  createdOffsetDays: number;
  createdHour: number;
  createdMinute: number;
  customPlanningOffsetDays?: number;
  spaceId?: string;
  stageId?: DemoTaskStageId;
  assigneeName?: string;
  assigneeId?: string;
  done?: boolean;
  checklist?: ChecklistItem[];
}) => {
  const deadlineOffsetDays = config.deadlineOffsetDays;
  const deadlineHour = config.deadlineHour;
  const deadlineMinute = config.deadlineMinute;
  const hasDeadline =
    deadlineOffsetDays !== undefined &&
    deadlineHour !== undefined &&
    deadlineMinute !== undefined;
  const deadlineAt = hasDeadline
    ? buildDateTime(DEMO_REFERENCE_NOW, deadlineOffsetDays, deadlineHour, deadlineMinute)
    : "";
  const createdAt = buildDateTime(
    DEMO_REFERENCE_NOW,
    config.createdOffsetDays,
    config.createdHour,
    config.createdMinute,
  );
  const planningDate = hasDeadline
    ? buildDateTime(
      DEMO_REFERENCE_NOW,
      config.customPlanningOffsetDays ?? deadlineOffsetDays,
      deadlineHour,
      deadlineMinute,
    )
    : "";
  const assignee = config.assigneeId
    ? (DEMO_ASSIGNEES.find((item) => item.id === config.assigneeId) ?? pickAssignee(config.id))
    : pickAssignee(config.id);

  return {
    id: config.id,
    title: config.title,
    done: config.done ?? false,
    projectName: config.projectName,
    priority: config.priority,
    comments: config.comments,
    color: config.color,
    deadlineAt,
    createdAt,
    customDateFields: {
      planningDate,
    },
    deadlineLabel: hasDeadline
      ? formatDeadlineLabel(deadlineAt, DEMO_REFERENCE_NOW)
      : "No deadline",
    href: `/tracker/tasks/${config.id}`,
    assigneeName: config.assigneeName ?? assignee.name,
    assigneeAvatarUrl: assigneeAvatarUrl(config.assigneeId ?? assignee.id),
    spaceId: config.spaceId ?? inferSpaceId(config.projectName),
    stageId: config.stageId ?? DEFAULT_DEMO_TASK_STAGE_ID,
    checklist: config.checklist ?? [],
  } satisfies TodayTask;
};

const DEMO_QUESTIONS: TodayTask[] = [
  createTask({
    id: "task-1",
    stageId: "questions",
    title: "Approve container specification",
    projectName: "PIM · Order #59",
    priority: "high",
    comments: 5,
    color: "red",
    createdOffsetDays: -2,
    createdHour: 10,
    createdMinute: 10,
  }),
  createTask({
    id: "task-2",
    stageId: "questions",
    title: "Verify packing calculation before shipment",
    projectName: "Logistics · East Warehouse",
    priority: "medium",
    comments: 12,
    color: "orange",
    createdOffsetDays: -3,
    createdHour: 9,
    createdMinute: 20,
  }),
  createTask({
    id: "task-3",
    stageId: "questions",
    title: "Update ticket status in Service Desk",
    projectName: "IT · Service Desk",
    priority: "high",
    comments: 3,
    color: "violet",
    createdOffsetDays: -1,
    createdHour: 14,
    createdMinute: 45,
  }),
  createTask({
    id: "task-4",
    stageId: "questions",
    title: "Prepare weekly SLA summary report",
    projectName: "HR · Onboarding",
    priority: "low",
    comments: 0,
    color: "blue",
    createdOffsetDays: -4,
    createdHour: 11,
    createdMinute: 0,
  }),
  createTask({
    id: "task-101",
    stageId: "questions",
    title: "Confirm delivery window with courier service",
    projectName: "Operations · Last Mile",
    priority: "medium",
    comments: 4,
    color: "orange",
    createdOffsetDays: -2,
    createdHour: 13,
    createdMinute: 10,
  }),
  createTask({
    id: "task-102",
    stageId: "questions",
    title: "Reconcile SKU stock before inventory count",
    projectName: "Warehouse · Inventory",
    priority: "high",
    comments: 6,
    color: "red",
    createdOffsetDays: -1,
    createdHour: 16,
    createdMinute: 35,
  }),
  createTask({
    id: "task-5",
    stageId: "questions",
    title: "Approve packaging mockup with client",
    projectName: "PIM · Order #62",
    priority: "medium",
    comments: 2,
    color: "pink",
    createdOffsetDays: -2,
    createdHour: 8,
    createdMinute: 40,
  }),
  createTask({
    id: "task-6",
    stageId: "questions",
    title: "Update warehouse receiving instructions",
    projectName: "Logistics · Processes",
    priority: "low",
    comments: 7,
    color: "emerald",
    createdOffsetDays: -5,
    createdHour: 16,
    createdMinute: 20,
  }),
  createTask({
    id: "task-201",
    stageId: "questions",
    title: "Clarify VPN access for new contractors",
    projectName: "IT · Access",
    priority: "high",
    comments: 4,
    color: "red",
    createdOffsetDays: -1,
    createdHour: 11,
    createdMinute: 20,
    assigneeId: "anna-petrova",
    checklist: [
      { id: "cli-201-1", title: "List contractor roles that need VPN", done: true, children: [] },
      { id: "cli-201-2", title: "Confirm split-tunnel policy", done: false, children: [] },
      { id: "cli-201-3", title: "Align with security on MFA requirement", done: false, children: [] },
    ],
  }),
  createTask({
    id: "task-202",
    stageId: "questions",
    title: "Which MFA method should we enforce for admins?",
    projectName: "IT · Security",
    priority: "high",
    comments: 9,
    color: "violet",
    createdOffsetDays: -2,
    createdHour: 15,
    createdMinute: 5,
    assigneeId: "dmitry-sokolov",
    checklist: [
      {
        id: "cli-202-1",
        title: "Compare options",
        done: false,
        children: [
          { id: "cli-202-1-1", title: "Hardware keys", done: true, children: [] },
          { id: "cli-202-1-2", title: "Authenticator app", done: true, children: [] },
          { id: "cli-202-1-3", title: "SMS backup", done: false, children: [] },
        ],
      },
      { id: "cli-202-2", title: "Draft recommendation for IT leads", done: false, children: [] },
      { id: "cli-202-3", title: "Get security sign-off", done: false, children: [] },
    ],
  }),
  createTask({
    id: "task-203",
    stageId: "questions",
    title: "Confirm backup retention for staging DBs",
    projectName: "IT · Infra",
    priority: "medium",
    comments: 2,
    color: "orange",
    createdOffsetDays: -3,
    createdHour: 10,
    createdMinute: 40,
    assigneeId: "maria-egorova",
  }),
  createTask({
    id: "task-204",
    stageId: "questions",
    title: "Do we need a separate staging Kubernetes namespace?",
    projectName: "IT · Infra",
    priority: "medium",
    comments: 6,
    color: "blue",
    createdOffsetDays: -4,
    createdHour: 9,
    createdMinute: 15,
    assigneeId: "pavel-gromov",
  }),
  createTask({
    id: "task-205",
    stageId: "questions",
    title: "Who owns on-call rotation for Q3?",
    projectName: "IT · Monitoring",
    priority: "low",
    comments: 1,
    color: "emerald",
    createdOffsetDays: -5,
    createdHour: 16,
    createdMinute: 50,
    assigneeId: "anna-petrova",
  }),
  createTask({
    id: "task-206",
    stageId: "questions",
    title: "Approve laptop refresh budget for support team",
    projectName: "IT · Service Desk",
    priority: "medium",
    comments: 3,
    color: "pink",
    createdOffsetDays: -6,
    createdHour: 12,
    createdMinute: 0,
    assigneeId: "dmitry-sokolov",
  }),
  createTask({
    id: "task-207",
    stageId: "questions",
    title: "Can we deprecate the legacy LDAP sync job?",
    projectName: "IT · Access",
    priority: "low",
    comments: 5,
    color: "orange",
    createdOffsetDays: -7,
    createdHour: 14,
    createdMinute: 30,
    assigneeId: "maria-egorova",
  }),
];

/** Полный демо-список для страницы «Все задачи» (включает задачи на сегодня). */
export const ALL_TASKS: TodayTask[] = [
  ...DEMO_QUESTIONS,
  createTask({
    id: "task-7",
    stageId: "tasks",
    title: "Review delivery risk assessment",
    projectName: "Procurement · Contracts",
    priority: "high",
    comments: 1,
    color: "red",
    deadlineOffsetDays: 0,
    deadlineHour: 11,
    deadlineMinute: 0,
    createdOffsetDays: -1,
    createdHour: 9,
    createdMinute: 10,
    customPlanningOffsetDays: 1,
  }),
  createTask({
    id: "task-8",
    stageId: "tasks",
    title: "Complete pre-release checklist",
    projectName: "IT · Releases",
    priority: "medium",
    comments: 4,
    color: "orange",
    deadlineOffsetDays: 0,
    deadlineHour: 14,
    deadlineMinute: 0,
    createdOffsetDays: -3,
    createdHour: 12,
    createdMinute: 0,
    customPlanningOffsetDays: 5,
    checklist: [
      {
        id: "cli-8-1",
        title: "Pre-flight",
        done: false,
        children: [
          {
            id: "cli-8-1-1",
            title: "Build green",
            done: true,
            children: [
              {
                id: "cli-8-1-1-1",
                title: "Typecheck",
                done: true,
                children: [],
              },
              {
                id: "cli-8-1-1-2",
                title: "Unit tests",
                done: false,
                children: [],
              },
            ],
          },
          {
            id: "cli-8-1-2",
            title: "Changelog updated",
            done: false,
            children: [],
          },
        ],
      },
      {
        id: "cli-8-2",
        title: "Notify stakeholders",
        done: false,
        children: [],
      },
    ],
  }),
  createTask({
    id: "task-9",
    stageId: "tasks",
    title: "Update packaging cost calculation",
    projectName: "Finance · Cost Control",
    priority: "medium",
    comments: 6,
    color: "blue",
    deadlineOffsetDays: 0,
    deadlineHour: 10,
    deadlineMinute: 30,
    createdOffsetDays: -6,
    createdHour: 13,
    createdMinute: 5,
    customPlanningOffsetDays: 7,
  }),
  createTask({
    id: "task-10",
    stageId: "tasks",
    title: "Sync shipment plan with 3PL",
    projectName: "Operations · Deliveries",
    priority: "high",
    comments: 9,
    color: "violet",
    deadlineOffsetDays: 0,
    deadlineHour: 13,
    deadlineMinute: 45,
    createdOffsetDays: -2,
    createdHour: 15,
    createdMinute: 30,
    customPlanningOffsetDays: 3,
  }),
  createTask({
    id: "task-11",
    stageId: "tasks",
    title: "Prepare QA checklist for client demo",
    projectName: "Product · QA",
    priority: "low",
    comments: 1,
    color: "emerald",
    deadlineOffsetDays: 0,
    deadlineHour: 16,
    deadlineMinute: 0,
    createdOffsetDays: -4,
    createdHour: 11,
    createdMinute: 15,
    customPlanningOffsetDays: 2,
    checklist: [
      { id: "cli-11-1", title: "Smoke login", done: true, children: [] },
      { id: "cli-11-2", title: "Create order", done: false, children: [] },
      { id: "cli-11-3", title: "Export report", done: false, children: [] },
    ],
  }),
  createTask({
    id: "task-12",
    stageId: "tasks",
    title: "Collect feedback on the new request form",
    projectName: "CX · Support",
    priority: "medium",
    comments: 8,
    color: "pink",
    deadlineOffsetDays: 0,
    deadlineHour: 18,
    deadlineMinute: 15,
    createdOffsetDays: -7,
    createdHour: 10,
    createdMinute: 0,
    customPlanningOffsetDays: 9,
  }),
  createTask({
    id: "task-13",
    stageId: "tasks",
    title: "Verify SLA compliance for overnight incidents",
    projectName: "IT · Monitoring",
    priority: "high",
    comments: 2,
    color: "red",
    deadlineOffsetDays: 7,
    deadlineHour: 9,
    deadlineMinute: 30,
    createdOffsetDays: -1,
    createdHour: 17,
    createdMinute: 50,
    customPlanningOffsetDays: 10,
  }),
  createTask({
    id: "task-14",
    stageId: "tasks",
    title: "Prepare materials for team retro",
    projectName: "Agile · Team Ops",
    priority: "low",
    comments: 0,
    color: "blue",
    deadlineOffsetDays: 10,
    deadlineHour: 15,
    deadlineMinute: 0,
    createdOffsetDays: -9,
    createdHour: 9,
    createdMinute: 0,
    customPlanningOffsetDays: 12,
  }),
  createTask({
    id: "task-210",
    stageId: "tasks",
    title: "Roll out password policy update to all workstations",
    projectName: "IT · Security",
    priority: "high",
    comments: 7,
    color: "red",
    deadlineOffsetDays: 14,
    deadlineHour: 17,
    deadlineMinute: 0,
    createdOffsetDays: -3,
    createdHour: 10,
    createdMinute: 0,
    customPlanningOffsetDays: 10,
    assigneeId: "anna-petrova",
    checklist: [
      { id: "cli-210-1", title: "Draft policy changelog", done: true, children: [] },
      { id: "cli-210-2", title: "Pilot on IT laptops", done: false, children: [] },
      { id: "cli-210-3", title: "Company-wide rollout", done: false, children: [] },
    ],
  }),
  createTask({
    id: "task-211",
    stageId: "tasks",
    title: "Migrate CI runners to the new autoscaling pool",
    projectName: "IT · Infra",
    priority: "high",
    comments: 11,
    color: "violet",
    deadlineOffsetDays: 21,
    deadlineHour: 12,
    deadlineMinute: 0,
    createdOffsetDays: -8,
    createdHour: 9,
    createdMinute: 30,
    customPlanningOffsetDays: 18,
    assigneeId: "pavel-gromov",
  }),
  createTask({
    id: "task-212",
    stageId: "tasks",
    title: "Document disaster recovery runbook for Postgres",
    projectName: "IT · Infra",
    priority: "medium",
    comments: 4,
    color: "blue",
    deadlineOffsetDays: 28,
    deadlineHour: 16,
    deadlineMinute: 30,
    createdOffsetDays: -5,
    createdHour: 11,
    createdMinute: 15,
    customPlanningOffsetDays: 25,
    assigneeId: "maria-egorova",
    checklist: [
      { id: "cli-212-1", title: "RTO / RPO targets", done: true, children: [] },
      { id: "cli-212-2", title: "Failover drill steps", done: false, children: [] },
      { id: "cli-212-3", title: "Review with on-call leads", done: false, children: [] },
    ],
  }),
  createTask({
    id: "task-213",
    stageId: "tasks",
    title: "Upgrade observability stack to Grafana 11",
    projectName: "IT · Monitoring",
    priority: "medium",
    comments: 6,
    color: "orange",
    deadlineOffsetDays: 35,
    deadlineHour: 11,
    deadlineMinute: 0,
    createdOffsetDays: -10,
    createdHour: 13,
    createdMinute: 45,
    customPlanningOffsetDays: 30,
    assigneeId: "dmitry-sokolov",
  }),
  createTask({
    id: "task-214",
    stageId: "tasks",
    title: "Replace end-of-life VPN concentrators",
    projectName: "IT · Access",
    priority: "high",
    comments: 8,
    color: "red",
    deadlineOffsetDays: 45,
    deadlineHour: 18,
    deadlineMinute: 0,
    createdOffsetDays: -12,
    createdHour: 8,
    createdMinute: 20,
    customPlanningOffsetDays: 40,
    assigneeId: "pavel-gromov",
  }),
  createTask({
    id: "task-215",
    stageId: "tasks",
    title: "Plan Q3 capacity for Kubernetes cluster",
    projectName: "IT · Infra",
    priority: "medium",
    comments: 3,
    color: "emerald",
    deadlineOffsetDays: 60,
    deadlineHour: 15,
    deadlineMinute: 0,
    createdOffsetDays: -4,
    createdHour: 14,
    createdMinute: 10,
    customPlanningOffsetDays: 50,
    assigneeId: "anna-petrova",
    checklist: [
      { id: "cli-215-1", title: "Collect node utilization", done: true, children: [] },
      { id: "cli-215-2", title: "Forecast new services", done: false, children: [] },
      { id: "cli-215-3", title: "Budget request draft", done: false, children: [] },
    ],
  }),
  createTask({
    id: "task-216",
    stageId: "tasks",
    title: "Renew SSL certificates for public APIs",
    projectName: "IT · Security",
    priority: "high",
    comments: 2,
    color: "violet",
    deadlineOffsetDays: 75,
    deadlineHour: 10,
    deadlineMinute: 0,
    createdOffsetDays: -2,
    createdHour: 16,
    createdMinute: 0,
    customPlanningOffsetDays: 70,
    assigneeId: "maria-egorova",
  }),
  createTask({
    id: "task-217",
    stageId: "tasks",
    title: "Implement SSO for internal admin tools",
    projectName: "IT · Access",
    priority: "medium",
    comments: 10,
    color: "blue",
    deadlineOffsetDays: 90,
    deadlineHour: 17,
    deadlineMinute: 30,
    createdOffsetDays: -15,
    createdHour: 10,
    createdMinute: 45,
    customPlanningOffsetDays: 80,
    assigneeId: "dmitry-sokolov",
    checklist: [
      { id: "cli-217-1", title: "IdP app registrations", done: false, children: [] },
      { id: "cli-217-2", title: "Migrate first 3 tools", done: false, children: [] },
      { id: "cli-217-3", title: "Decommission local logins", done: false, children: [] },
    ],
  }),
  createTask({
    id: "task-218",
    stageId: "tasks",
    title: "Define annual hardware refresh roadmap",
    projectName: "IT · Service Desk",
    priority: "low",
    comments: 1,
    color: "pink",
    deadlineOffsetDays: 120,
    deadlineHour: 12,
    deadlineMinute: 0,
    createdOffsetDays: -20,
    createdHour: 9,
    createdMinute: 0,
    customPlanningOffsetDays: 100,
    assigneeId: "pavel-gromov",
  }),
  createTask({
    id: "task-219",
    stageId: "tasks",
    title: "Evaluate managed SIEM vendors for next FY",
    projectName: "IT · Security",
    priority: "low",
    comments: 5,
    color: "orange",
    deadlineOffsetDays: 150,
    deadlineHour: 14,
    deadlineMinute: 0,
    createdOffsetDays: -7,
    createdHour: 11,
    createdMinute: 30,
    customPlanningOffsetDays: 140,
    assigneeId: "anna-petrova",
  }),
];

/** Задачи с дедлайном на демо-сегодня (для home и scope=today). */
export const TODAY_TASKS: TodayTask[] = ALL_TASKS.filter(isTaskDueOnDemoToday);

export type ProjectBusinessRole = "Owner" | "Admin" | "Editor" | "Viewer";

export type ProjectMember = {
  id: string;
  userId: string;
  fullName: string;
  businessRole: ProjectBusinessRole;
};

export type SystemMember = {
  id: string;
  fullName: string;
  systemRole: string;
};

export type ProjectSpace = {
  id: string;
  name: string;
};

export type ProjectDraft = {
  id: string;
  name: string;
  description: string;
  spaceId: string;
  isArchived: boolean;
};

export type ProjectSettingsSeed = {
  project: ProjectDraft;
  spaces: ProjectSpace[];
  members: ProjectMember[];
  systemMembersBySpaceId: Record<string, SystemMember[]>;
  availableUsers: Array<{ userId: string; fullName: string }>;
  businessRoles: ProjectBusinessRole[];
};

const REALISTIC_NAMES = [
  "Indenbom Sergey", "Abakumova Anastasia", "Abgaryan Artur", "Abrahmanov Ilnar",
  "Abdullaeva Evgenia", "Petrova Anna", "Smirnov Ilya", "Sokolova Maria",
  "Volkov Dmitry", "Egorova Svetlana", "Kozlov Alexey", "Mironova Elena",
  "Frolov Maxim", "Subbotina Darya", "Vasiliev Kirill", "Kuznetsova Irina",
  "Tarasenko Evgeniy", "Semenova Olga", "Kovalev Andrey", "Lebedev Pavel",
  "Novikova Victoria", "Morozov Roman", "Fedorova Alina", "Popov Nikita",
  "Andreeva Yulia", "Belov Anton", "Zakharova Polina", "Orlov Timur",
  "Shestakova Ekaterina", "Gromov Stanislav", "Vlasova Natalia", "Titov Igor",
  "Safonova Diana", "Zhukov Oleg", "Borisova Tatiana", "Kalinin Vitaliy",
  "Krylova Elizaveta", "Panov Grigoriy", "Ryabova Ksenia", "Denisov Artyom",
  "Guseva Oksana", "Loginov Vadim", "Shcherbakova Marina", "Baranov Denis",
  "Komarova Irina", "Filippov Konstantin", "Davydova Alyona", "Stepanov Mikhail",
  "Kostina Veronika", "Belousov Danil",
];

const ROLE_DISTRIBUTION: ProjectBusinessRole[] = ["Owner", "Admin", "Admin", "Editor", "Editor", "Editor", "Viewer", "Viewer", "Viewer", "Viewer"];

const generateMembers = (count: number): ProjectMember[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `member-${i + 1}`,
    userId: `user-${i + 1}`,
    fullName: REALISTIC_NAMES[i % REALISTIC_NAMES.length],
    businessRole: ROLE_DISTRIBUTION[i % ROLE_DISTRIBUTION.length],
  }));

const AVAILABLE_NAMES = [
  "Chernov Alexander", "Bykova Angelina", "Zimin Georgiy", "Efimova Nadezhda",
  "Romanov Vladislav", "Makarova Valeriya", "Sorokin Evgeniy", "Zhdanova Larisa",
  "Tretyakov Ruslan", "Melnikova Karina",
];

const generateAvailableUsers = (startId: number, count: number) =>
  Array.from({ length: count }, (_, i) => ({
    userId: `user-${startId + i}`,
    fullName: AVAILABLE_NAMES[i % AVAILABLE_NAMES.length],
  }));

export const ROLE_WEIGHT: Record<ProjectBusinessRole, number> = {
  Owner: 0,
  Admin: 1,
  Editor: 2,
  Viewer: 3,
};

export const PROJECT_SETTINGS_SEED: ProjectSettingsSeed = {
  project: {
    id: "project-ecommerce",
    name: "Ecommerce",
    description:
      "<p>Project for managing supplies, catalog, and team tasks.</p><ul><li>Catalog updates</li><li>Supply planning</li></ul>",
    spaceId: "space-team",
    isArchived: false,
  },
  spaces: [
    { id: "space-team", name: "Team Space" },
    { id: "space-logistics", name: "Logistics Space" },
    { id: "space-operations", name: "Operations Space" },
  ],
  members: generateMembers(50),
  systemMembersBySpaceId: {
    "space-team": [
      { id: "sys-1", fullName: "Tarasenko Evgeniy", systemRole: "Space Owner" },
      { id: "sys-2", fullName: "Kozlov Alexey", systemRole: "Space Editor" },
      { id: "sys-3", fullName: "Mironova Elena", systemRole: "Space Viewer" },
    ],
    "space-logistics": [
      { id: "sys-4", fullName: "Frolov Maxim", systemRole: "Space Owner" },
      { id: "sys-5", fullName: "Smirnov Ilya", systemRole: "Logistics Operator" },
    ],
    "space-operations": [
      { id: "sys-6", fullName: "Kovalev Andrey", systemRole: "Space Owner" },
      { id: "sys-7", fullName: "Lebedev Pavel", systemRole: "Operations Controller" },
    ],
  },
  availableUsers: generateAvailableUsers(100, 10),
  businessRoles: ["Owner", "Admin", "Editor", "Viewer"],
};

export const MIGRATION_STEP_IDS = [
  "org-structure",
  "places",
  "people",
  "brigades",
  "assignments",
  "vacation-balance",
  "leave-history",
  "salary",
  "year-grid",
] as const;

export type MigrationStepId = (typeof MIGRATION_STEP_IDS)[number];

export type MigrationStepDef = {
  id: MigrationStepId;
  required: boolean;
  skippable: boolean;
  needsFile: boolean;
  writes: boolean;
};

export const MIGRATION_STEPS: MigrationStepDef[] = [
  { id: "org-structure", required: true, skippable: false, needsFile: true, writes: true },
  { id: "places", required: false, skippable: true, needsFile: true, writes: true },
  { id: "people", required: false, skippable: true, needsFile: true, writes: true },
  { id: "brigades", required: false, skippable: true, needsFile: true, writes: true },
  { id: "assignments", required: false, skippable: true, needsFile: true, writes: true },
  { id: "vacation-balance", required: false, skippable: true, needsFile: true, writes: true },
  { id: "leave-history", required: false, skippable: true, needsFile: true, writes: true },
  { id: "salary", required: false, skippable: true, needsFile: true, writes: true },
  { id: "year-grid", required: false, skippable: true, needsFile: false, writes: false },
];

export function isMigrationStepId(value: string): value is MigrationStepId {
  return (MIGRATION_STEP_IDS as readonly string[]).includes(value);
}

export const MIGRATION_DETAIL_LIMIT = 200;
export const MIGRATION_SOURCE = "import";

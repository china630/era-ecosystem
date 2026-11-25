export type AmbulatoryCarePlanStage = {
  code: string;
  title: string;
  serviceCodes?: string[];
  estimatedAmountAzn?: number;
  status: "PENDING" | "SCHEDULED" | "DONE" | "SKIPPED";
};

export const DEFAULT_CARE_PLAN_STAGES: AmbulatoryCarePlanStage[] = [
  { code: "STAGE-1", title: "Initial consultation", status: "PENDING" },
  { code: "STAGE-2", title: "Diagnostics", serviceCodes: [], status: "PENDING" },
  { code: "STAGE-3", title: "Follow-up", status: "PENDING" },
];
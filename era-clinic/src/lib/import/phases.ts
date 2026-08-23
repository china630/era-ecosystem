export type ImportPhaseId = "dictionaries" | "master" | "patients" | "quotas" | "clinical";

export type ImportPhaseDef = {
  id: ImportPhaseId;
  strictOrder: boolean;
  entities: string[];
};

export const IMPORT_PHASES: ImportPhaseDef[] = [
  { id: "dictionaries", strictOrder: false, entities: ["procedures", "rooms"] },
  { id: "master", strictOrder: true, entities: ["practitioners"] },
  { id: "patients", strictOrder: true, entities: ["patients"] },
  { id: "quotas", strictOrder: true, entities: ["quotas", "slots"] },
  {
    id: "clinical",
    strictOrder: true,
    entities: ["lab-catalog", "lab-orders", "diagnostics", "diagnoses"],
  },
];

export function flatImportEntityOrder(): string[] {
  return IMPORT_PHASES.flatMap((p) => p.entities);
}

export function priorEntities(entity: string): string[] {
  const order = flatImportEntityOrder();
  const idx = order.indexOf(entity);
  if (idx <= 0) return [];
  return order.slice(0, idx);
}

export type ImportPhaseId = "dictionaries" | "master" | "patients" | "quotas" | "clinical";

export type ImportPhaseDef = {
  id: ImportPhaseId;
  strictOrder: boolean;
  entities: string[];
};

export const IMPORT_PHASES: ImportPhaseDef[] = [
  {
    id: "dictionaries",
    strictOrder: false,
    entities: [
      "lab-catalog",
      "physio-sites",
      "procedures",
      "rooms",
      "procedure-requirements",
      "program-templates",
      "planning-rules",
    ],
  },
  { id: "master", strictOrder: false, entities: ["practitioners"] },
  { id: "patients", strictOrder: false, entities: ["patients"] },
  { id: "quotas", strictOrder: false, entities: ["quotas", "slots"] },
  {
    id: "clinical",
    strictOrder: false,
    entities: ["lab-orders", "lab-results", "diagnostics"],
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

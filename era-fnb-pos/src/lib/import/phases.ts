export type ImportPhaseId = "catalog" | "archive";

export type ImportPhaseDef = {
  id: ImportPhaseId;
  strictOrder: boolean;
  entities: string[];
};

export const IMPORT_PHASES: ImportPhaseDef[] = [
  {
    id: "catalog",
    strictOrder: true,
    entities: ["product-groups", "product-cards"],
  },
  {
    id: "archive",
    strictOrder: true,
    entities: ["fnb-transactions"],
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

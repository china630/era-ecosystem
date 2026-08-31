/** Ordered migration phases for Elektraweb bootstrap (super-admin hub). */

export type ImportPhaseId = 'dictionaries' | 'master' | 'transactional';

export type ImportPhaseDef = {
  id: ImportPhaseId;
  strictOrder: boolean;
  /** Entity slugs — must match adapter `entity` field. */
  entities: string[];
};

export const IMPORT_PHASES: ImportPhaseDef[] = [
  {
    id: 'dictionaries',
    strictOrder: false,
    entities: ['revenue-codes', 'bed-types', 'room-views'],
  },
  {
    id: 'master',
    strictOrder: true,
    entities: ['room-types', 'bar-bootstrap', 'rate-plans', 'package-sell', 'rooms', 'agencies', 'product-cards', 'stock-cards'],
  },
  {
    id: 'transactional',
    strictOrder: true,
    entities: ['guests', 'reservations', 'reservation-notes', 'folios', 'agency-statement'],
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

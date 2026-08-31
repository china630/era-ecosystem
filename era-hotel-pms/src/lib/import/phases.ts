/** Ordered migration phases — Nafta READY pack-layout #03–#15. */

export type ImportPhaseId = 'dictionaries' | 'master' | 'transactional';

export type ImportPhaseDef = {
  id: ImportPhaseId;
  strictOrder: boolean;
  /** Entity slugs — must match adapter `entity` field. */
  entities: string[];
};

/**
 * Hotel wizard only. Not on this form:
 * BAR bootstrap (no Nafta file) · FnB `#30–#32` · Retail `#33`.
 */
export const IMPORT_PHASES: ImportPhaseDef[] = [
  {
    id: 'dictionaries',
    strictOrder: false,
    entities: ['revenue-codes', 'bed-types', 'room-views'],
  },
  {
    id: 'master',
    strictOrder: true,
    entities: ['room-types', 'rate-plans', 'rooms', 'agencies'],
  },
  {
    id: 'transactional',
    strictOrder: true,
    entities: [
      'guests',
      'reservations',
      'reservation-notes',
      'folios',
      'package-sell',
      'agency-statement',
    ],
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

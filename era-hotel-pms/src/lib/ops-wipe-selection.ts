/**
 * Operational wipe keys. UI lists parents first (top → bottom).
 * Unchecking a child also clears every parent it references.
 * `OPS_WIPE_KEYS` is child-first so one server pass clears ancestors.
 */

export const OPS_WIPE_UI_KEYS = [
  'guests',
  'reservations',
  'folios',
  'medicalOrders',
  'folioCharges',
  'folioPayments',
  'reservationNotes',
  'guestNotes',
  'conciergeOrders',
  'banquetEvents',
  'medicalAlerts',
  'procedureAppointments',
  'labResults',
  'tourBookings',
  'transferOrders',
  'migrationRegistrations',
  'tourismSubmissions',
  'elektrawebOutbox',
] as const;

export const OPS_WIPE_KEYS = [
  'labResults',
  'folioCharges',
  'folioPayments',
  'reservationNotes',
  'guestNotes',
  'conciergeOrders',
  'banquetEvents',
  'medicalAlerts',
  'procedureAppointments',
  'tourBookings',
  'transferOrders',
  'migrationRegistrations',
  'tourismSubmissions',
  'elektrawebOutbox',
  'medicalOrders',
  'folios',
  'reservations',
  'guests',
] as const;

export type OpsWipeKey = (typeof OPS_WIPE_KEYS)[number];

/** Unchecking `child` also clears every parent in this map. */
export const OPS_PARENTS: Record<OpsWipeKey, OpsWipeKey[]> = {
  labResults: ['medicalOrders', 'reservations', 'guests'],
  folioCharges: ['folios', 'reservations', 'guests'],
  folioPayments: ['folios', 'reservations', 'guests'],
  reservationNotes: ['reservations', 'guests'],
  guestNotes: ['guests'],
  conciergeOrders: ['guests'],
  banquetEvents: ['reservations', 'guests'],
  medicalAlerts: ['reservations', 'guests'],
  procedureAppointments: ['reservations', 'guests'],
  tourBookings: ['reservations', 'guests'],
  transferOrders: ['reservations', 'guests'],
  migrationRegistrations: ['guests'],
  tourismSubmissions: ['reservations', 'guests'],
  elektrawebOutbox: [],
  medicalOrders: ['reservations', 'guests'],
  folios: ['reservations', 'guests'],
  reservations: ['guests'],
  guests: [],
};

export function normalizeWipeSelection(opsInput: readonly string[]): OpsWipeKey[] {
  const ops = new Set(
    opsInput.filter((k): k is OpsWipeKey => (OPS_WIPE_KEYS as readonly string[]).includes(k)),
  );
  for (const key of OPS_WIPE_KEYS) {
    if (ops.has(key)) continue;
    for (const parent of OPS_PARENTS[key]) ops.delete(parent);
  }
  return [...ops];
}

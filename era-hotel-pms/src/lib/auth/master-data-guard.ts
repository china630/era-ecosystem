import type { SatelliteSessionPayload } from '@era/satellite-kit';
import { assertAnyPermission, assertPermission } from './require';
import { PERMISSIONS } from './permissions';

export function assertMasterDataRead<S extends SatelliteSessionPayload>(
  session: S | null,
): asserts session is S {
  assertAnyPermission(session, [
    PERMISSIONS.MASTER_DATA_MANAGE,
    PERMISSIONS.RESERVATIONS_READ,
    PERMISSIONS.FOLIO_READ,
    PERMISSIONS.FOLIO_CHARGE,
  ]);
}

export function assertMasterDataWrite<S extends SatelliteSessionPayload>(
  session: S | null,
): asserts session is S {
  assertPermission(session, PERMISSIONS.MASTER_DATA_MANAGE);
}

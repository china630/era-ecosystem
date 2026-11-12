import type { SatelliteSessionPayload } from '@era/satellite-kit';
import { assertPermission } from './require';
import { PERMISSIONS, type Permission } from './permissions';

export function assertMasterDataRead<S extends SatelliteSessionPayload>(
  session: S | null,
  catalog: Permission = PERMISSIONS.MASTER_DATA_MANAGE,
): asserts session is S {
  assertPermission(session, catalog);
}

export function assertMasterDataWrite<S extends SatelliteSessionPayload>(
  session: S | null,
  catalog: Permission = PERMISSIONS.MASTER_DATA_MANAGE,
): asserts session is S {
  assertPermission(session, catalog);
}

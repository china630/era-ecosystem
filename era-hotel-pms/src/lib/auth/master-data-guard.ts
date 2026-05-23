import type { SessionPayload } from './jwt';
import { assertAnyPermission, assertPermission } from './require';
import { PERMISSIONS } from './permissions';

export function assertMasterDataRead(session: SessionPayload | null): void {
  assertAnyPermission(session, [
    PERMISSIONS.MASTER_DATA_MANAGE,
    PERMISSIONS.RESERVATIONS_READ,
    PERMISSIONS.FOLIO_READ,
    PERMISSIONS.FOLIO_CHARGE,
  ]);
}

export function assertMasterDataWrite(session: SessionPayload | null): void {
  assertPermission(session, PERMISSIONS.MASTER_DATA_MANAGE);
}

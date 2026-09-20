import { PERMISSIONS } from "@/lib/auth/permissions";
import {
  sessionHasHotelPermission,
  type HotelPermissionSession,
} from "@/lib/auth/permission-check";

/** Staff session may use bridge when granted api:integration.elektraweb_bridge. */
export function sessionMayUseBridge(
  session: HotelPermissionSession,
): boolean {
  return sessionHasHotelPermission(
    session,
    PERMISSIONS.API_INTEGRATION_ELEKTRAWEB_BRIDGE,
  );
}

/** S2S mint uses role=bridge and skips the staff grant matrix. */
export function isElektrawebBridgeS2SRole(role: string): boolean {
  return role.trim() === "bridge";
}

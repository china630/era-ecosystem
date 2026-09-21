import { SetMetadata } from "@nestjs/common";

export const PERMISSIONS_KEY = "permissions";

/** Any-of permission codes (Wave 4). Alias: RequirePermission. */
export const RequirePermissions = (...codes: string[]) =>
  SetMetadata(PERMISSIONS_KEY, codes);

export const RequirePermission = RequirePermissions;

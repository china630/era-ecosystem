import { SetMetadata } from "@nestjs/common";

export const PERMISSIONS_KEY = "permissions";

/** Require any-of the listed CP catalog keys (api:/admin:/screen:). */
export const Permissions = (...codes: string[]) =>
  SetMetadata(PERMISSIONS_KEY, codes);

/** Alias — Wave 5 PreferPermissions naming. */
export const RequirePermission = Permissions;

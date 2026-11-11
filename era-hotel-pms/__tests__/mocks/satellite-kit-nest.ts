import { UnauthorizedException } from "@nestjs/common";

export const SATELLITE_STAFF_SESSION = "satelliteStaffSession";

/** Jest stand-in so route tests do not load the real kit (jose ESM). */
export class SatelliteStaffSessionGuard {
  async canActivate(): Promise<boolean> {
    throw new UnauthorizedException();
  }
}

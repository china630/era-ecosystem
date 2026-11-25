jest.mock("@era/satellite-kit", () => ({
  hashPassword: jest.fn(async () => "hash"),
}));

import {
  SatelliteLoginTakenError,
  SatelliteTargetAmbiguousError,
  UnknownSatelliteRoleError,
} from "@/lib/staff-provision";
import { ROLE_ALIASES } from "@/lib/auth/permissions";

describe("construction staff-provision rules", () => {
  it("maps FOREMAN alias to SITE_MANAGER", () => {
    expect(ROLE_ALIASES.FOREMAN).toBe("SITE_MANAGER");
  });

  it("maps STAFF alias to SITE_MANAGER", () => {
    expect(ROLE_ALIASES.STAFF).toBe("SITE_MANAGER");
  });

  it("maps ADMIN alias to PROJECT_MANAGER", () => {
    expect(ROLE_ALIASES.ADMIN).toBe("PROJECT_MANAGER");
  });

  it("exposes LOGIN_TAKEN code", () => {
    const err = new SatelliteLoginTakenError("emp-abc");
    expect(err.code).toBe("LOGIN_TAKEN");
  });

  it("exposes TARGET_AMBIGUOUS code", () => {
    const err = new SatelliteTargetAmbiguousError("cp-1");
    expect(err.code).toBe("TARGET_AMBIGUOUS");
  });

  it("exposes UNKNOWN_SATELLITE_ROLE code", () => {
    const err = new UnknownSatelliteRoleError("NOPE");
    expect(err.code).toBe("UNKNOWN_SATELLITE_ROLE");
  });
});

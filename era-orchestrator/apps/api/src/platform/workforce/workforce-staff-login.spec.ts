import {
  defaultSatelliteStaffLogin,
  normalizeSatelliteStaffLogin,
  resolveSatelliteStaffLogin,
  resolveSatelliteStaffPin,
  assertSatelliteLoginAvailable,
} from "./workforce-staff-login";

describe("workforce-staff-login", () => {
  const empId = "08e0a901-1234-4678-9abc-def012345678";

  it("defaultSatelliteStaffLogin uses employment id hex prefix", () => {
    expect(defaultSatelliteStaffLogin(empId)).toBe("emp-08e0a901");
  });

  it("normalizeSatelliteStaffLogin lowercases valid login", () => {
    expect(normalizeSatelliteStaffLogin("Rena.Kangarli")).toBe("rena.kangarli");
  });

  it("resolve prefers override then stored then default", () => {
    expect(resolveSatelliteStaffLogin(empId, "stored.login", "override")).toBe(
      "override",
    );
    expect(resolveSatelliteStaffLogin(empId, "stored.login", undefined)).toBe(
      "stored.login",
    );
    expect(resolveSatelliteStaffLogin(empId, null, undefined)).toBe(
      "emp-08e0a901",
    );
  });

  it("resolveSatelliteStaffPin defaults to 0000", () => {
    expect(resolveSatelliteStaffPin(null, undefined)).toBe("0000");
    expect(resolveSatelliteStaffPin("1234", undefined)).toBe("1234");
    expect(resolveSatelliteStaffPin("1234", "9999")).toBe("9999");
  });

  describe("assertSatelliteLoginAvailable", () => {
    const ORG = "44444444-4444-4444-8444-444444444444";

    it("passes when login is free", async () => {
      const prisma = {
        workforceEmployment: { findFirst: jest.fn().mockResolvedValue(null) },
      };
      await expect(
        assertSatelliteLoginAvailable(prisma, ORG, "free.login"),
      ).resolves.toBeUndefined();
      expect(prisma.workforceEmployment.findFirst).toHaveBeenCalledWith({
        where: {
          organizationId: ORG,
          status: "ACTIVE",
          satelliteStaffLogin: { equals: "free.login", mode: "insensitive" },
        },
      });
    });

    it("throws LOGIN_TAKEN when another active employment holds the login", async () => {
      const prisma = {
        workforceEmployment: {
          findFirst: jest.fn().mockResolvedValue({ id: "other-emp" }),
        },
      };
      await expect(
        assertSatelliteLoginAvailable(prisma, ORG, "Taken.Login", "self-emp"),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: "LOGIN_TAKEN" }),
      });
      expect(prisma.workforceEmployment.findFirst).toHaveBeenCalledWith({
        where: {
          organizationId: ORG,
          status: "ACTIVE",
          satelliteStaffLogin: { equals: "taken.login", mode: "insensitive" },
          id: { not: "self-emp" },
        },
      });
    });
  });
});

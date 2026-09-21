import { NotFoundException, UnauthorizedException } from "@nestjs/common";
import { InternalOrganizationsController } from "./internal-organizations.controller";

describe("InternalOrganizationsController byPublicNumber", () => {
  const prev = {
    named: process.env.ORCHESTRATOR_INTERNAL_SERVICE_TOKEN,
    cp: process.env.CONTROL_PLANE_SERVICE_TOKEN,
    sat: process.env.SATELLITE_EVENT_SERVICE_TOKEN,
    nodeEnv: process.env.NODE_ENV,
  };

  afterEach(() => {
    restore("ORCHESTRATOR_INTERNAL_SERVICE_TOKEN", prev.named);
    restore("CONTROL_PLANE_SERVICE_TOKEN", prev.cp);
    restore("SATELLITE_EVENT_SERVICE_TOKEN", prev.sat);
    if (prev.nodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prev.nodeEnv;
  });

  function restore(key: string, value: string | undefined) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  function controller(findFirst: (args: unknown) => Promise<unknown>) {
    return new InternalOrganizationsController({
      organization: { findFirst },
    } as never);
  }

  it("rejects missing Bearer in production", async () => {
    process.env.NODE_ENV = "production";
    process.env.SATELLITE_EVENT_SERVICE_TOKEN = "sat-token";
    delete process.env.ORCHESTRATOR_INTERNAL_SERVICE_TOKEN;
    delete process.env.CONTROL_PLANE_SERVICE_TOKEN;
    const c = controller(async () => null);
    await expect(c.byPublicNumber("104221")).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("does not return a soft-deleted org", async () => {
    process.env.SATELLITE_EVENT_SERVICE_TOKEN = "sat-token";
    const c = controller(async () => null);
    await expect(
      c.byPublicNumber("104221", "Bearer sat-token"),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("returns the DEPARTMENT row, not the parent", async () => {
    process.env.SATELLITE_EVENT_SERVICE_TOKEN = "sat-token";
    const childId = "22222222-2222-4222-8222-222222222222";
    const c = controller(async (args) => {
      const where = (args as { where: { publicOrgNumber: number } }).where;
      expect(where.publicOrgNumber).toBe(204222);
      return {
        id: childId,
        publicOrgNumber: 204222,
        name: "Clinic dept",
      };
    });
    await expect(
      c.byPublicNumber("204222", "Bearer sat-token"),
    ).resolves.toEqual({
      organizationId: childId,
      publicOrgNumber: 204222,
      name: "Clinic dept",
    });
  });
});

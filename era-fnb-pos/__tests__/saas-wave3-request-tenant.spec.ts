/**
 * SaaS Wave 3 isolation — mocks kit to avoid jose ESM under CJS Jest.
 */
const als = { organizationId: undefined as string | undefined };

jest.mock("@era/satellite-kit", () => ({
  enterSatelliteTenant: (ctx: { organizationId?: string }) => {
    als.organizationId = ctx.organizationId;
  },
  resolveSatelliteTenantOrgId: () => als.organizationId ?? null,
  getSatelliteTenantContext: () =>
    als.organizationId ? { organizationId: als.organizationId } : undefined,
}));

import {
  enterRequestTenant,
  requestOrganizationId,
} from "@/lib/request-organization";

describe("saas wave 3 fnb request tenant", () => {
  beforeEach(() => {
    als.organizationId = undefined;
  });

  it("enterRequestTenant binds ALS used by requestOrganizationId", () => {
    enterRequestTenant("cccccccc-cccc-4ccc-8ccc-cccccccccccc");
    expect(requestOrganizationId()).toBe("cccccccc-cccc-4ccc-8ccc-cccccccccccc");
  });

  it("switching enterRequestTenant switches stamp org (org A then org B)", () => {
    enterRequestTenant("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    expect(requestOrganizationId()).toBe("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    enterRequestTenant("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
    expect(requestOrganizationId()).toBe("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
  });

  it("rejects empty organizationId on enter", () => {
    expect(() => enterRequestTenant("  ")).toThrow(/organizationId required/);
  });
});

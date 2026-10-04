const runtime = { deploymentTopology: "DEDICATED" as string };
let deploymentOrg: string | null = "bank-org-1";

jest.mock("@era/satellite-kit", () => ({
  ORG_NO_RE: /^\d{6}$/,
  enterSatelliteTenant: jest.fn(),
  readStaffLoginJson: jest.fn(),
  resolveStaffLoginTenant: jest.fn(async () => ({
    ok: false,
    status: 400,
    error: "orgNo is required",
  })),
  satelliteRuntimeConfig: () => runtime,
  satelliteOrganizationId: () => {
    if (!deploymentOrg) throw new Error("unbound");
    return deploymentOrg;
  },
}));

import { resolveDboChannelTenant } from "../lib/dbo-channel-tenant";

const request = new Request("http://dbo.local/api/auth/otp/request", { method: "POST" });

describe("DBO channel tenant", () => {
  beforeEach(() => {
    runtime.deploymentTopology = "DEDICATED";
    deploymentOrg = "bank-org-1";
  });

  it("DEDICATED without host or orgNo uses the deployment org", async () => {
    await expect(resolveDboChannelTenant(request)).resolves.toEqual({
      ok: true,
      organizationId: "bank-org-1",
    });
  });

  it("DEDICATED without a bound deployment org is refused with customer copy", async () => {
    deploymentOrg = null;
    await expect(resolveDboChannelTenant(request)).resolves.toEqual({
      ok: false,
      status: 400,
      error: "This channel is not available on this host",
    });
  });

  it("SHARED without host or orgNo is refused", async () => {
    runtime.deploymentTopology = "SHARED";
    await expect(resolveDboChannelTenant(request)).resolves.toEqual({
      ok: false,
      status: 400,
      error: "This channel is not available on this host",
    });
  });
});

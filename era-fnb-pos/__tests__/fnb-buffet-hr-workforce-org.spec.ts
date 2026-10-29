/**
 * HR leadership sync queries hub/parent workforce org, not only F&B commercial id.
 */

const resolveMode = jest.fn();
const resolvePolicy = jest.fn();

jest.mock("@/lib/request-organization", () => ({
  requestOrganizationId: () => "fnb-commercial",
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {},
}));

jest.mock("@era/satellite-kit", () => ({
  resolveOperatingMode: (...args: unknown[]) => resolveMode(...args),
  resolveSettlementPolicy: (...args: unknown[]) => resolvePolicy(...args),
  resolveOrchestratorBaseUrl: () => "http://orchestrator:4000",
  preferInClusterOrchestratorUrl: (u: string) => u,
  isRunningInsideDocker: () => true,
  isPublicOrchestratorUrl: () => true,
}));

import { resolveWorkforceOrganizationIds } from "@/lib/buffet-management-eaters.service";

describe("resolveWorkforceOrganizationIds", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("orders hub, parent, then self without duplicates", async () => {
    resolveMode.mockResolvedValue({ parentOrgId: "sanatorium" });
    resolvePolicy.mockResolvedValue({ hubOrganizationId: "hub-hotel" });
    await expect(resolveWorkforceOrganizationIds("fnb-commercial")).resolves.toEqual([
      "hub-hotel",
      "sanatorium",
      "fnb-commercial",
    ]);
  });

  it("falls back to self when no hub/parent", async () => {
    resolveMode.mockResolvedValue({ parentOrgId: null });
    resolvePolicy.mockResolvedValue({ hubOrganizationId: null });
    await expect(resolveWorkforceOrganizationIds()).resolves.toEqual([
      "fnb-commercial",
    ]);
  });
});

import { BadRequestException } from "@nestjs/common";
import { PlacementJobService } from "./placement-job.service";
import {
  isAllowedPlacementHop,
  isDirectSharedOnpremHop,
  SHARED_ONPREM_REJECT_MESSAGE,
} from "./placement-hops";
import { PlacementAdvanceAction } from "./dto/advance-placement-job.dto";

describe("placement hops", () => {
  it("allows ladder hops", () => {
    expect(isAllowedPlacementHop("SHARED", "DEDICATED")).toBe(true);
    expect(isAllowedPlacementHop("DEDICATED", "ONPREM")).toBe(true);
    expect(isAllowedPlacementHop("ONPREM", "DEDICATED")).toBe(true);
    expect(isAllowedPlacementHop("DEDICATED", "SHARED")).toBe(true);
  });

  it("rejects direct SHARED ↔ ONPREM", () => {
    expect(isDirectSharedOnpremHop("SHARED", "ONPREM")).toBe(true);
    expect(isDirectSharedOnpremHop("ONPREM", "SHARED")).toBe(true);
    expect(isAllowedPlacementHop("SHARED", "ONPREM")).toBe(false);
    expect(isAllowedPlacementHop("ONPREM", "SHARED")).toBe(false);
  });
});

describe("PlacementJobService createJob", () => {
  const prisma = {
    organization: { findUnique: jest.fn() },
    placementJob: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  };
  const bindSync = { syncForOrg: jest.fn() };
  const endpoints = { upsertEndpoint: jest.fn() };

  function svc() {
    return new PlacementJobService(
      prisma as never,
      bindSync as never,
      endpoints as never,
    );
  }

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.organization.findUnique.mockResolvedValue({ id: "org-1" });
  });

  it("creates REJECTED job for SHARED → ONPREM (negative path)", async () => {
    prisma.placementJob.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: "job-1", ...data }),
    );
    const job = await svc().createJob({
      organizationId: "org-1",
      satelliteKey: "industry_clinic",
      fromTopology: "SHARED",
      toTopology: "ONPREM",
    });
    expect(job.status).toBe("REJECTED");
    expect(job.errorMessage).toBe(SHARED_ONPREM_REJECT_MESSAGE);
    expect(prisma.placementJob.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "REJECTED" }),
      }),
    );
  });

  it("creates REJECTED job for ONPREM → SHARED", async () => {
    prisma.placementJob.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: "job-2", ...data }),
    );
    const job = await svc().createJob({
      organizationId: "org-1",
      satelliteKey: "industry_hotel",
      fromTopology: "ONPREM",
      toTopology: "SHARED",
    });
    expect(job.status).toBe("REJECTED");
  });

  it("creates PENDING job for SHARED → DEDICATED", async () => {
    prisma.placementJob.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: "job-3", ...data }),
    );
    const job = await svc().createJob({
      organizationId: "org-1",
      satelliteKey: "industry_clinic",
      fromTopology: "SHARED",
      toTopology: "DEDICATED",
    });
    expect(job.status).toBe("PENDING");
  });

  it("throws for unknown hop SHARED → SHARED", async () => {
    await expect(
      svc().createJob({
        organizationId: "org-1",
        satelliteKey: "industry_clinic",
        fromTopology: "SHARED",
        toTopology: "SHARED",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("exportSlice stores metadata only", async () => {
    prisma.placementJob.findUnique.mockResolvedValue({
      id: "job-4",
      organizationId: "org-1",
      satelliteKey: "industry_clinic",
      fromTopology: "SHARED",
      toTopology: "DEDICATED",
      status: "FREEZE",
      errorMessage: null,
      sliceMeta: null,
      targetBaseUrl: null,
    });
    prisma.placementJob.update.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: "job-4", status: data.status, sliceMeta: data.sliceMeta }),
    );
    const updated = await svc().advance("job-4", PlacementAdvanceAction.exportSlice);
    expect(updated.status).toBe("EXPORT");
    expect(updated.sliceMeta).toEqual(
      expect.objectContaining({ note: "not implemented full dump" }),
    );
  });
});

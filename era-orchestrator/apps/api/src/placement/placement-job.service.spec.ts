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
    organization: { findUnique: jest.fn(), update: jest.fn() },
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

  it("exportSlice for non-hotel stores honest not-implemented note", async () => {
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
      expect.objectContaining({
        note: "slice not implemented for industry_clinic",
        rowCounts: {},
      }),
    );
    expect(JSON.stringify(updated.sliceMeta)).not.toMatch(/not implemented full dump/);
  });

  it("lab hop SHARED→DEDICATED advances freeze→export→provision→bind→cutover→smoke→complete", async () => {
    const prevLab = process.env.ERA_PLACEMENT_SLICE_LAB;
    process.env.ERA_PLACEMENT_SLICE_LAB = "1";
    try {
      const base = {
        id: "job-lab",
        organizationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        satelliteKey: "industry_hotel_pms",
        fromTopology: "SHARED",
        toTopology: "DEDICATED",
        errorMessage: null,
        sliceMeta: null as unknown,
        targetBaseUrl: null as string | null,
      };
      let status = "PENDING";
      prisma.placementJob.findUnique.mockImplementation(() =>
        Promise.resolve({ ...base, status, targetBaseUrl: base.targetBaseUrl }),
      );
      prisma.placementJob.update.mockImplementation(({ data }: { data: Record<string, unknown> }) => {
        if (typeof data.status === "string") status = data.status;
        if (typeof data.targetBaseUrl === "string") base.targetBaseUrl = data.targetBaseUrl;
        if (data.sliceMeta) base.sliceMeta = data.sliceMeta as never;
        return Promise.resolve({ ...base, status, ...data });
      });
      prisma.organization.update.mockResolvedValue({ id: base.organizationId });
      bindSync.syncForOrg.mockResolvedValue({
        results: [{ ok: true, satelliteKey: "industry_hotel_pms" }],
      });
      endpoints.upsertEndpoint.mockResolvedValue({});

      expect((await svc().advance("job-lab", PlacementAdvanceAction.freeze)).status).toBe(
        "FREEZE",
      );
      const exported = await svc().advance("job-lab", PlacementAdvanceAction.exportSlice);
      expect(exported.status).toBe("EXPORT");
      expect(exported.sliceMeta).toEqual(
        expect.objectContaining({
          organizationId: base.organizationId,
          formatVersion: 1,
          rowCounts: expect.any(Object),
        }),
      );
      expect(String((exported.sliceMeta as { note: string }).note)).toMatch(
        /hotel curated json slice v1/,
      );
      expect(String((exported.sliceMeta as { note: string }).note)).not.toMatch(
        /not implemented full dump/,
      );
      expect((await svc().advance("job-lab", PlacementAdvanceAction.markProvisioned)).status).toBe(
        "PROVISION",
      );
      expect((await svc().advance("job-lab", PlacementAdvanceAction.bindAndConfig)).status).toBe(
        "BIND",
      );
      expect(
        (
          await svc().advance("job-lab", PlacementAdvanceAction.cutoverEndpoint, {
            targetBaseUrl: "https://hotel-dedicated.example",
          })
        ).status,
      ).toBe("CUTOVER");
      expect(endpoints.upsertEndpoint).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: base.organizationId,
          baseUrl: "https://hotel-dedicated.example",
        }),
      );
      expect((await svc().advance("job-lab", PlacementAdvanceAction.smoke)).status).toBe("SMOKE");
      expect((await svc().advance("job-lab", PlacementAdvanceAction.complete)).status).toBe("DONE");
      expect(prisma.organization.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { deploymentTopology: "DEDICATED" },
        }),
      );
    } finally {
      if (prevLab === undefined) delete process.env.ERA_PLACEMENT_SLICE_LAB;
      else process.env.ERA_PLACEMENT_SLICE_LAB = prevLab;
    }
  });

  it("refuses advance on REJECTED job", async () => {
    prisma.placementJob.findUnique.mockResolvedValue({
      id: "job-x",
      organizationId: "org-1",
      satelliteKey: "industry_clinic",
      fromTopology: "SHARED",
      toTopology: "ONPREM",
      status: "REJECTED",
      errorMessage: SHARED_ONPREM_REJECT_MESSAGE,
      sliceMeta: null,
      targetBaseUrl: null,
    });
    await expect(
      svc().advance("job-x", PlacementAdvanceAction.freeze),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

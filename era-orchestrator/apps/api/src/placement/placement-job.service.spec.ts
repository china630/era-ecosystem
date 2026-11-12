import { BadRequestException, ConflictException } from "@nestjs/common";
import {
  PlacementJobService,
  PLACEMENT_SKELETON_APPLY_LOG,
} from "./placement-job.service";
import {
  isAllowedPlacementHop,
  isDirectSharedOnpremHop,
  SHARED_ONPREM_REJECT_MESSAGE,
} from "./placement-hops";
import { PlacementAdvanceAction } from "./dto/advance-placement-job.dto";
import { buildPlacementCloneRecipe } from "./placement-recipe";

describe("placement hops", () => {
  it("allows ladder hops", () => {
    expect(isAllowedPlacementHop("SHARED", "DEDICATED")).toBe(true);
    expect(isAllowedPlacementHop("DEDICATED", "ONPREM")).toBe(true);
  });

  it("rejects direct SHARED ↔ ONPREM", () => {
    expect(isDirectSharedOnpremHop("SHARED", "ONPREM")).toBe(true);
    expect(isAllowedPlacementHop("SHARED", "ONPREM")).toBe(false);
  });
});

describe("buildPlacementCloneRecipe", () => {
  it("builds SINGLE_STACK recipe with services + composeYaml", () => {
    const recipe = buildPlacementCloneRecipe({
      organizationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      batchId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      satelliteKeys: ["industry_hotel_pms", "industry_clinic"],
      packaging: "SINGLE_STACK",
      targetHost: "https://dedicated.example",
      fromTopology: "SHARED",
      toTopology: "DEDICATED",
    });
    expect(recipe.formatVersion).toBe(1);
    expect(recipe.services).toHaveLength(2);
    expect(recipe.stackName).toContain("era-org-");
    expect(recipe.composeYaml).toContain("services:");
    expect(recipe.composeYaml).toContain("era/hotel-pms:latest");
  });
});

describe("PlacementJobService createBatch / Wave 2", () => {
  const prisma = {
    organization: { findUnique: jest.fn(), update: jest.fn() },
    placementJob: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    placementBatch: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    placementProcessLog: { create: jest.fn() },
    $transaction: jest.fn(),
  };
  const bindSync = { syncForOrg: jest.fn() };
  const endpoints = {
    upsertEndpoint: jest.fn(),
    resolveEndpoint: jest.fn(),
    resolveLaunchBaseUrl: jest.fn(),
  };

  function svc() {
    return new PlacementJobService(
      prisma as never,
      bindSync as never,
      endpoints as never,
    );
  }

  beforeEach(() => {
    jest.resetAllMocks();
    process.env.ERA_PLACEMENT_INLINE_LAB = "0";
    process.env.ERA_PLACEMENT_AUTOPILOT = "0";
    process.env.ERA_PLACEMENT_SLICE_LAB = "1";
    process.env.ERA_PLACEMENT_SMOKE_LAB = "1";
    process.env.ERA_PLACEMENT_HASH_LAB = "1";
    process.env.ERA_PLACEMENT_DISK_LAB = "1";
    prisma.organization.findUnique.mockResolvedValue({
      id: "org-1",
      settings: {},
    });
    prisma.organization.update.mockResolvedValue({ id: "org-1" });
    prisma.placementBatch.findFirst.mockResolvedValue(null);
    bindSync.syncForOrg.mockResolvedValue({ results: [] });
    prisma.placementBatch.update.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: "batch-1", ...data }),
    );
    prisma.placementProcessLog.create.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: "log-1", createdAt: new Date(), ...data }),
    );
    prisma.placementJob.findMany.mockResolvedValue([]);
    prisma.$transaction.mockImplementation(
      async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma),
    );
  });

  it("createBatch SHARED→DEDICATED stores recipe and PROVISION + process logs", async () => {
    prisma.placementBatch.create.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({
          id: "batch-1",
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        }),
    );
    prisma.placementJob.create.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({
          id: `job-${data.satelliteKey}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        }),
    );
    prisma.placementBatch.findUnique.mockResolvedValue({
      id: "batch-1",
      organizationId: "org-1",
      satelliteKeys: ["industry_hotel_pms"],
      packaging: "PER_SATELLITE",
      targetHost: "https://dedicated.example",
      status: "PROVISION",
      recipeJson: { formatVersion: 1, services: [] },
      jobs: [
        {
          id: "job-industry_hotel_pms",
          status: "PROVISION",
          applyLog: PLACEMENT_SKELETON_APPLY_LOG,
        },
      ],
      processLogs: [
        { phase: "START", message: "Batch started" },
        { phase: "PROVISION", message: "Clone recipe stored" },
      ],
    });

    const batch = await svc().createBatch({
      organizationId: "org-1",
      satelliteKeys: ["industry_hotel_pms"],
      fromTopology: "SHARED",
      toTopology: "DEDICATED",
      packaging: "PER_SATELLITE",
      targetHost: "https://dedicated.example",
    });

    expect(batch.status).toBe("PROVISION");
    expect(prisma.placementProcessLog.create).toHaveBeenCalled();
    expect(prisma.placementBatch.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          recipeJson: expect.objectContaining({ formatVersion: 1 }),
        }),
      }),
    );
  });

  it("createBatch without targetHost fails", async () => {
    await expect(
      svc().createBatch({
        organizationId: "org-1",
        satelliteKeys: ["industry_clinic"],
        fromTopology: "SHARED",
        toTopology: "DEDICATED",
        packaging: "PER_SATELLITE",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("createBatch SHARED→ONPREM is REJECTED", async () => {
    prisma.placementBatch.create.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: "batch-r", ...data }),
    );
    prisma.placementJob.create.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: "job-r", ...data }),
    );
    prisma.placementBatch.findUnique.mockResolvedValue({
      id: "batch-r",
      status: "REJECTED",
      errorMessage: SHARED_ONPREM_REJECT_MESSAGE,
      jobs: [{ id: "job-r", status: "REJECTED" }],
      processLogs: [],
    });

    const batch = await svc().createBatch({
      organizationId: "org-1",
      satelliteKeys: ["industry_clinic"],
      fromTopology: "SHARED",
      toTopology: "ONPREM",
      packaging: "SINGLE_STACK",
    });

    expect(batch.status).toBe("REJECTED");
  });

  it("rejects second active batch", async () => {
    prisma.placementBatch.findFirst.mockResolvedValue({
      id: "batch-active",
      status: "PROVISION",
    });
    await expect(
      svc().createBatch({
        organizationId: "org-1",
        satelliteKeys: ["industry_clinic"],
        fromTopology: "SHARED",
        toTopology: "DEDICATED",
        packaging: "PER_SATELLITE",
        targetHost: "https://x.example",
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("reportProvision ok → CONFIGURE with process log", async () => {
    prisma.placementJob.findUnique.mockResolvedValue({
      id: "job-1",
      organizationId: "org-1",
      batchId: "batch-1",
      satelliteKey: "industry_hotel_pms",
      fromTopology: "SHARED",
      toTopology: "DEDICATED",
      status: "PROVISION",
      errorMessage: null,
      sliceMeta: null,
      targetBaseUrl: "https://dedicated.example",
      applyLog: PLACEMENT_SKELETON_APPLY_LOG,
    });
    prisma.placementJob.update.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({
          id: "job-1",
          batchId: "batch-1",
          organizationId: "org-1",
          satelliteKey: "industry_hotel_pms",
          fromTopology: "SHARED",
          toTopology: "DEDICATED",
          targetBaseUrl: "https://dedicated.example",
          ...data,
        }),
    );

    const updated = await svc().reportProvision("job-1", {
      ok: true,
      applyLog: "mode=lab\nhealthcheck=simulated ok",
      healthSummary: "lab ok hotel:3201",
    });
    expect(updated.status).toBe("CONFIGURE");
    expect(prisma.placementProcessLog.create).toHaveBeenCalled();
  });

  it("reportProvision fail → FAILED", async () => {
    prisma.placementJob.findUnique.mockResolvedValue({
      id: "job-1",
      organizationId: "org-1",
      batchId: "batch-1",
      satelliteKey: "industry_clinic",
      fromTopology: "SHARED",
      toTopology: "DEDICATED",
      status: "PROVISION",
      errorMessage: null,
      sliceMeta: null,
      targetBaseUrl: "https://dedicated.example",
    });
    prisma.placementJob.update.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({
          id: "job-1",
          batchId: "batch-1",
          ...data,
        }),
    );

    const updated = await svc().reportProvision("job-1", {
      ok: false,
      applyLog: "error",
      errorMessage: "clone failed",
    });
    expect(updated.status).toBe("FAILED");
  });

  it("exportSlice for unsupported satellite fails closed", async () => {
    prisma.placementJob.findUnique.mockResolvedValue({
      id: "job-4",
      organizationId: "org-1",
      satelliteKey: "industry_retail",
      fromTopology: "SHARED",
      toTopology: "DEDICATED",
      status: "FREEZE",
      errorMessage: null,
      sliceMeta: null,
      targetBaseUrl: "https://dedicated.example",
      batchId: null,
    });
    prisma.placementJob.update.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: "job-4", ...data }),
    );

    const updated = await svc().advance(
      "job-4",
      PlacementAdvanceAction.exportSlice,
    );
    expect(updated.status).toBe("FAILED");
    expect(updated.errorMessage).toMatch(/slice not implemented for industry_retail/);
  });

  it("importSlice fails closed when OrgFullSliceV2 modelOrder empty", async () => {
    delete process.env.ERA_PLACEMENT_SLICE_LAB;
    prisma.placementJob.findUnique.mockResolvedValue({
      id: "job-5",
      organizationId: "org-1",
      satelliteKey: "industry_hotel_pms",
      fromTopology: "SHARED",
      toTopology: "DEDICATED",
      status: "EXPORT",
      errorMessage: null,
      sliceMeta: null,
      artifactRef: "placement://job-5/org-slice-v2",
      artifactJson: {
        organizationId: "org-1",
        formatVersion: 2,
        modelOrder: [],
        tables: [],
        rows: {},
        note: "satellite full org slice v2",
        checksum: "abcdef0123456789",
      },
      targetBaseUrl: "https://dedicated.example",
      batchId: null,
    });
    prisma.placementJob.update.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: "job-5", ...data }),
    );

    const updated = await svc().advance(
      "job-5",
      PlacementAdvanceAction.importSlice,
    );
    expect(updated.status).toBe("FAILED");
    expect(updated.errorMessage).toMatch(/modelOrder empty/);
  });

  it("listForHostAgent returns recipe", async () => {
    prisma.placementJob.findMany.mockResolvedValue([
      {
        id: "job-h",
        organizationId: "org-1",
        batchId: "batch-1",
        satelliteKey: "industry_hotel_pms",
        fromTopology: "SHARED",
        toTopology: "DEDICATED",
        status: "PROVISION",
        errorMessage: null,
        sliceMeta: null,
        targetBaseUrl: "https://dedicated.example",
        applyLog: PLACEMENT_SKELETON_APPLY_LOG,
        batch: {
          id: "batch-1",
          packaging: "SINGLE_STACK",
          satelliteKeys: ["industry_hotel_pms"],
          targetHost: "https://dedicated.example",
          recipeJson: { formatVersion: 1, stackName: "era-org-test" },
        },
      },
    ]);

    const rows = await svc().listForHostAgent();
    expect(rows[0].recipe).toEqual(
      expect.objectContaining({ formatVersion: 1 }),
    );
  });

  it("freeze sets org.settings.placementFreeze", async () => {
    prisma.placementJob.findUnique.mockResolvedValue({
      id: "job-1",
      organizationId: "org-1",
      batchId: "batch-1",
      satelliteKey: "industry_hotel_pms",
      fromTopology: "SHARED",
      toTopology: "DEDICATED",
      status: "CONFIGURE",
      errorMessage: null,
      sliceMeta: null,
      targetBaseUrl: "https://dedicated.example",
    });
    prisma.placementJob.update.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({
          id: "job-1",
          organizationId: "org-1",
          batchId: "batch-1",
          satelliteKey: "industry_hotel_pms",
          ...data,
        }),
    );

    const updated = await svc().advance(
      "job-1",
      PlacementAdvanceAction.freeze,
    );
    expect(updated.status).toBe("FREEZE");
    expect(prisma.organization.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          settings: expect.objectContaining({
            placementFreeze: expect.objectContaining({ active: true }),
          }),
        }),
      }),
    );
    expect(bindSync.syncForOrg).toHaveBeenCalledWith("org-1");
  });

  it("autopilot CONFIGURE→DONE for hotel lab", async () => {
    process.env.ERA_PLACEMENT_AUTOPILOT = "1";
    prisma.placementJob.findUnique.mockResolvedValue({
      id: "job-1",
      organizationId: "org-1",
      batchId: "batch-1",
      satelliteKey: "industry_hotel_pms",
      fromTopology: "SHARED",
      toTopology: "DEDICATED",
      status: "PROVISION",
      errorMessage: null,
      sliceMeta: null,
      artifactJson: null,
      artifactRef: null,
      targetBaseUrl: "https://dedicated.example",
      applyLog: PLACEMENT_SKELETON_APPLY_LOG,
    });
    prisma.placementJob.update.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({
          id: "job-1",
          organizationId: "org-1",
          batchId: "batch-1",
          satelliteKey: "industry_hotel_pms",
          fromTopology: "SHARED",
          toTopology: "DEDICATED",
          targetBaseUrl: "https://dedicated.example",
          artifactRef: data.artifactRef ?? "placement://job-1/org-slice-v2",
          artifactJson: data.artifactJson ?? {
            organizationId: "org-1",
            formatVersion: 2,
            modelOrder: ["_lab"],
            tables: [{ name: "_lab", rowCount: 0 }],
            rows: { _lab: [] },
            note: "satellite full org slice v2 (lab)",
            checksum: "labchecksum0123456789abcdef",
            objectStorage: { prefix: "org/org-1/", entries: [], stub: true },
          },
          ...data,
        }),
    );
    prisma.placementJob.findMany.mockResolvedValue([
      { status: "DONE" },
    ]);
    endpoints.upsertEndpoint.mockResolvedValue({});

    const updated = await svc().reportProvision("job-1", {
      ok: true,
      applyLog: "mode=lab\nok",
      healthSummary: "lab ok",
    });
    expect(updated.status).toBe("DONE");
    expect(endpoints.upsertEndpoint).toHaveBeenCalled();
    expect(prisma.organization.update).toHaveBeenCalled();
  });
});

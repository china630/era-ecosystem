import { createHash } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { SatelliteOrgBindSyncService } from "../admin/satellite-org-bind-sync.service";
import { SatelliteEndpointRegistryService } from "../satellite-events/satellite-endpoint-registry.service";
import {
  isAllowedPlacementHop,
  isDirectSharedOnpremHop,
  SHARED_ONPREM_REJECT_MESSAGE,
  type TopologyCode,
} from "./placement-hops";
import { PlacementAdvanceAction } from "./dto/advance-placement-job.dto";
import {
  buildPlacementCloneRecipe,
  type PlacementCloneRecipe,
} from "./placement-recipe";

/** Initial applyLog until host agent reports real provision output. */
export const PLACEMENT_SKELETON_APPLY_LOG = "skeleton: awaiting host agent apply";

/** Mirrors kit ORG_FULL_SLICE_* — avoid importing kit barrel (jose under Jest). */
const ORG_FULL_SLICE_FORMAT_VERSION = 2 as const;
const ORG_FULL_SLICE_NOTE = "satellite full org slice v2";
/** Mirrors kit DEFAULT_PLACEMENT_MIN_FREE_BYTES. */
const DEFAULT_PLACEMENT_MIN_FREE_BYTES = 2 * 1024 * 1024 * 1024;

function labSliceChecksum(
  organizationId: string,
  modelOrder: string[],
  tables: Array<{ name: string; rowCount: number }>,
): string {
  const payload = JSON.stringify({
    organizationId,
    modelOrder,
    tables,
    objectStorage: [] as string[],
  });
  return createHash("sha256").update(payload, "utf8").digest("hex").slice(0, 32);
}

function exportOrgSliceLabSummary(
  organizationId: string,
  satelliteKey: string,
) {
  const tables = [{ name: "_lab", rowCount: 0 }];
  const modelOrder = ["_lab"];
  return {
    organizationId,
    formatVersion: ORG_FULL_SLICE_FORMAT_VERSION,
    satelliteKey,
    modelOrder,
    tables,
    rowCounts: { _lab: 0 },
    note: `${ORG_FULL_SLICE_NOTE} (lab)`,
    checksum: labSliceChecksum(organizationId, modelOrder, tables),
    objectStorage: {
      prefix: `org/${organizationId}/`,
      entries: [] as Array<{ key: string }>,
      stub: true,
    },
  };
}

function sliceNotImplementedNote(satelliteKey: string): string {
  return `slice not implemented for ${satelliteKey.trim()}`;
}

const HOTEL_SATELLITE_KEYS = new Set([
  "industry_hotel_pms",
  "industry_hotel",
]);
const CLINIC_SATELLITE_KEYS = new Set(["industry_clinic"]);

function isHotelSatelliteKey(key: string): boolean {
  return HOTEL_SATELLITE_KEYS.has(key.trim());
}

function isClinicSatelliteKey(key: string): boolean {
  return CLINIC_SATELLITE_KEYS.has(key.trim());
}

function isSliceSupportedSatelliteKey(key: string): boolean {
  return isHotelSatelliteKey(key) || isClinicSatelliteKey(key);
}

function sliceNoteForKey(_key: string): string {
  return ORG_FULL_SLICE_NOTE;
}

type PlacementPackaging = "PER_SATELLITE" | "SINGLE_STACK";

type PlacementJobRow = {
  id: string;
  organizationId: string;
  batchId?: string | null;
  satelliteKey: string;
  fromTopology: TopologyCode;
  toTopology: TopologyCode;
  status: string;
  errorMessage: string | null;
  sliceMeta: unknown;
  artifactRef?: string | null;
  artifactJson?: unknown;
  applyLog?: string | null;
  targetBaseUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type PlacementProcessLogRow = {
  id: string;
  batchId: string | null;
  jobId: string | null;
  phase: string;
  level: string;
  message: string;
  detail: unknown;
  createdAt: Date;
};

type PlacementBatchRow = {
  id: string;
  organizationId: string;
  satelliteKeys: string[];
  fromTopology: TopologyCode;
  toTopology: TopologyCode;
  packaging: PlacementPackaging;
  targetHost: string | null;
  recipeJson?: unknown;
  status: string;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
  jobs?: PlacementJobRow[];
  processLogs?: PlacementProcessLogRow[];
};

export type HostAgentJobView = PlacementJobRow & {
  packaging: PlacementPackaging | null;
  batchSatelliteKeys: string[];
  targetHost: string | null;
  recipe: PlacementCloneRecipe | null;
  batchId: string | null;
};

@Injectable()
export class PlacementJobService {
  private readonly logger = new Logger(PlacementJobService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly bindSync: SatelliteOrgBindSyncService,
    private readonly endpoints: SatelliteEndpointRegistryService,
  ) {}

  async appendProcessLog(input: {
    batchId?: string | null;
    jobId?: string | null;
    phase: string;
    level?: "INFO" | "WARN" | "ERROR";
    message: string;
    detail?: Record<string, unknown>;
  }): Promise<PlacementProcessLogRow> {
    const row = await this.prisma.placementProcessLog.create({
      data: {
        batchId: input.batchId ?? null,
        jobId: input.jobId ?? null,
        phase: input.phase,
        level: input.level ?? "INFO",
        message: input.message.slice(0, 4000),
        detail: (input.detail ?? undefined) as never,
      },
    });
    this.logger.log(
      `[placement ${input.phase}] ${input.level ?? "INFO"} ${input.message}`,
    );
    return row as PlacementProcessLogRow;
  }

  async createJob(input: {
    organizationId: string;
    satelliteKey: string;
    fromTopology: TopologyCode;
    toTopology: TopologyCode;
    targetBaseUrl?: string;
  }): Promise<PlacementJobRow> {
    const org = await this.prisma.organization.findUnique({
      where: { id: input.organizationId },
      select: { id: true },
    });
    if (!org) throw new NotFoundException("Organization not found");

    if (isDirectSharedOnpremHop(input.fromTopology, input.toTopology)) {
      return this.prisma.placementJob.create({
        data: {
          organizationId: input.organizationId,
          satelliteKey: input.satelliteKey,
          fromTopology: input.fromTopology,
          toTopology: input.toTopology,
          status: "REJECTED",
          errorMessage: SHARED_ONPREM_REJECT_MESSAGE,
          targetBaseUrl: input.targetBaseUrl ?? null,
        },
      }) as Promise<PlacementJobRow>;
    }

    if (!isAllowedPlacementHop(input.fromTopology, input.toTopology)) {
      throw new BadRequestException(
        `Hop ${input.fromTopology} → ${input.toTopology} is not allowed. Allowed: SHARED→DEDICATED, DEDICATED→ONPREM, ONPREM→DEDICATED, DEDICATED→SHARED.`,
      );
    }

    return this.prisma.placementJob.create({
      data: {
        organizationId: input.organizationId,
        satelliteKey: input.satelliteKey,
        fromTopology: input.fromTopology,
        toTopology: input.toTopology,
        status: "PENDING",
        targetBaseUrl: input.targetBaseUrl ?? null,
      },
    }) as Promise<PlacementJobRow>;
  }

    /** Autopilot after CONFIGURE unless ERA_PLACEMENT_AUTOPILOT=0. */
  private autopilotEnabled(): boolean {
    return process.env.ERA_PLACEMENT_AUTOPILOT !== "0";
  }

  /**
   * Inline lab provision after Start.
   * Production: opt-in (`ERA_PLACEMENT_INLINE_LAB=1`).
   * Non-production: on unless explicitly `=0`.
   */
  private inlineLabEnabled(): boolean {
    if (process.env.ERA_PLACEMENT_INLINE_LAB === "1") return true;
    if (process.env.ERA_PLACEMENT_INLINE_LAB === "0") return false;
    return process.env.NODE_ENV !== "production";
  }

  private placementServiceToken(): string {
    return (
      process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim() ??
      process.env.PLATFORM_SERVICE_TOKEN?.trim() ??
      ""
    );
  }

  private minFreeBytes(): number {
    const raw = process.env.ERA_PLACEMENT_MIN_FREE_BYTES?.trim();
    if (!raw) return DEFAULT_PLACEMENT_MIN_FREE_BYTES;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0
      ? Math.floor(n)
      : DEFAULT_PLACEMENT_MIN_FREE_BYTES;
  }

  /**
   * Platform Start: create batch + recipe + child jobs at PROVISION.
   * Host agent (or inline lab) applies clone → CONFIGURE → autopilot to DONE.
   */
  async createBatch(input: {
    organizationId: string;
    satelliteKeys: string[];
    fromTopology: TopologyCode;
    toTopology: TopologyCode;
    packaging: PlacementPackaging;
    targetHost?: string;
  }): Promise<PlacementBatchRow> {
    const keys = [
      ...new Set(
        input.satelliteKeys
          .map((k) => k.trim())
          .filter((k) => k.length > 0),
      ),
    ];
    if (keys.length === 0) {
      throw new BadRequestException("satelliteKeys must not be empty");
    }

    const org = await this.prisma.organization.findUnique({
      where: { id: input.organizationId },
      select: { id: true },
    });
    if (!org) throw new NotFoundException("Organization not found");

    const active = await this.prisma.placementBatch.findFirst({
      where: {
        organizationId: input.organizationId,
        status: { notIn: ["DONE", "FAILED", "REJECTED"] },
      },
      select: { id: true, status: true },
    });
    if (active) {
      throw new ConflictException(
        `Organization already has an active placement batch ${active.id} (${active.status})`,
      );
    }

    const targetHost = input.targetHost?.trim() || null;
    const targetBaseUrl = targetHost;

    if (isDirectSharedOnpremHop(input.fromTopology, input.toTopology)) {
      const rejected = await this.prisma.$transaction(async (tx) => {
        const batch = await tx.placementBatch.create({
          data: {
            organizationId: input.organizationId,
            satelliteKeys: keys,
            fromTopology: input.fromTopology,
            toTopology: input.toTopology,
            packaging: input.packaging,
            targetHost,
            status: "REJECTED",
            errorMessage: SHARED_ONPREM_REJECT_MESSAGE,
          },
        });
        const jobs = await Promise.all(
          keys.map((satelliteKey) =>
            tx.placementJob.create({
              data: {
                organizationId: input.organizationId,
                batchId: batch.id,
                satelliteKey,
                fromTopology: input.fromTopology,
                toTopology: input.toTopology,
                status: "REJECTED",
                errorMessage: SHARED_ONPREM_REJECT_MESSAGE,
                targetBaseUrl,
              },
            }),
          ),
        );
        return { ...batch, jobs } as PlacementBatchRow;
      });
      await this.appendProcessLog({
        batchId: rejected.id,
        phase: "START",
        level: "ERROR",
        message: SHARED_ONPREM_REJECT_MESSAGE,
        detail: { from: input.fromTopology, to: input.toTopology },
      });
      return this.getBatch(rejected.id);
    }

    if (!isAllowedPlacementHop(input.fromTopology, input.toTopology)) {
      throw new BadRequestException(
        `Hop ${input.fromTopology} → ${input.toTopology} is not allowed. Allowed: SHARED→DEDICATED, DEDICATED→ONPREM, ONPREM→DEDICATED, DEDICATED→SHARED.`,
      );
    }

    if (!targetHost) {
      throw new BadRequestException(
        "targetHost is required for Wave 2 clone provision",
      );
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const batch = await tx.placementBatch.create({
        data: {
          organizationId: input.organizationId,
          satelliteKeys: keys,
          fromTopology: input.fromTopology,
          toTopology: input.toTopology,
          packaging: input.packaging,
          targetHost,
          status: "PROVISION",
          errorMessage: null,
        },
      });
      const recipe = buildPlacementCloneRecipe({
        organizationId: input.organizationId,
        batchId: batch.id,
        satelliteKeys: keys,
        packaging: input.packaging,
        targetHost,
        fromTopology: input.fromTopology,
        toTopology: input.toTopology,
      });
      const withRecipe = await tx.placementBatch.update({
        where: { id: batch.id },
        data: { recipeJson: recipe as never },
      });
      const jobs = await Promise.all(
        keys.map((satelliteKey) =>
          tx.placementJob.create({
            data: {
              organizationId: input.organizationId,
              batchId: batch.id,
              satelliteKey,
              fromTopology: input.fromTopology,
              toTopology: input.toTopology,
              status: "PROVISION",
              applyLog: PLACEMENT_SKELETON_APPLY_LOG,
              targetBaseUrl,
            },
          }),
        ),
      );
      return { ...withRecipe, jobs, recipe } as PlacementBatchRow & {
        recipe: PlacementCloneRecipe;
      };
    });

    await this.appendProcessLog({
      batchId: created.id,
      phase: "START",
      message: `Batch started → PROVISION (${keys.length} satellites, ${input.packaging})`,
      detail: {
        satelliteKeys: keys,
        packaging: input.packaging,
        targetHost,
        hop: `${input.fromTopology}→${input.toTopology}`,
      },
    });
    await this.appendProcessLog({
      batchId: created.id,
      phase: "PROVISION",
      message: this.inlineLabEnabled()
        ? "Clone recipe stored; scheduling inline lab provision"
        : "Clone recipe stored; waiting for host agent apply",
      detail: {
        stackName: (created as { recipe?: PlacementCloneRecipe }).recipe
          ?.stackName,
        services: keys,
        inlineLab: this.inlineLabEnabled(),
        autopilot: this.autopilotEnabled(),
      },
    });

    if (this.inlineLabEnabled()) {
      const batchId = created.id;
      setImmediate(() => {
        this.runInlineLabProvision(batchId).catch((err) => {
          this.logger.error(
            `inline lab provision failed for batch ${batchId}: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        });
      });
    }

    return this.getBatch(created.id);
  }

  /** Lab path without host agent — simulates healthy empty clone per PROVISION job. */
  async runInlineLabProvision(batchId: string): Promise<void> {
    const jobs = await this.listForHostAgent();
    const mine = jobs.filter((j) => j.batchId === batchId);
    for (const job of mine) {
      const recipe = job.recipe;
      const svc =
        recipe?.services?.find((s) => s.satelliteKey === job.satelliteKey) ??
        null;
      const applyLog = [
        "mode=lab",
        "source=inline-orchestrator",
        `batchId=${batchId}`,
        `stack=${recipe?.stackName ?? "-"}`,
        `service=${svc?.serviceName ?? job.satelliteKey}`,
        `image=${svc?.image ?? "-"}`,
        "action=dry-run compose up (containers not started)",
        "healthcheck=simulated ok",
      ].join("\n");
      await this.reportProvision(job.id, {
        ok: true,
        applyLog,
        healthSummary: `inline lab ok ${svc?.serviceName ?? job.satelliteKey}`,
      });
    }
  }

  async getBatch(batchId: string): Promise<PlacementBatchRow> {
    const batch = await this.prisma.placementBatch.findUnique({
      where: { id: batchId },
      include: {
        jobs: { orderBy: { createdAt: "asc" } },
        processLogs: { orderBy: { createdAt: "asc" }, take: 200 },
      },
    });
    if (!batch) throw new NotFoundException("Placement batch not found");
    return batch as PlacementBatchRow;
  }

  async listBatchesForOrg(organizationId: string): Promise<PlacementBatchRow[]> {
    return this.prisma.placementBatch.findMany({
      where: { organizationId },
      include: {
        jobs: { orderBy: { createdAt: "asc" } },
        processLogs: { orderBy: { createdAt: "asc" }, take: 200 },
      },
      orderBy: { createdAt: "desc" },
    }) as Promise<PlacementBatchRow[]>;
  }

  async listForOrg(organizationId: string): Promise<PlacementJobRow[]> {
    return this.prisma.placementJob.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
    }) as Promise<PlacementJobRow[]>;
  }

  /**
   * Host agent poll: PROVISION jobs with batch recipe.
   */
  async listForHostAgent(): Promise<HostAgentJobView[]> {
    const jobs = (await this.prisma.placementJob.findMany({
      where: { status: "PROVISION" },
      orderBy: { createdAt: "asc" },
      take: 50,
      include: {
        batch: {
          select: {
            id: true,
            packaging: true,
            satelliteKeys: true,
            targetHost: true,
            recipeJson: true,
          },
        },
      },
    })) as Array<
      PlacementJobRow & {
        batch: {
          id: string;
          packaging: PlacementPackaging;
          satelliteKeys: string[];
          targetHost: string | null;
          recipeJson: unknown;
        } | null;
      }
    >;

    return jobs.map((job) => ({
      ...job,
      batchId: job.batchId ?? job.batch?.id ?? null,
      packaging: job.batch?.packaging ?? null,
      batchSatelliteKeys: job.batch?.satelliteKeys ?? [job.satelliteKey],
      targetHost: job.batch?.targetHost ?? job.targetBaseUrl,
      recipe: (job.batch?.recipeJson as PlacementCloneRecipe | null) ?? null,
    }));
  }

  async reportApplyLog(
    jobId: string,
    applyLog: string,
  ): Promise<PlacementJobRow> {
    const job = await this.prisma.placementJob.findUnique({
      where: { id: jobId },
    });
    if (!job) throw new NotFoundException("Placement job not found");
    const updated = (await this.prisma.placementJob.update({
      where: { id: jobId },
      data: { applyLog: applyLog.slice(0, 20000) },
    })) as PlacementJobRow;
    await this.appendProcessLog({
      batchId: job.batchId,
      jobId: job.id,
      phase: "PROVISION",
      message: "Host agent applyLog updated",
      detail: { bytes: applyLog.length, satelliteKey: job.satelliteKey },
    });
    return updated;
  }

  /**
   * Wave 2: host agent reports clone apply result.
   * ok → CONFIGURE (+ configure stub log). fail → FAILED.
   */
  async reportProvision(
    jobId: string,
    input: {
      ok: boolean;
      applyLog?: string;
      errorMessage?: string;
      healthSummary?: string;
    },
  ): Promise<PlacementJobRow> {
    const job = (await this.prisma.placementJob.findUnique({
      where: { id: jobId },
    })) as PlacementJobRow | null;
    if (!job) throw new NotFoundException("Placement job not found");
    if (job.status !== "PROVISION") {
      throw new BadRequestException(
        `Job is ${job.status}; reportProvision only from PROVISION`,
      );
    }

    const applyLog =
      input.applyLog?.trim() ||
      (input.ok
        ? "host agent: clone apply ok"
        : "host agent: clone apply failed");

    if (!input.ok) {
      await this.appendProcessLog({
        batchId: job.batchId,
        jobId: job.id,
        phase: "PROVISION",
        level: "ERROR",
        message: input.errorMessage ?? "Clone provision failed",
        detail: {
          satelliteKey: job.satelliteKey,
          healthSummary: input.healthSummary,
        },
      });
      const failed = (await this.prisma.placementJob.update({
        where: { id: jobId },
        data: {
          status: "FAILED",
          errorMessage: input.errorMessage ?? "Clone provision failed",
          applyLog: applyLog.slice(0, 20000),
        },
      })) as PlacementJobRow;
      await this.syncBatchStatus(failed.batchId);
      return failed;
    }

    await this.prisma.placementJob.update({
      where: { id: jobId },
      data: { applyLog: applyLog.slice(0, 20000) },
    });
    await this.appendProcessLog({
      batchId: job.batchId,
      jobId: job.id,
      phase: "PROVISION",
      message: `Clone healthy for ${job.satelliteKey}`,
      detail: {
        healthSummary: input.healthSummary ?? "ok",
        applyLogBytes: applyLog.length,
      },
    });

    const configured = await this.runConfigure({ ...job, applyLog });
    if (!this.autopilotEnabled()) return configured;
    return this.runAutopilotFromFreeze(configured);
  }

  private async runConfigure(job: PlacementJobRow): Promise<PlacementJobRow> {
    const secretHint = `reissued-${job.id.slice(0, 8)}-${Date.now().toString(36)}`;
    let syncOk = true;
    let syncDetail: Record<string, unknown> = {};
    try {
      const result = await this.bindSync.syncForOrg(job.organizationId);
      const failed = result.results.filter((r) => !r.ok);
      syncOk = failed.length === 0;
      syncDetail = {
        synced: result.results.length,
        failed: failed.map((f) => f.satelliteKey),
      };
      if (failed.length) {
        this.logger.warn(
          `PlacementJob ${job.id} configure Sync partial: ${failed
            .map((f) => f.satelliteKey)
            .join(",")}`,
        );
      }
    } catch (err) {
      syncOk = false;
      syncDetail = {
        error: err instanceof Error ? err.message : String(err),
      };
    }

    await this.appendProcessLog({
      batchId: job.batchId,
      jobId: job.id,
      phase: "CONFIGURE",
      level: syncOk ? "INFO" : "WARN",
      message: syncOk
        ? "Configure: platform secret markers re-issued + runtime-config Sync pushed"
        : "Configure: Sync partial/failed — continuing with secret marker only",
      detail: {
        satelliteKey: job.satelliteKey,
        targetBaseUrl: job.targetBaseUrl,
        secretHint,
        sync: syncDetail,
        note: "Pool secrets never copied; endpoint not cut over until CUTOVER",
      },
    });

    const prevMeta =
      job.sliceMeta && typeof job.sliceMeta === "object" && !Array.isArray(job.sliceMeta)
        ? (job.sliceMeta as Record<string, unknown>)
        : {};
    const updated = (await this.prisma.placementJob.update({
      where: { id: job.id },
      data: {
        status: "CONFIGURE",
        errorMessage: syncOk
          ? null
          : `Configure Sync warn: ${JSON.stringify(syncDetail).slice(0, 500)}`,
        sliceMeta: {
          ...prevMeta,
          configure: { secretHint, syncOk, at: new Date().toISOString() },
        } as never,
      },
    })) as PlacementJobRow;
    await this.syncBatchStatus(updated.batchId);
    return updated;
  }

  /**
   * After CONFIGURE: FREEZE → EXPORT → IMPORT → CUTOVER → SMOKE → DONE.
   * Failures mark FAILED and clear freeze when possible.
   */
  private async runAutopilotFromFreeze(
    job: PlacementJobRow,
  ): Promise<PlacementJobRow> {
    await this.appendProcessLog({
      batchId: job.batchId,
      jobId: job.id,
      phase: "AUTOPILOT",
      message: "Autopilot started (FREEZE→…→DONE)",
    });

    let current = await this.runFreeze(job);
    if (current.status === "FAILED" || current.status === "ROLLBACK") {
      return current;
    }

    current = await this.runPreflightGates(current);
    if (current.status === "FAILED") {
      await this.clearOrgPlacementFreeze(job.organizationId).catch(() => undefined);
      return current;
    }

    current = await this.exportSlice(current);
    if (current.status === "FAILED") {
      await this.clearOrgPlacementFreeze(job.organizationId).catch(() => undefined);
      return current;
    }

    current = await this.runImportSlice(current);
    if (current.status === "FAILED") {
      await this.clearOrgPlacementFreeze(job.organizationId).catch(() => undefined);
      return current;
    }

    try {
      current = await this.cutoverEndpoint(current);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await this.clearOrgPlacementFreeze(job.organizationId).catch(() => undefined);
      return this.failJob(current, `cutover: ${msg}`);
    }

    current = await this.runSmoke(current);
    if (current.status === "FAILED") {
      await this.clearOrgPlacementFreeze(job.organizationId).catch(() => undefined);
      return current;
    }

    await this.clearOrgPlacementFreeze(job.organizationId);
    try {
      await this.bindSync.syncForOrg(job.organizationId);
    } catch (err) {
      this.logger.warn(
        `post-DONE Sync after unfreeze: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    await this.appendProcessLog({
      batchId: job.batchId,
      jobId: job.id,
      phase: "DONE",
      message: "Autopilot complete",
    });
    return this.complete(current);
  }

  private async setOrgPlacementFreeze(
    organizationId: string,
    active: boolean,
    batchId?: string | null,
  ): Promise<void> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { settings: true },
    });
    const settings =
      org?.settings && typeof org.settings === "object" && !Array.isArray(org.settings)
        ? { ...(org.settings as Record<string, unknown>) }
        : {};
    if (active) {
      settings.placementFreeze = {
        active: true,
        batchId: batchId ?? null,
        since: new Date().toISOString(),
      };
    } else {
      delete settings.placementFreeze;
    }
    await this.prisma.organization.update({
      where: { id: organizationId },
      data: { settings: settings as never },
    });
  }

  private async clearOrgPlacementFreeze(organizationId: string): Promise<void> {
    await this.setOrgPlacementFreeze(organizationId, false);
  }

  private async runFreeze(job: PlacementJobRow): Promise<PlacementJobRow> {
    try {
      await this.setOrgPlacementFreeze(
        job.organizationId,
        true,
        job.batchId,
      );
      try {
        await this.bindSync.syncForOrg(job.organizationId);
      } catch (err) {
        this.logger.warn(
          `freeze Sync: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      await this.appendProcessLog({
        batchId: job.batchId,
        jobId: job.id,
        phase: "FREEZE",
        message:
          "Write freeze active (org.settings.placementFreeze → Sync → satellite 423)",
        detail: {
          organizationId: job.organizationId,
          note: "Cron/queue workers must honor isOrganizationPlacementFrozen",
        },
      });
      return this.setStatus(job.id, "FREEZE", { errorMessage: null });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await this.appendProcessLog({
        batchId: job.batchId,
        jobId: job.id,
        phase: "FREEZE",
        level: "ERROR",
        message: msg,
      });
      return this.failJob(job, `freeze: ${msg}`);
    }
  }

  /**
   * Migration-hash + disk gates before EXPORT.
   * Lab: ERA_PLACEMENT_HASH_LAB=1 / ERA_PLACEMENT_DISK_LAB=1 skip.
   */
  private async runPreflightGates(
    job: PlacementJobRow,
  ): Promise<PlacementJobRow> {
    if (!isSliceSupportedSatelliteKey(job.satelliteKey)) {
      return this.failJob(job, sliceNotImplementedNote(job.satelliteKey));
    }

    const skipHash = process.env.ERA_PLACEMENT_HASH_LAB === "1";
    const skipDisk =
      process.env.ERA_PLACEMENT_DISK_LAB === "1" ||
      process.env.ERA_PLACEMENT_SLICE_LAB === "1";

    try {
      const targetUrl = job.targetBaseUrl?.trim();
      if (!targetUrl) {
        throw new Error("targetBaseUrl missing for preflight");
      }

      const sourceUrl = await this.resolveSourceBaseUrl(job);
      const targetPre = await this.fetchPreflight(targetUrl);
      const sourcePre = sourceUrl
        ? await this.fetchPreflight(sourceUrl)
        : null;

      if (!skipHash) {
        const sourceHash = sourcePre?.migrationHash?.trim() || "";
        const targetHash = targetPre.migrationHash?.trim() || "";
        if (!sourceHash || !targetHash) {
          throw new Error(
            `migration hash missing (source=${sourceHash || "?"} target=${targetHash || "?"})`,
          );
        }
        if (sourceHash !== targetHash) {
          throw new Error(
            `migration-hash mismatch source=${sourceHash} target=${targetHash}`,
          );
        }
      }

      if (!skipDisk) {
        const free = targetPre.freeBytes;
        const min = this.minFreeBytes();
        if (free == null || !Number.isFinite(free)) {
          throw new Error("disk free bytes unknown on target preflight");
        }
        if (free < min) {
          throw new Error(`disk free ${free} < min ${min}`);
        }
      }

      await this.appendProcessLog({
        batchId: job.batchId,
        jobId: job.id,
        phase: "PREFLIGHT",
        message: "migration-hash + disk preflight ok",
        detail: {
          sourceHash: sourcePre?.migrationHash ?? null,
          targetHash: targetPre.migrationHash,
          freeBytes: targetPre.freeBytes,
          skipHash,
          skipDisk,
        },
      });
      return job;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await this.appendProcessLog({
        batchId: job.batchId,
        jobId: job.id,
        phase: "PREFLIGHT",
        level: "ERROR",
        message: msg,
      });
      return this.failJob(job, `preflight: ${msg}`);
    }
  }

  private async fetchPreflight(baseUrl: string): Promise<{
    migrationHash?: string;
    freeBytes?: number | null;
    loginPath?: string;
  }> {
    if (process.env.ERA_PLACEMENT_SLICE_LAB === "1") {
      return {
        migrationHash: "lab-hash",
        freeBytes: DEFAULT_PLACEMENT_MIN_FREE_BYTES * 2,
        loginPath: "/login",
      };
    }
    const token = this.placementServiceToken();
    const res = await fetch(
      `${baseUrl.replace(/\/$/, "")}/api/internal/v1/placement/preflight`,
      {
        method: "GET",
        headers: {
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
      },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`preflight HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
    return (await res.json()) as {
      migrationHash?: string;
      freeBytes?: number | null;
      loginPath?: string;
    };
  }

  private async runImportSlice(job: PlacementJobRow): Promise<PlacementJobRow> {
    if (!isSliceSupportedSatelliteKey(job.satelliteKey)) {
      return this.failJob(job, sliceNotImplementedNote(job.satelliteKey));
    }

    if (process.env.ERA_PLACEMENT_SLICE_LAB === "1") {
      await this.appendProcessLog({
        batchId: job.batchId,
        jobId: job.id,
        phase: "IMPORT",
        message: "importSlice lab: artifact accepted without remote POST",
        detail: { artifactRef: job.artifactRef },
      });
      return this.setStatus(job.id, "IMPORT", { errorMessage: null });
    }

    const target = job.targetBaseUrl?.trim();
    if (!target) {
      return this.failJob(job, "importSlice: targetBaseUrl missing");
    }

    const artifact =
      job.artifactJson && typeof job.artifactJson === "object"
        ? (job.artifactJson as Record<string, unknown>)
        : null;
    if (!artifact) {
      return this.failJob(job, "importSlice: artifactJson missing (export first)");
    }

    const modelOrder = Array.isArray(artifact.modelOrder)
      ? (artifact.modelOrder as string[])
      : [];
    if (!modelOrder.length) {
      return this.failJob(
        job,
        "importSlice: artifact modelOrder empty (need OrgFullSliceV2)",
      );
    }
    const checksum =
      typeof artifact.checksum === "string" ? artifact.checksum.trim() : "";
    if (checksum.length < 8) {
      return this.failJob(job, "importSlice: artifact checksum missing");
    }

    const token = this.placementServiceToken();

    try {
      const rows =
        artifact.rows && typeof artifact.rows === "object"
          ? artifact.rows
          : {};
      const res = await fetch(
        `${target.replace(/\/$/, "")}/api/internal/v1/placement/import-slice`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(token ? { authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            organizationId: job.organizationId,
            mode: "upsert",
            slice: {
              organizationId: artifact.organizationId ?? job.organizationId,
              formatVersion:
                artifact.formatVersion ?? ORG_FULL_SLICE_FORMAT_VERSION,
              modelOrder,
              tables: artifact.tables ?? [],
              rows,
              note: artifact.note ?? sliceNoteForKey(job.satelliteKey),
              checksum,
              satelliteKey: artifact.satelliteKey ?? job.satelliteKey,
              objectStorage: artifact.objectStorage ?? {
                prefix: `org/${job.organizationId}/`,
                entries: [],
                stub: true,
              },
            },
          }),
        },
      );
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`import HTTP ${res.status}: ${text.slice(0, 200)}`);
      }
      await this.appendProcessLog({
        batchId: job.batchId,
        jobId: job.id,
        phase: "IMPORT",
        message: "importSlice ok",
        detail: { target },
      });
      return this.setStatus(job.id, "IMPORT", { errorMessage: null });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await this.appendProcessLog({
        batchId: job.batchId,
        jobId: job.id,
        phase: "IMPORT",
        level: "ERROR",
        message: msg,
      });
      return this.failJob(job, `importSlice: ${msg}`);
    }
  }

  private async runSmoke(job: PlacementJobRow): Promise<PlacementJobRow> {
    const base = job.targetBaseUrl?.trim();
    if (!base) {
      return this.failJob(job, "smoke: targetBaseUrl missing");
    }

    if (
      process.env.ERA_PLACEMENT_SMOKE_LAB === "1" ||
      process.env.ERA_PLACEMENT_SLICE_LAB === "1"
    ) {
      await this.appendProcessLog({
        batchId: job.batchId,
        jobId: job.id,
        phase: "SMOKE",
        message: "smoke lab: health + login path assumed ok",
        detail: { targetBaseUrl: base },
      });
      return this.setStatus(job.id, "SMOKE", { errorMessage: null });
    }

    try {
      const root = base.replace(/\/$/, "");
      const healthUrl = `${root}/api/health`;
      const health = await fetch(healthUrl, { method: "GET" });
      if (!health.ok) {
        throw new Error(`health HTTP ${health.status}`);
      }

      let loginPath = "/login";
      try {
        const pre = await this.fetchPreflight(root);
        if (pre.loginPath?.trim()) loginPath = pre.loginPath.trim();
      } catch {
        /* login probe still uses /login */
      }
      const loginUrl = `${root}${loginPath.startsWith("/") ? loginPath : `/${loginPath}`}`;
      const login = await fetch(loginUrl, { method: "GET", redirect: "manual" });
      // 200/302/303/307 acceptable — page must be reachable for staff SSO/local login.
      if (login.status >= 400 && login.status !== 401) {
        throw new Error(`login probe HTTP ${login.status}`);
      }

      await this.appendProcessLog({
        batchId: job.batchId,
        jobId: job.id,
        phase: "SMOKE",
        message: "smoke health + login path ok",
        detail: { healthUrl, loginUrl, loginStatus: login.status },
      });
      return this.setStatus(job.id, "SMOKE", { errorMessage: null });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await this.appendProcessLog({
        batchId: job.batchId,
        jobId: job.id,
        phase: "SMOKE",
        level: "ERROR",
        message: msg,
      });
      return this.failJob(job, `smoke: ${msg}`);
    }
  }

  async advance(
    jobId: string,
    action: PlacementAdvanceAction,
    opts?: { targetBaseUrl?: string; errorMessage?: string },
  ): Promise<PlacementJobRow> {
    const job = (await this.prisma.placementJob.findUnique({
      where: { id: jobId },
    })) as PlacementJobRow | null;
    if (!job) throw new NotFoundException("Placement job not found");
    if (
      job.status === "REJECTED" ||
      job.status === "DONE" ||
      job.status === "FAILED"
    ) {
      throw new BadRequestException(`Job is ${job.status}; cannot advance`);
    }

    switch (action) {
      case PlacementAdvanceAction.markProvisioned:
        await this.appendProcessLog({
          batchId: job.batchId,
          jobId: job.id,
          phase: "PROVISION",
          message: "markProvisioned (service)",
        });
        return this.setStatus(jobId, "PROVISION", {
          applyLog: job.applyLog ?? PLACEMENT_SKELETON_APPLY_LOG,
        });
      case PlacementAdvanceAction.configure:
        return this.runConfigure(job);
      case PlacementAdvanceAction.freeze:
        return this.runFreeze(job);
      case PlacementAdvanceAction.exportSlice: {
        const gated = await this.runPreflightGates(job);
        if (gated.status === "FAILED") return gated;
        await this.appendProcessLog({
          batchId: job.batchId,
          jobId: job.id,
          phase: "EXPORT",
          message: `exportSlice for ${job.satelliteKey}`,
        });
        return this.exportSlice(gated);
      }
      case PlacementAdvanceAction.importSlice:
        return this.runImportSlice(job);
      case PlacementAdvanceAction.bindAndConfig:
        return this.bindAndConfig(job);
      case PlacementAdvanceAction.cutoverEndpoint:
        await this.appendProcessLog({
          batchId: job.batchId,
          jobId: job.id,
          phase: "CUTOVER",
          message: "cutoverEndpoint",
        });
        return this.cutoverEndpoint(job, opts?.targetBaseUrl);
      case PlacementAdvanceAction.smoke:
        return this.runSmoke(job);
      case PlacementAdvanceAction.complete:
        await this.clearOrgPlacementFreeze(job.organizationId).catch(
          () => undefined,
        );
        await this.appendProcessLog({
          batchId: job.batchId,
          jobId: job.id,
          phase: "DONE",
          message: "complete",
        });
        return this.complete(job);
      case PlacementAdvanceAction.rollback:
        await this.clearOrgPlacementFreeze(job.organizationId).catch(
          () => undefined,
        );
        await this.appendProcessLog({
          batchId: job.batchId,
          jobId: job.id,
          phase: "ROLLBACK",
          level: "WARN",
          message: opts?.errorMessage ?? "rollback",
        });
        return this.rollback(job, opts?.errorMessage);
      case PlacementAdvanceAction.fail:
        await this.appendProcessLog({
          batchId: job.batchId,
          jobId: job.id,
          phase: "FAIL",
          level: "ERROR",
          message: opts?.errorMessage ?? "Marked failed",
        });
        return this.failJob(job, opts?.errorMessage ?? "Marked failed");
      default:
        throw new BadRequestException(`Unknown action: ${action}`);
    }
  }

  private async setStatus(
    jobId: string,
    status: string,
    extra?: { applyLog?: string | null; errorMessage?: string | null },
  ): Promise<PlacementJobRow> {
    const updated = (await this.prisma.placementJob.update({
      where: { id: jobId },
      data: {
        status: status as never,
        ...(extra?.applyLog !== undefined ? { applyLog: extra.applyLog } : {}),
        ...(extra?.errorMessage !== undefined
          ? { errorMessage: extra.errorMessage }
          : {}),
      },
    })) as PlacementJobRow;
    await this.syncBatchStatus(updated.batchId);
    return updated;
  }

  private async failJob(
    job: PlacementJobRow,
    errorMessage: string,
  ): Promise<PlacementJobRow> {
    const updated = (await this.prisma.placementJob.update({
      where: { id: job.id },
      data: { status: "FAILED", errorMessage },
    })) as PlacementJobRow;
    await this.syncBatchStatus(updated.batchId);
    return updated;
  }

  private async rollback(
    job: PlacementJobRow,
    errorMessage?: string,
  ): Promise<PlacementJobRow> {
    const updated = (await this.prisma.placementJob.update({
      where: { id: job.id },
      data: {
        status: "ROLLBACK",
        errorMessage: errorMessage ?? "Rolled back; endpoint stays on pool",
      },
    })) as PlacementJobRow;
    await this.syncBatchStatus(updated.batchId);
    return updated;
  }

  private async syncBatchStatus(batchId: string | null | undefined) {
    if (!batchId) return;
    const jobs = await this.prisma.placementJob.findMany({
      where: { batchId },
      select: { status: true },
    });
    if (!jobs.length) return;
    const statuses = jobs.map((j) => j.status);
    let status = "PROVISION";
    if (statuses.every((s) => s === "DONE")) status = "DONE";
    else if (statuses.every((s) => s === "REJECTED")) status = "REJECTED";
    else if (statuses.some((s) => s === "FAILED")) status = "FAILED";
    else if (statuses.some((s) => s === "ROLLBACK")) status = "ROLLBACK";
    else if (statuses.some((s) => s === "SMOKE")) status = "SMOKE";
    else if (statuses.some((s) => s === "CUTOVER")) status = "CUTOVER";
    else if (statuses.some((s) => s === "IMPORT")) status = "IMPORT";
    else if (statuses.some((s) => s === "EXPORT")) status = "EXPORT";
    else if (statuses.some((s) => s === "FREEZE")) status = "FREEZE";
    else if (statuses.every((s) => s === "CONFIGURE")) status = "CONFIGURE";
    else if (statuses.some((s) => s === "CONFIGURE")) status = "CONFIGURE";
    else if (statuses.some((s) => s === "BIND")) status = "BIND";
    else if (statuses.some((s) => s === "PROVISION")) status = "PROVISION";
    else if (statuses.some((s) => s === "PENDING")) status = "PENDING";

    await this.prisma.placementBatch.update({
      where: { id: batchId },
      data: { status: status as never },
    });
  }

  private async exportSlice(job: PlacementJobRow): Promise<PlacementJobRow> {
    if (!isSliceSupportedSatelliteKey(job.satelliteKey)) {
      await this.appendProcessLog({
        batchId: job.batchId,
        jobId: job.id,
        phase: "EXPORT",
        level: "ERROR",
        message: sliceNotImplementedNote(job.satelliteKey),
      });
      return this.failJob(job, sliceNotImplementedNote(job.satelliteKey));
    }

    try {
      const exported = await this.buildSliceExport(job);
      const artifactRef = `placement://${job.id}/org-slice-v2`;
      const updated = (await this.prisma.placementJob.update({
        where: { id: job.id },
        data: {
          status: "EXPORT",
          errorMessage: null,
          sliceMeta: exported.meta as never,
          artifactRef,
          artifactJson: (exported.artifact ?? exported.meta) as never,
        },
      })) as PlacementJobRow;
      await this.syncBatchStatus(updated.batchId);
      await this.appendProcessLog({
        batchId: job.batchId,
        jobId: job.id,
        phase: "EXPORT",
        message: "exportSlice ok",
        detail: { artifactRef },
      });
      return updated;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await this.appendProcessLog({
        batchId: job.batchId,
        jobId: job.id,
        phase: "EXPORT",
        level: "ERROR",
        message: msg,
      });
      return this.failJob(job, `exportSlice: ${msg}`);
    }
  }

  private async buildSliceExport(
    job: PlacementJobRow,
  ): Promise<{
    meta: Record<string, unknown>;
    artifact: Record<string, unknown> | null;
  }> {
    const meta = await this.buildSliceMeta(job, { includeRows: true });
    const artifact =
      meta.rows && typeof meta.rows === "object"
        ? {
            organizationId: meta.organizationId,
            formatVersion: meta.formatVersion ?? ORG_FULL_SLICE_FORMAT_VERSION,
            modelOrder: meta.modelOrder ?? [],
            tables: meta.tables,
            rowCounts: meta.rowCounts,
            note: meta.note,
            checksum: meta.checksum,
            satelliteKey: meta.satelliteKey,
            objectStorage: meta.objectStorage,
            rows: meta.rows,
          }
        : null;
    return { meta, artifact };
  }

  private async buildSliceMeta(
    job: PlacementJobRow,
    opts?: { includeRows?: boolean },
  ): Promise<Record<string, unknown>> {
    const includeRows = opts?.includeRows === true;

    if (process.env.ERA_PLACEMENT_SLICE_LAB === "1") {
      const lab = exportOrgSliceLabSummary(
        job.organizationId,
        job.satelliteKey,
      );
      return {
        organizationId: lab.organizationId,
        formatVersion: lab.formatVersion,
        modelOrder: lab.modelOrder,
        tables: lab.tables,
        rowCounts: lab.rowCounts,
        note: lab.note,
        checksum: lab.checksum,
        satelliteKey: lab.satelliteKey,
        objectStorage: lab.objectStorage,
        ...(includeRows
          ? {
              rows: Object.fromEntries(
                lab.modelOrder.map((name) => [name, [] as unknown[]]),
              ),
            }
          : {}),
      };
    }

    // Export from SOURCE pool (not the empty dedicated clone).
    const baseUrl = await this.resolveSourceBaseUrl(job);
    if (!baseUrl) {
      throw new Error("source endpoint missing for export-slice");
    }

    const token = this.placementServiceToken();
    const res = await fetch(
      `${baseUrl.replace(/\/$/, "")}/api/internal/v1/placement/export-slice`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          organizationId: job.organizationId,
          includeRows,
        }),
      },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`export HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
    const body = (await res.json()) as Record<string, unknown>;
    return {
      organizationId: body.organizationId ?? job.organizationId,
      formatVersion: body.formatVersion ?? ORG_FULL_SLICE_FORMAT_VERSION,
      modelOrder: body.modelOrder ?? [],
      tables: body.tables ?? [],
      rowCounts: body.rowCounts ?? {},
      note: body.note ?? sliceNoteForKey(job.satelliteKey),
      checksum: body.checksum,
      satelliteKey: body.satelliteKey ?? job.satelliteKey,
      objectStorage: body.objectStorage,
      artifactRef: body.artifactRef,
      ...(includeRows && body.rows ? { rows: body.rows } : {}),
    };
  }

  /** Pool/source URL for export + hash compare (not the dedicated target). */
  private async resolveSourceBaseUrl(
    job: PlacementJobRow,
  ): Promise<string | null> {
    const key =
      job.satelliteKey === "industry_hotel"
        ? "industry_hotel_pms"
        : job.satelliteKey;
    const ep = await this.endpoints.resolveEndpoint(job.organizationId, key);
    if (ep?.baseUrl) return ep.baseUrl.replace(/\/$/, "");

    const launch = await this.endpoints.resolveLaunchBaseUrl(
      job.organizationId,
      key,
    );
    return launch?.baseUrl?.replace(/\/$/, "") ?? null;
  }

  /** @deprecated Prefer resolveSourceBaseUrl; kept for cutover target resolution. */
  private async resolveHotelBaseUrl(
    job: PlacementJobRow,
  ): Promise<string | null> {
    const fromJob = job.targetBaseUrl?.trim();
    if (fromJob) return fromJob.replace(/\/$/, "");
    return this.resolveSourceBaseUrl(job);
  }

  private async bindAndConfig(job: PlacementJobRow): Promise<PlacementJobRow> {
    try {
      const result = await this.bindSync.syncForOrg(job.organizationId);
      const failed = result.results.filter((r) => !r.ok);
      if (failed.length) {
        this.logger.warn(
          `PlacementJob ${job.id} Sync partial failures: ${failed.map((f) => f.satelliteKey).join(",")}`,
        );
      }
      const updated = (await this.prisma.placementJob.update({
        where: { id: job.id },
        data: {
          status: "BIND",
          errorMessage: failed.length
            ? `Sync partial: ${failed.map((f) => `${f.satelliteKey}:${f.error ?? f.status}`).join("; ")}`
            : null,
        },
      })) as PlacementJobRow;
      await this.syncBatchStatus(updated.batchId);
      return updated;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return this.failJob(job, `bindAndConfig: ${msg}`);
    }
  }

  private async cutoverEndpoint(
    job: PlacementJobRow,
    overrideUrl?: string,
  ): Promise<PlacementJobRow> {
    const url = (overrideUrl ?? job.targetBaseUrl)?.trim();
    if (!url) {
      throw new BadRequestException(
        "cutoverEndpoint requires targetBaseUrl on the job or in the advance body",
      );
    }
    await this.endpoints.upsertEndpoint({
      organizationId: job.organizationId,
      satelliteKey: job.satelliteKey,
      baseUrl: url,
      enabled: true,
    });
    const updated = (await this.prisma.placementJob.update({
      where: { id: job.id },
      data: {
        status: "CUTOVER",
        targetBaseUrl: url,
      },
    })) as PlacementJobRow;
    await this.syncBatchStatus(updated.batchId);
    return updated;
  }

  private async complete(job: PlacementJobRow): Promise<PlacementJobRow> {
    const updated = (await this.prisma.placementJob.update({
      where: { id: job.id },
      data: { status: "DONE", errorMessage: null },
    })) as PlacementJobRow;
    await this.syncBatchStatus(updated.batchId);

    let mayFlipTopology = !updated.batchId;
    if (updated.batchId) {
      const siblings = await this.prisma.placementJob.findMany({
        where: { batchId: updated.batchId },
        select: { status: true },
      });
      mayFlipTopology =
        siblings.length > 0 && siblings.every((s) => s.status === "DONE");
    }
    if (mayFlipTopology) {
      await this.prisma.organization.update({
        where: { id: job.organizationId },
        data: { deploymentTopology: job.toTopology },
      });
    }
    return updated;
  }
}

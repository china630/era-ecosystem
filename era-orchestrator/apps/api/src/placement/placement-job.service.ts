import {
  BadRequestException,
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

/** Mirrors kit ORG_SLICE_NOTE_HOTEL_V1 — avoid importing kit barrel (jose under Jest). */
const ORG_SLICE_NOTE_HOTEL_V1 = "hotel curated json slice v1";

function exportOrgSliceLabSummary(organizationId: string) {
  const tables = [
    { name: "role", rowCount: 0 },
    { name: "user", rowCount: 0 },
    { name: "guest", rowCount: 0 },
  ];
  return {
    organizationId,
    formatVersion: 1 as const,
    tables,
    rowCounts: Object.fromEntries(tables.map((t) => [t.name, t.rowCount])),
    note: `${ORG_SLICE_NOTE_HOTEL_V1} (lab)`,
  };
}

const HOTEL_SATELLITE_KEYS = new Set([
  "industry_hotel_pms",
  "industry_hotel",
]);

function isHotelSatelliteKey(key: string): boolean {
  return HOTEL_SATELLITE_KEYS.has(key.trim());
}

type PlacementJobRow = {
  id: string;
  organizationId: string;
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

@Injectable()
export class PlacementJobService {
  private readonly logger = new Logger(PlacementJobService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly bindSync: SatelliteOrgBindSyncService,
    private readonly endpoints: SatelliteEndpointRegistryService,
  ) {}

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

  async listForOrg(organizationId: string): Promise<PlacementJobRow[]> {
    return this.prisma.placementJob.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
    }) as Promise<PlacementJobRow[]>;
  }

  /** Host agent poll: EXPORT (artifact ready) + PROVISION (apply in progress). */
  async listForHostAgent(): Promise<PlacementJobRow[]> {
    return this.prisma.placementJob.findMany({
      where: { status: { in: ["EXPORT", "PROVISION"] } },
      orderBy: { createdAt: "asc" },
      take: 50,
    }) as Promise<PlacementJobRow[]>;
  }

  /** Observable host apply log from placement agent. */
  async reportApplyLog(
    jobId: string,
    applyLog: string,
  ): Promise<PlacementJobRow> {
    const job = await this.prisma.placementJob.findUnique({
      where: { id: jobId },
    });
    if (!job) throw new NotFoundException("Placement job not found");
    return this.prisma.placementJob.update({
      where: { id: jobId },
      data: { applyLog: applyLog.slice(0, 20000) },
    }) as Promise<PlacementJobRow>;
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
    if (job.status === "REJECTED" || job.status === "DONE") {
      throw new BadRequestException(`Job is ${job.status}; cannot advance`);
    }

    switch (action) {
      case PlacementAdvanceAction.freeze:
        return this.setStatus(jobId, "FREEZE");
      case PlacementAdvanceAction.exportSlice:
        return this.exportSlice(job);
      case PlacementAdvanceAction.markProvisioned:
        return this.setStatus(jobId, "PROVISION");
      case PlacementAdvanceAction.bindAndConfig:
        return this.bindAndConfig(job);
      case PlacementAdvanceAction.cutoverEndpoint:
        return this.cutoverEndpoint(job, opts?.targetBaseUrl);
      case PlacementAdvanceAction.smoke:
        return this.setStatus(jobId, "SMOKE");
      case PlacementAdvanceAction.complete:
        return this.complete(job);
      case PlacementAdvanceAction.fail:
        return this.prisma.placementJob.update({
          where: { id: jobId },
          data: {
            status: "FAILED",
            errorMessage: opts?.errorMessage ?? "Marked failed",
          },
        }) as Promise<PlacementJobRow>;
      default:
        throw new BadRequestException(`Unknown action: ${action}`);
    }
  }

  private async setStatus(
    jobId: string,
    status: string,
  ): Promise<PlacementJobRow> {
    return this.prisma.placementJob.update({
      where: { id: jobId },
      data: { status: status as never },
    }) as Promise<PlacementJobRow>;
  }

  private async exportSlice(job: PlacementJobRow): Promise<PlacementJobRow> {
    const exported = await this.buildSliceExport(job);
    const artifactRef = `placement://${job.id}/org-slice-v1`;
    return this.prisma.placementJob.update({
      where: { id: job.id },
      data: {
        status: "EXPORT",
        sliceMeta: exported.meta as never,
        artifactRef,
        artifactJson: (exported.artifact ?? exported.meta) as never,
      },
    }) as Promise<PlacementJobRow>;
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
            formatVersion: meta.formatVersion,
            tables: meta.tables,
            rowCounts: meta.rowCounts,
            note: meta.note,
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
    if (!isHotelSatelliteKey(job.satelliteKey)) {
      return {
        organizationId: job.organizationId,
        formatVersion: 1,
        tables: [],
        rowCounts: {},
        note: `slice not implemented for ${job.satelliteKey}`,
      };
    }

    if (process.env.ERA_PLACEMENT_SLICE_LAB === "1") {
      const lab = exportOrgSliceLabSummary(job.organizationId);
      return {
        organizationId: lab.organizationId,
        formatVersion: lab.formatVersion,
        tables: lab.tables,
        rowCounts: lab.rowCounts,
        note: lab.note,
      };
    }

    const baseUrl = await this.resolveHotelBaseUrl(job);
    if (!baseUrl) {
      const lab = exportOrgSliceLabSummary(job.organizationId);
      return {
        organizationId: lab.organizationId,
        formatVersion: lab.formatVersion,
        tables: lab.tables,
        rowCounts: lab.rowCounts,
        note: `${ORG_SLICE_NOTE_HOTEL_V1} (lab; hotel endpoint missing)`,
      };
    }

    try {
      const token =
        process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim() ??
        process.env.PLATFORM_SERVICE_TOKEN?.trim() ??
        "";
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
        this.logger.warn(
          `PlacementJob ${job.id} hotel export-slice HTTP ${res.status}: ${text.slice(0, 200)}`,
        );
        const lab = exportOrgSliceLabSummary(job.organizationId);
        return {
          organizationId: lab.organizationId,
          formatVersion: lab.formatVersion,
          tables: lab.tables,
          rowCounts: lab.rowCounts,
          note: `${ORG_SLICE_NOTE_HOTEL_V1} (lab; hotel export HTTP ${res.status})`,
        };
      }
      const body = (await res.json()) as Record<string, unknown>;
      return {
        organizationId: body.organizationId ?? job.organizationId,
        formatVersion: body.formatVersion ?? 1,
        tables: body.tables ?? [],
        rowCounts: body.rowCounts ?? {},
        note: body.note ?? ORG_SLICE_NOTE_HOTEL_V1,
        artifactRef: body.artifactRef,
        ...(includeRows && body.rows ? { rows: body.rows } : {}),
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `PlacementJob ${job.id} hotel export-slice failed: ${msg}`,
      );
      const lab = exportOrgSliceLabSummary(job.organizationId);
      return {
        organizationId: lab.organizationId,
        formatVersion: lab.formatVersion,
        tables: lab.tables,
        rowCounts: lab.rowCounts,
        note: `${ORG_SLICE_NOTE_HOTEL_V1} (lab; hotel export error)`,
      };
    }
  }

  private async resolveHotelBaseUrl(
    job: PlacementJobRow,
  ): Promise<string | null> {
    const fromJob = job.targetBaseUrl?.trim();
    if (fromJob) return fromJob.replace(/\/$/, "");

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

  private async bindAndConfig(job: PlacementJobRow): Promise<PlacementJobRow> {
    try {
      const result = await this.bindSync.syncForOrg(job.organizationId);
      const failed = result.results.filter((r) => !r.ok);
      if (failed.length) {
        this.logger.warn(
          `PlacementJob ${job.id} Sync partial failures: ${failed.map((f) => f.satelliteKey).join(",")}`,
        );
      }
      return this.prisma.placementJob.update({
        where: { id: job.id },
        data: {
          status: "BIND",
          errorMessage: failed.length
            ? `Sync partial: ${failed.map((f) => `${f.satelliteKey}:${f.error ?? f.status}`).join("; ")}`
            : null,
        },
      }) as Promise<PlacementJobRow>;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return this.prisma.placementJob.update({
        where: { id: job.id },
        data: { status: "FAILED", errorMessage: `bindAndConfig: ${msg}` },
      }) as Promise<PlacementJobRow>;
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
    return this.prisma.placementJob.update({
      where: { id: job.id },
      data: {
        status: "CUTOVER",
        targetBaseUrl: url,
      },
    }) as Promise<PlacementJobRow>;
  }

  private async complete(job: PlacementJobRow): Promise<PlacementJobRow> {
    await this.prisma.organization.update({
      where: { id: job.organizationId },
      data: { deploymentTopology: job.toTopology },
    });
    return this.prisma.placementJob.update({
      where: { id: job.id },
      data: { status: "DONE", errorMessage: null },
    }) as Promise<PlacementJobRow>;
  }
}

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

/** Mirrors kit `exportOrgSlice` — metadata only; no DB dump. */
function exportOrgSliceMeta(organizationId: string) {
  return {
    organizationId,
    tables: [
      "tenant_ops_rows",
      "satellite_audit_log",
      "object_storage_prefix",
    ],
    note: "not implemented full dump",
  };
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

  /** Host agent poll: PENDING (await provision) + PROVISION (apply in progress). */
  async listForHostAgent(): Promise<PlacementJobRow[]> {
    return this.prisma.placementJob.findMany({
      where: { status: { in: ["PENDING", "PROVISION"] } },
      orderBy: { createdAt: "asc" },
      take: 50,
    }) as Promise<PlacementJobRow[]>;
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
    const meta = exportOrgSliceMeta(job.organizationId);
    return this.prisma.placementJob.update({
      where: { id: job.id },
      data: {
        status: "EXPORT",
        sliceMeta: meta as never,
      },
    }) as Promise<PlacementJobRow>;
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

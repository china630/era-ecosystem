import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Job, Queue, Worker } from "bullmq";
import {
  isSatelliteStaffDeactivated,
  isSatelliteStaffProvisioned,
  satelliteStaffDeactivatedSchema,
  satelliteStaffProvisionedSchema,
} from "@era/contracts";
import { attachWorkerFailureAlert } from "../queue/bullmq-worker-alerts";
import { connectionFromRedisUrl } from "../queue/bullmq.config";
import { WorkforceRegistryService } from "../workforce/workforce-registry.service";
import { forwardToClinic } from "./clinic-bridge.client";
import { forwardToSatellite } from "./satellite-bridge.client";
import {
  SATELLITE_KEY_CLINIC,
  SatelliteEndpointRegistryService,
} from "./satellite-endpoint-registry.service";
import {
  ERA_SATELLITE_FANOUT_QUEUE,
  type SatelliteFanoutJobPayload,
} from "./satellite-fanout.queue";

function provisionErrorCode(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("LOGIN_TAKEN")) return "LOGIN_TAKEN";
  if (msg.includes("TARGET_AMBIGUOUS")) return "TARGET_AMBIGUOUS";
  return msg.slice(0, 200) || "FANOUT_FAILED";
}

@Injectable()
export class SatelliteFanoutWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SatelliteFanoutWorker.name);
  private worker?: Worker;
  private queue?: Queue;

  constructor(
    private readonly config: ConfigService,
    private readonly registry: SatelliteEndpointRegistryService,
    private readonly workforce: WorkforceRegistryService,
  ) {}

  private getQueue(): Queue {
    if (!this.queue) {
      const connection = connectionFromRedisUrl(
        this.config.get<string>("SATELLITE_EVENT_REDIS_URL") ??
          this.config.get<string>("REDIS_URL", "redis://127.0.0.1:6379"),
      );
      this.queue = new Queue(ERA_SATELLITE_FANOUT_QUEUE, { connection });
    }
    return this.queue;
  }

  onModuleInit(): void {
    if (process.env.SATELLITE_FANOUT_WORKER_DISABLED === "1") {
      this.logger.warn("SATELLITE_FANOUT_WORKER_DISABLED=1 — worker off");
      return;
    }
    const connection = connectionFromRedisUrl(
      this.config.get<string>("SATELLITE_EVENT_REDIS_URL") ??
        this.config.get<string>("REDIS_URL", "redis://127.0.0.1:6379"),
    );
    this.worker = new Worker<SatelliteFanoutJobPayload>(
      ERA_SATELLITE_FANOUT_QUEUE,
      async (job) => this.handle(job),
      { connection },
    );
    attachWorkerFailureAlert(
      this.worker,
      ERA_SATELLITE_FANOUT_QUEUE,
      this.logger,
      this.config.get<string>("ERAFINANCE_BULLMQ_ALERT_WEBHOOK_URL") ??
        undefined,
    );
    this.logger.log(`Listening on queue ${ERA_SATELLITE_FANOUT_QUEUE}`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
  }

  async enqueueSatelliteFanout(
    organizationId: string,
    satelliteKey: string,
    event: Record<string, unknown>,
    path: string,
  ): Promise<void> {
    const correlationId =
      typeof event.correlationId === "string" ? event.correlationId : undefined;
    const jobId = correlationId
      ? `staff-${satelliteKey}-${correlationId}`
      : `staff-${satelliteKey}-${Date.now()}`;

    await this.getQueue().add(
      "forward_satellite",
      {
        organizationId,
        satelliteKey,
        event,
        path,
      },
      {
        jobId,
        attempts: 5,
        backoff: { type: "exponential", delay: 3000 },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    );
  }

  async enqueueClinicFanout(
    organizationId: string,
    event: Record<string, unknown>,
  ): Promise<void> {
    const correlationId =
      typeof event.correlationId === "string" ? event.correlationId : undefined;
    const jobId = correlationId
      ? `clinic-${correlationId}`
      : `clinic-${Date.now()}`;

    await this.getQueue().add(
      "forward_clinic",
      {
        organizationId,
        satelliteKey: SATELLITE_KEY_CLINIC,
        event,
      },
      {
        jobId,
        attempts: 5,
        backoff: { type: "exponential", delay: 3000 },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    );
  }

  private async markFailedFromEvent(
    event: Record<string, unknown>,
    err: unknown,
  ): Promise<void> {
    try {
      if (isSatelliteStaffProvisioned(event)) {
        const parsed = satelliteStaffProvisionedSchema.parse(event);
        await this.workforce.markProvisionFailed(
          parsed.payload.cpEmploymentId,
          parsed.payload.satelliteKey,
          provisionErrorCode(err),
          parsed.payload.roleBindingId,
        );
        return;
      }
      if (isSatelliteStaffDeactivated(event)) {
        const parsed = satelliteStaffDeactivatedSchema.parse(event);
        await this.workforce.markProvisionFailed(
          parsed.payload.cpEmploymentId,
          parsed.payload.satelliteKey,
          provisionErrorCode(err),
          parsed.payload.roleBindingId,
        );
      }
    } catch (markErr) {
      this.logger.warn(
        `Could not mark provision FAILED: ${markErr instanceof Error ? markErr.message : markErr}`,
      );
    }
  }

  private async handle(job: Job<SatelliteFanoutJobPayload>): Promise<void> {
    const { organizationId, satelliteKey, event, path } = job.data;
    const endpoint = await this.registry.resolveEndpoint(
      organizationId,
      satelliteKey,
    );
    if (!endpoint) {
      this.logger.warn(
        `Fan-out job ${job.id}: no endpoint for org=${organizationId} satellite=${satelliteKey}`,
      );
      await this.markFailedFromEvent(event, new Error("NO_ENDPOINT"));
      return;
    }

    if (satelliteKey === SATELLITE_KEY_CLINIC && !path) {
      await forwardToClinic(endpoint, event);
      this.logger.log(
        `Forwarded ${String(event.type)} to clinic org=${organizationId}`,
      );
      return;
    }

    if (path) {
      try {
        const result = await forwardToSatellite(endpoint, path, event);
        if (
          isSatelliteStaffProvisioned(event) &&
          result.satelliteUserId?.trim()
        ) {
          const parsed = satelliteStaffProvisionedSchema.parse(event);
          await this.workforce.patchSatelliteUserId(
            parsed.organizationId,
            parsed.payload.satelliteKey,
            parsed.payload.cpEmploymentId,
            result.satelliteUserId.trim(),
          );
        } else if (isSatelliteStaffProvisioned(event)) {
          const parsed = satelliteStaffProvisionedSchema.parse(event);
          await this.workforce.markProvisionFailed(
            parsed.payload.cpEmploymentId,
            parsed.payload.satelliteKey,
            "NO_SATELLITE_USER_ID_IN_RESPONSE",
            parsed.payload.roleBindingId,
          );
        }
        this.logger.log(
          `Forwarded ${String(event.type)} to ${satelliteKey} org=${organizationId}`,
        );
        return;
      } catch (err) {
        await this.markFailedFromEvent(event, err);
        throw err;
      }
    }

    this.logger.warn(
      `Fan-out job ${job.id}: unsupported satelliteKey=${satelliteKey}`,
    );
  }
}

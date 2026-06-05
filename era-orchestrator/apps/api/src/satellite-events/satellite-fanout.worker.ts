import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Job, Queue, Worker } from "bullmq";
import { attachWorkerFailureAlert } from "../queue/bullmq-worker-alerts";
import { connectionFromRedisUrl } from "../queue/bullmq.config";
import { forwardToClinic } from "./clinic-bridge.client";
import {
  SATELLITE_KEY_CLINIC,
  SatelliteEndpointRegistryService,
} from "./satellite-endpoint-registry.service";
import {
  ERA_SATELLITE_FANOUT_QUEUE,
  type SatelliteFanoutJobPayload,
} from "./satellite-fanout.queue";

@Injectable()
export class SatelliteFanoutWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SatelliteFanoutWorker.name);
  private worker?: Worker;
  private queue?: Queue;

  constructor(
    private readonly config: ConfigService,
    private readonly registry: SatelliteEndpointRegistryService,
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

  private async handle(job: Job<SatelliteFanoutJobPayload>): Promise<void> {
    const { organizationId, satelliteKey, event } = job.data;
    const endpoint = await this.registry.resolveEndpoint(
      organizationId,
      satelliteKey,
    );
    if (!endpoint) {
      this.logger.warn(
        `Fan-out job ${job.id}: no endpoint for org=${organizationId} satellite=${satelliteKey}`,
      );
      return;
    }

    if (satelliteKey === SATELLITE_KEY_CLINIC) {
      await forwardToClinic(endpoint, event);
      this.logger.log(
        `Forwarded ${String(event.type)} to clinic org=${organizationId}`,
      );
      return;
    }

    this.logger.warn(
      `Fan-out job ${job.id}: unsupported satelliteKey=${satelliteKey}`,
    );
  }
}

import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { getSatelliteEventType, isSatelliteEvent } from "@era/contracts";
import { Job, Worker } from "bullmq";
import { attachWorkerFailureAlert } from "../queue/bullmq-worker-alerts";
import { connectionFromRedisUrl } from "../queue/bullmq.config";
import { PrismaService } from "../prisma/prisma.service";
import { runWithTenantContextAsync } from "../prisma/tenant-context";
import { SatelliteEventDispatchService } from "./satellite-event-dispatch.service";
import { SatelliteEventIdempotencyService } from "./satellite-event-idempotency.service";
import {
  ERA_SATELLITE_EVENTS_QUEUE,
  type SatelliteEventJobPayload,
} from "./satellite-event.queue";

@Injectable()
export class SatelliteEventWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SatelliteEventWorker.name);
  private worker?: Worker;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly idempotency: SatelliteEventIdempotencyService,
    private readonly dispatch: SatelliteEventDispatchService,
  ) {}

  onModuleInit(): void {
    if (process.env.SATELLITE_EVENT_WORKER_DISABLED === "1") {
      this.logger.warn("SATELLITE_EVENT_WORKER_DISABLED=1 — worker off");
      return;
    }
    const connection = connectionFromRedisUrl(
      this.config.get<string>("SATELLITE_EVENT_REDIS_URL") ??
        this.config.get<string>("REDIS_URL", "redis://127.0.0.1:6379"),
    );
    this.worker = new Worker<SatelliteEventJobPayload>(
      ERA_SATELLITE_EVENTS_QUEUE,
      async (job: Job<SatelliteEventJobPayload>) => this.handle(job),
      { connection },
    );
    attachWorkerFailureAlert(
      this.worker,
      ERA_SATELLITE_EVENTS_QUEUE,
      this.logger,
      this.config.get<string>("ERAFINANCE_BULLMQ_ALERT_WEBHOOK_URL") ??
        undefined,
    );
    this.logger.log(`Listening on queue ${ERA_SATELLITE_EVENTS_QUEUE}`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }

  private async handle(job: Job<SatelliteEventJobPayload>): Promise<void> {
    const data = job.data;
    const eventType = getSatelliteEventType(data);
    if (!eventType) {
      this.logger.warn(`Job ${job.id}: missing event type, skipping`);
      return;
    }

    if (!isSatelliteEvent(data)) {
      this.logger.warn(`Job ${job.id}: unrecognized event ${eventType}`);
      return;
    }

    const organizationId =
      typeof data === "object" &&
      data !== null &&
      "organizationId" in data &&
      typeof (data as { organizationId: unknown }).organizationId === "string"
        ? (data as { organizationId: string }).organizationId
        : null;

    if (!organizationId) {
      this.logger.warn(`Job ${job.id}: missing organizationId, skipping`);
      return;
    }

    const correlationId =
      typeof data === "object" &&
      data !== null &&
      "correlationId" in data &&
      typeof (data as { correlationId: unknown }).correlationId === "string"
        ? (data as { correlationId: string }).correlationId
        : String(job.id);

    await runWithTenantContextAsync(
      { organizationId, skipTenantFilter: false },
      async () => {
        const existing = await this.idempotency.findExisting(
          organizationId,
          correlationId,
        );
        if (existing) {
          this.logger.log(
            `Satellite event ${eventType} correlation=${correlationId} already processed transaction=${existing.transactionId ?? "—"}`,
          );
          return;
        }

        const result = await this.dispatch.dispatch(organizationId, data);
        await this.idempotency.record(
          organizationId,
          correlationId,
          eventType,
          result,
        );
        this.logger.log(
          `Satellite event ${eventType} correlation=${correlationId} transaction=${result.transactionId ?? "—"} invoice=${result.invoiceId ?? "—"}`,
        );
      },
    );
  }
}

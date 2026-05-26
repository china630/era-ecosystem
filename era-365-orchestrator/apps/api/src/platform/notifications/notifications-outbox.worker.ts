import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Job, Queue, Worker } from "bullmq";
import { attachWorkerFailureAlert } from "../../queue/bullmq-worker-alerts";
import { connectionFromRedisUrl } from "../../queue/bullmq.config";
import {
  NOTIFICATIONS_OUTBOX_QUEUE,
  type NotificationsOutboxJobPayload,
} from "./notifications-outbox.queue";
import { NotificationsDispatchService } from "./notifications-dispatch.service";

@Injectable()
export class NotificationsOutboxWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationsOutboxWorker.name);
  private worker?: Worker;
  private queue?: Queue;

  constructor(
    private readonly config: ConfigService,
    private readonly dispatch: NotificationsDispatchService,
  ) {}

  onModuleInit(): void {
    if (process.env.NOTIFICATIONS_OUTBOX_WORKER_DISABLED === "1") {
      this.logger.warn("NOTIFICATIONS_OUTBOX_WORKER_DISABLED=1 — worker off");
      return;
    }
    const connection = connectionFromRedisUrl(
      this.config.get<string>("REDIS_URL", "redis://127.0.0.1:6379"),
    );
    this.queue = new Queue(NOTIFICATIONS_OUTBOX_QUEUE, { connection });
    this.worker = new Worker(
      NOTIFICATIONS_OUTBOX_QUEUE,
      async (job: Job<NotificationsOutboxJobPayload>) => this.handle(job),
      { connection },
    );
    attachWorkerFailureAlert(
      this.worker,
      NOTIFICATIONS_OUTBOX_QUEUE,
      this.logger,
      this.config.get<string>("ERAFINANCE_BULLMQ_ALERT_WEBHOOK_URL") ??
        undefined,
    );
    void this.queue.add(
      "poll_pending",
      { outboxId: "", organizationId: "" },
      {
        repeat: { every: 30_000 },
        jobId: "notifications-outbox-poll",
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
  }

  async enqueueOutbox(outboxId: string, organizationId: string): Promise<void> {
    if (!this.queue) return;
    await this.queue.add(
      "dispatch",
      { outboxId, organizationId },
      {
        jobId: `notify-${outboxId}`,
        removeOnComplete: 1000,
        removeOnFail: 5000,
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
      },
    );
  }

  private async handle(job: Job<NotificationsOutboxJobPayload>): Promise<void> {
    if (job.name === "poll_pending") {
      await this.dispatch.processPendingBatch();
      return;
    }
    if (job.name === "dispatch" && job.data.outboxId) {
      await this.dispatch.dispatchOutboxEntry(
        job.data.organizationId,
        job.data.outboxId,
      );
    }
  }
}

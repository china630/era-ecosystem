import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  isSatelliteHotelReservationCompleted,
  type SatelliteHotelReservationCompletedEvent,
} from "@era/contracts";
import { Queue } from "bullmq";
import { connectionFromRedisUrl } from "../queue/bullmq.config";

export const ERA_SATELLITE_EVENTS_QUEUE = "era-satellite-events";

@Injectable()
export class SatelliteEventsService {
  private readonly logger = new Logger(SatelliteEventsService.name);
  private queue?: Queue;

  constructor(private readonly config: ConfigService) {}

  private getQueue(): Queue {
    if (!this.queue) {
      const connection = connectionFromRedisUrl(
        this.config.get<string>("SATELLITE_EVENT_REDIS_URL") ??
          this.config.get<string>("REDIS_URL", "redis://127.0.0.1:6379"),
      );
      this.queue = new Queue(ERA_SATELLITE_EVENTS_QUEUE, { connection });
    }
    return this.queue;
  }

  assertServiceToken(authorization: string | undefined): void {
    const expected = this.config.get<string>("SATELLITE_EVENT_SERVICE_TOKEN");
    if (!expected) return;
    const token = authorization?.startsWith("Bearer ")
      ? authorization.slice(7).trim()
      : authorization?.trim();
    if (!token || token !== expected) {
      throw new UnauthorizedException("Invalid satellite event token");
    }
  }

  async enqueue(
    body: unknown,
  ): Promise<{ jobId: string; queue: string }> {
    if (!isSatelliteHotelReservationCompleted(body)) {
      throw new BadRequestException(
        "Unsupported or invalid satellite event payload",
      );
    }
    const event = body as SatelliteHotelReservationCompletedEvent;
    const job = await this.getQueue().add(event.type, event, {
      jobId: event.correlationId,
      removeOnComplete: 1000,
      removeOnFail: 5000,
    });
    this.logger.log(
      `Enqueued ${event.type} correlation=${event.correlationId} job=${job.id}`,
    );
    return { jobId: String(job.id), queue: ERA_SATELLITE_EVENTS_QUEUE };
  }
}

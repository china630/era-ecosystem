import {
  isSatelliteEvent,
  getSatelliteEventType,
  isSatelliteHotelGuestCheckedIn,
  isSatelliteHotelGuestCheckedOut,
  isSatelliteHotelRoomChanged,
  isSatelliteHotelSanatoriumBookingCreated,
} from "@era/contracts";
import { Queue } from "bullmq";
import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { connectionFromRedisUrl } from "../queue/bullmq.config";
import { SubscriptionAccessService } from "../subscription/subscription-access.service";
import {
  SATELLITE_KEY_CLINIC,
  SatelliteEndpointRegistryService,
} from "./satellite-endpoint-registry.service";
import { SatelliteFanoutWorker } from "./satellite-fanout.worker";

export const ERA_SATELLITE_EVENTS_QUEUE = "era-satellite-events";

function isClinicLifecycleEvent(data: unknown): boolean {
  return (
    isSatelliteHotelGuestCheckedIn(data) ||
    isSatelliteHotelGuestCheckedOut(data) ||
    isSatelliteHotelRoomChanged(data) ||
    isSatelliteHotelSanatoriumBookingCreated(data)
  );
}

@Injectable()
export class SatelliteEventsService {
  private readonly logger = new Logger(SatelliteEventsService.name);
  private queue?: Queue;

  constructor(
    private readonly config: ConfigService,
    private readonly subscriptionAccess: SubscriptionAccessService,
    private readonly registry: SatelliteEndpointRegistryService,
    private readonly fanoutWorker: SatelliteFanoutWorker,
  ) {}

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

  async enqueue(body: unknown): Promise<{ jobId: string; queue: string; type: string }> {
    if (!isSatelliteEvent(body)) {
      throw new BadRequestException(
        "Unsupported or invalid satellite event payload",
      );
    }
    const eventType = getSatelliteEventType(body) ?? "unknown";
    const correlationId = (body as { correlationId: string }).correlationId;
    const organizationId = (body as { organizationId: string }).organizationId;

    const job = await this.getQueue().add(eventType, body, {
      jobId: correlationId,
      removeOnComplete: 1000,
      removeOnFail: 5000,
    });
    this.logger.log(
      `Enqueued ${eventType} correlation=${correlationId} job=${job.id}`,
    );

    await this.maybeEnqueueClinicFanout(organizationId, body);

    return {
      jobId: String(job.id),
      queue: ERA_SATELLITE_EVENTS_QUEUE,
      type: eventType,
    };
  }

  private async maybeEnqueueClinicFanout(
    organizationId: string,
    body: unknown,
  ): Promise<void> {
    if (!isClinicLifecycleEvent(body)) return;

    const entitled = await this.subscriptionAccess.hasModule(
      organizationId,
      SATELLITE_KEY_CLINIC,
    );
    if (!entitled) {
      this.logger.debug(
        `Skip clinic fan-out: org=${organizationId} has no industry_clinic`,
      );
      return;
    }

    const endpoint = await this.registry.resolveEndpoint(
      organizationId,
      SATELLITE_KEY_CLINIC,
    );
    if (!endpoint) {
      this.logger.debug(
        `Skip clinic fan-out: no endpoint for org=${organizationId}`,
      );
      return;
    }

    await this.fanoutWorker.enqueueClinicFanout(
      organizationId,
      body as Record<string, unknown>,
    );
    this.logger.log(
      `Enqueued clinic fan-out for ${getSatelliteEventType(body)} org=${organizationId}`,
    );
  }
}

import {
  isSatelliteEvent,
  getSatelliteEventType,
  isFinanceOutboundStaffEvent,
  isSatelliteHotelGuestCheckedIn,
  isSatelliteHotelGuestCheckedOut,
  isSatelliteHotelRoomChanged,
  isSatelliteHotelSanatoriumBookingCreated,
  isSatelliteStaffDeactivated,
  isSatelliteStaffProvisioned,
  satelliteStaffDeactivatedSchema,
  satelliteStaffProvisionedSchema,
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
import { WorkforceRegistryService } from "../workforce/workforce-registry.service";
import {
  SATELLITE_KEY_CLINIC,
  SatelliteEndpointRegistryService,
} from "./satellite-endpoint-registry.service";
import { SatelliteEventSubscriberRegistry } from "./satellite-event-subscriber.registry";
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
    private readonly subscriberRegistry: SatelliteEventSubscriberRegistry,
    private readonly workforce: WorkforceRegistryService,
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

    if (isFinanceOutboundStaffEvent(body)) {
      await this.workforce.upsertFromEvent(body);
      await this.maybeEnqueueStaffFanout(organizationId, body);
      return {
        jobId: correlationId,
        queue: "staff-fanout",
        type: eventType,
      };
    }

    const job = await this.getQueue().add(eventType, body, {
      jobId: correlationId,
      removeOnComplete: 1000,
      removeOnFail: 5000,
    });
    this.logger.log(
      `Enqueued ${eventType} correlation=${correlationId} job=${job.id}`,
    );

    if (isSatelliteStaffProvisioned(body)) {
      await this.workforce.upsertFromEvent(body);
    }

    await this.maybeEnqueueClinicFanout(organizationId, body);

    void this.subscriberRegistry
      .dispatch(body as Record<string, unknown>)
      .catch((e) =>
        this.logger.warn(`In-process subscriber dispatch failed: ${e}`),
      );

    return {
      jobId: String(job.id),
      queue: ERA_SATELLITE_EVENTS_QUEUE,
      type: eventType,
    };
  }

  private async maybeEnqueueStaffFanout(
    organizationId: string,
    body: unknown,
  ): Promise<void> {
    if (!isFinanceOutboundStaffEvent(body)) return;
    const satelliteKey = isSatelliteStaffProvisioned(body)
      ? satelliteStaffProvisionedSchema.parse(body).payload.satelliteKey
      : isSatelliteStaffDeactivated(body)
        ? satelliteStaffDeactivatedSchema.parse(body).payload.satelliteKey
        : undefined;
    if (!satelliteKey) return;

    const entitled = await this.subscriptionAccess.hasModule(
      organizationId,
      satelliteKey,
    );
    if (!entitled) {
      this.logger.debug(
        `Skip staff fan-out: org=${organizationId} has no ${satelliteKey}`,
      );
      return;
    }

    const endpoint = await this.registry.resolveEndpoint(
      organizationId,
      satelliteKey,
    );
    if (!endpoint) {
      this.logger.debug(
        `Skip staff fan-out: no endpoint for org=${organizationId} satellite=${satelliteKey}`,
      );
      return;
    }

    await this.fanoutWorker.enqueueSatelliteFanout(
      organizationId,
      satelliteKey,
      body as Record<string, unknown>,
      "/api/integration/staff-provision",
    );
    this.logger.log(
      `Enqueued staff fan-out for ${getSatelliteEventType(body)} org=${organizationId}`,
    );
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

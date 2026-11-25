import { Body, Controller, HttpException, Post, Req } from "@nestjs/common";
import { randomUUID } from "crypto";
import { isSatelliteEvent } from "@era/contracts";
import {
  assertEnvServiceToken,
  expressKitHeaders,
  organizationIdOnIncomingRequest,
  publishToOrchestratorGateway,
} from "@era/satellite-kit";
import type { ConstructionRequest } from "../session";

@Controller("api/events")
export class EventsController {
  @Post("dispatch")
  async dispatch(@Req() req: ConstructionRequest, @Body() body: unknown) {
    const headers = expressKitHeaders(req);
    const authz = assertEnvServiceToken({
      expectedEnvKeys: ["SATELLITE_EVENT_SERVICE_TOKEN"],
      authorization: headers.get("authorization"),
      xServiceToken: headers.get("x-service-token"),
      allowOpenInNonProduction: false,
    });
    if (!authz.ok) {
      throw new HttpException({ ok: false, error: authz.error }, authz.status);
    }
    const organizationId = organizationIdOnIncomingRequest({ headers });
      if (!organizationId) {
        throw new HttpException(
          { ok: false, error: "organizationId is not bound on this request" },
          400,
        );
      }
      const raw = (body ?? {}) as Record<string, unknown>;
      const event = {
        ...raw,
        organizationId,
        correlationId:
          typeof raw.correlationId === "string" ? raw.correlationId : randomUUID(),
        occurredAt:
          typeof raw.occurredAt === "string" ? raw.occurredAt : new Date().toISOString(),
      };
      if (!isSatelliteEvent(event)) {
        throw new HttpException(
          { ok: false, error: "Unknown or invalid satellite event type" },
          400,
        );
      }
      const result = await publishToOrchestratorGateway(event as Record<string, unknown>);
      if (!result.ok) {
        throw new HttpException({ ok: false, error: result.error }, 502);
      }
      return { ok: true, event };
  }
}

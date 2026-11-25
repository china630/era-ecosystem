/** Lifted from era-hotel-pms/nest/generated/integrations_elektraweb-bridge_health.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { isFolkloreS2sToken, resolveSatelliteEventServiceToken, resolveSatelliteOrganizationId } from "@era/satellite-kit";
import { authenticateBridgeRequest } from "@/lib/integration/elektraweb-bridge/auth";
import { getElektrawebBridgePolicy, isElektrawebBridgeEnabled, isPolicyWriteEnabled } from "@/lib/integration/elektraweb-bridge/config";
import { getBridgeHealth } from "@/lib/integration/elektraweb-bridge/ingest";
import { countOutboxByStatus } from "@/lib/integration/elektraweb-bridge/outbox.service";
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class IntegrationsElektrawebBridgeHealthController {
  @Get("api/integrations/elektraweb-bridge/health")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const web = await (async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {

  
    const authHeader = nestHeader(httpReq, "authorization");
    if (!authHeader) {
      return sendJson(httpRes, {
        enabled: isElektrawebBridgeEnabled(),
        organizationIdConfigured:
          resolveSatelliteOrganizationId({ allowFallback: true }).source !== "fallback",
        policyStore: "ElektrawebBridgePolicy",
        satelliteEventTokenFolklore: isFolkloreS2sToken(
          resolveSatelliteEventServiceToken(),
        ),
      });
    }

    const auth = await authenticateBridgeRequest({ headers: { get: (name: string) => nestHeader(httpReq, name) }, url: new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1").toString() });
    const health = getBridgeHealth();
    const policy = await getElektrawebBridgePolicy(auth.organizationId);
    const outbox = await countOutboxByStatus(auth.organizationId);
    return sendJson(httpRes, {
      ...health,
      writeEnabled: isPolicyWriteEnabled(policy),
      inboundEnabled: !!policy?.inboundEnabled,
      outbox,
      organizationId: auth.organizationId,
      elektrawebHotelId: auth.elektrawebHotelId,
      policyHotelId: policy?.elektrawebHotelId ?? null,
      authVia: auth.via,
      login: auth.login,
    });
  
        });
      })();
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}

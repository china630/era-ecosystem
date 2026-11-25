/** Lifted from era-hotel-pms/nest/generated/hotel_integration-settings.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { requestOrganizationId } from '@/lib/request-organization';
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { getOutboundSettings, saveIntegrationSettings, DEFAULT_OUTBOUND_SETTINGS, type OutboundSettings } from '@/lib/integration/integration-settings';
import { getSubscriptionMe, createCustomDomain } from '@/integration/control-plane-platform.client';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const patchSchema = z.object({
  enabled: z.boolean().optional(),
  realtime: z
    .object({
      chargePosted: z.boolean().optional(),
      paymentReceived: z.boolean().optional(),
      chargeVoided: z.boolean().optional(),
      reservationCompleted: z.boolean().optional(),
      invoiceIssued: z.boolean().optional(),
      paymentFiscalized: z.boolean().optional(),
    })
    .optional(),
  cityLedgerSnapshot: z.boolean().optional(),
  masterDataSync: z.boolean().optional(),
  nightAuditClosed: z.boolean().optional(),
  urls: z
    .object({
      default: z.string().optional(),
      nightAudit: z.string().optional(),
    })
    .optional(),
  requireZeroBalanceOnCheckout: z.boolean().optional(),
  customHostname: z.string().max(253).optional(),
});


@Controller()
export class HotelIntegrationSettingsController {
  @Get("api/hotel/integration-settings")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.INTEGRATION_ADMIN);
    const settings = await getOutboundSettings();
    const organizationId = requestOrganizationId();
    let platformSubscription: unknown = null;
    if (organizationId) {
      try {
        platformSubscription = await getSubscriptionMe({ organizationId });
      } catch {
        platformSubscription = null;
      }
    }
    return sendJson(httpRes, serialize({ ...settings, platformSubscription }));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Patch("api/hotel/integration-settings")
  @HttpCode(200)
  async patch_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.INTEGRATION_ADMIN);
    const partial = patchSchema.parse(httpReq.body);
    const current = await getOutboundSettings();
    const merged: OutboundSettings = {
      ...current,
      ...partial,
      realtime: { ...current.realtime, ...partial.realtime },
      urls: { ...current.urls, ...partial.urls },
    };
    await saveIntegrationSettings(merged);
    const organizationId = requestOrganizationId();
    if (organizationId && partial.customHostname?.trim()) {
      try {
        await createCustomDomain(
          {
            hostname: partial.customHostname.trim(),
            metadata: { source: 'hotel_integration_settings' },
          },
          { organizationId },
        );
      } catch {
        // optional custom domain
      }
    }
    return sendJson(httpRes, serialize(merged));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Put("api/hotel/integration-settings")
  @HttpCode(200)
  async put_2(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.INTEGRATION_ADMIN);
    const body = patchSchema.parse(httpReq.body) as Partial<OutboundSettings>;
    const merged: OutboundSettings = {
      ...DEFAULT_OUTBOUND_SETTINGS,
      ...(await getOutboundSettings()),
      ...body,
      realtime: {
        ...DEFAULT_OUTBOUND_SETTINGS.realtime,
        ...(await getOutboundSettings()).realtime,
        ...body.realtime,
      },
      urls: {
        ...DEFAULT_OUTBOUND_SETTINGS.urls,
        ...(await getOutboundSettings()).urls,
        ...body.urls,
      },
    };
    await saveIntegrationSettings(merged);
    return sendJson(httpRes, serialize(merged));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}

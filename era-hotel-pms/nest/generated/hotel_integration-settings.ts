import { z } from 'zod';
import { requestOrganizationId } from '@/lib/request-organization';
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { getOutboundSettings, saveIntegrationSettings, DEFAULT_OUTBOUND_SETTINGS, type OutboundSettings } from '@/lib/integration/integration-settings';
import { getSubscriptionMe, createCustomDomain } from '@/integration/control-plane-platform.client';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

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

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/hotel/integration-settings", async (httpReq, httpRes) => {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {
        return runWithNestHttp(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const request = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
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
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.patch("/api/hotel/integration-settings", async (httpReq, httpRes) => {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {
        return runWithNestHttp(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const request = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
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
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.put("/api/hotel/integration-settings", async (httpReq, httpRes) => {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {
        return runWithNestHttp(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const request = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
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
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}

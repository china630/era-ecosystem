import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import {
  getOutboundSettings,
  saveIntegrationSettings,
  DEFAULT_OUTBOUND_SETTINGS,
  type OutboundSettings,
} from '@/lib/integration/integration-settings';
import {
  getSubscriptionMe,
  createCustomDomain,
} from '@/integration/control-plane-platform.client';

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

export async function GET() {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.MASTER_DATA_MANAGE);
    const settings = await getOutboundSettings();
    const organizationId = process.env.ERA_SATELLITE_ORGANIZATION_ID?.trim() ?? '';
    let platformSubscription: unknown = null;
    if (organizationId) {
      try {
        platformSubscription = await getSubscriptionMe({ organizationId });
      } catch {
        platformSubscription = null;
      }
    }
    return jsonOk(serialize({ ...settings, platformSubscription }));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.MASTER_DATA_MANAGE);
    const partial = patchSchema.parse(await request.json());
    const current = await getOutboundSettings();
    const merged: OutboundSettings = {
      ...current,
      ...partial,
      realtime: { ...current.realtime, ...partial.realtime },
      urls: { ...current.urls, ...partial.urls },
    };
    await saveIntegrationSettings(merged);
    const organizationId = process.env.ERA_SATELLITE_ORGANIZATION_ID?.trim() ?? '';
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
    return jsonOk(serialize(merged));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.MASTER_DATA_MANAGE);
    const body = patchSchema.parse(await request.json()) as Partial<OutboundSettings>;
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
    return jsonOk(serialize(merged));
  } catch (err) {
    return handleRouteError(err);
  }
}

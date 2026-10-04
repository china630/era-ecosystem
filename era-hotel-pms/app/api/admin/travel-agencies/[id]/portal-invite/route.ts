import { z } from 'zod';
import { jsonOk, handleRouteError, jsonError } from '@/lib/api-utils';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { requireHotelModule } from '@/lib/hotel-module-gate';
import { prisma } from '@/lib/prisma';

const inviteSchema = z.object({
  email: z.string().email(),
  fullName: z.string().optional(),
  password: z.string().min(8).optional(),
});

/**
 * SatAdmin invites agency portal user — requires VÖEN on agency + hotel_agency_portal module.
 */
export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.MASTER_DATA_MANAGE);
    await requireHotelModule('hotel_agency_portal', session.organizationId);
    await requireHotelModule('hotel_distribution', session.organizationId);

    const { id } = await ctx.params;
    const agency = await prisma.agency.findUnique({ where: { id } });
    if (!agency) return jsonError('Agency not found', 404);
    const voen = (agency.voen ?? '').replace(/\D/g, '');
    if (voen.length !== 10) {
      return jsonError('Agency VÖEN (10 digits) is required for portal invite', 400);
    }

    const body = inviteSchema.parse(await request.json());
    const orch =
      process.env.CONTROL_PLANE_URL?.replace(/\/$/, '') ||
      process.env.ORCHESTRATOR_URL?.replace(/\/$/, '');
    const token = process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim();
    if (!orch || !token) {
      return jsonError('Orchestrator URL / service token not configured', 503);
    }

    const res = await fetch(`${orch}/agency-portal/invite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        organizationId: session.organizationId,
        email: body.email,
        fullName: body.fullName,
        password: body.password,
        agencyVoen: voen,
        localAgencyId: agency.id,
        localAgencyCode: agency.code,
      }),
    });
    const text = await res.text();
    if (!res.ok) {
      return jsonError(text || 'Invite failed', res.status);
    }
    return jsonOk(JSON.parse(text));
  } catch (err) {
    return handleRouteError(err);
  }
}

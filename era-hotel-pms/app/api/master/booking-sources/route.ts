import { prisma } from '@/lib/prisma';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { requestOrganizationId } from '@/lib/request-organization';

async function ensureCorporateSource() {
  try {
    const organizationId = requestOrganizationId();
    await prisma.bookingSource.upsert({
      where: { organizationId_code: { organizationId, code: 'CORPORATE' } },
      create: { organizationId, code: 'CORPORATE', name: 'Corporate' },
      update: {},
    });
  } catch {
    /* list still returns existing rows */
  }
}

export async function GET() {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_READ);
    await ensureCorporateSource();
    const rows = await prisma.bookingSource.findMany({
      orderBy: { code: 'asc' },
      select: { id: true, code: true, name: true },
    });
    return jsonOk(rows);
  } catch (err) {
    return handleRouteError(err);
  }
}

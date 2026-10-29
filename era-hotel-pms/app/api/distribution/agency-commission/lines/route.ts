import { todayBakuYmd } from '@era/satellite-kit/time';
import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertAnyPermission, assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import {
  listCommissionLines,
  markLinesReady,
} from '@/lib/services/agency-commission.service';
import type { AgencyCommissionLineStatus } from '@prisma/client';

export async function GET(request: Request) {
  try {
    assertAnyPermission(await getSatelliteSession(), [
      PERMISSIONS.REPORTS_READ,
      PERMISSIONS.SCREEN_DISTRIBUTION,
    ]);
    const url = new URL(request.url);
    const from = url.searchParams.get('from') ?? todayBakuYmd();
    const to = url.searchParams.get('to') ?? from;
    const agencyId = url.searchParams.get('agencyId') ?? undefined;
    const status = (url.searchParams.get('status') ?? undefined) as
      | AgencyCommissionLineStatus
      | undefined;
    return jsonOk(await listCommissionLines({ agencyId, fromYmd: from, toYmd: to, status }));
  } catch (err) {
    return handleRouteError(err);
  }
}

const readySchema = z.object({
  lineIds: z.array(z.string().min(1)).min(1),
});

export async function POST(request: Request) {
  try {
    assertPermission(await getSatelliteSession(), PERMISSIONS.MASTER_DATA_MANAGE);
    const body = readySchema.parse(await request.json());
    return jsonOk(await markLinesReady(body.lineIds));
  } catch (err) {
    return handleRouteError(err);
  }
}

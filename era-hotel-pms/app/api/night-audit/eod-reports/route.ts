import { z } from 'zod';
import { jsonOk, handleRouteError, jsonError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import {
  getEodReport,
  type EodReportType,
} from '@/lib/services/night-audit-eod-reports.service';

const typeSchema = z.enum([
  'cancelled',
  'created',
  'folio-transactions',
  'room-price-control',
  'no-shows',
  'room-moves',
  'vip-in-house',
]);

export async function GET(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.REPORTS_READ);
    const url = new URL(request.url);
    const parsed = typeSchema.safeParse(url.searchParams.get('type'));
    if (!parsed.success) {
      return jsonError(
        'type must be cancelled|created|folio-transactions|room-price-control|no-shows|room-moves|vip-in-house',
        400,
      );
    }
    const today = new Date().toISOString().slice(0, 10);
    const date = url.searchParams.get('date') ?? today;
    return jsonOk(serialize(await getEodReport(parsed.data as EodReportType, date)));
  } catch (err) {
    return handleRouteError(err);
  }
}

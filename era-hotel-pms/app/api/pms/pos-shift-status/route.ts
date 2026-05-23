import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import {
  getPosShiftStatus,
  reportPosShiftStatus,
} from '@/lib/services/pms-bridge.service';
import { assertPosBridgeOrPermission } from '@/lib/pos-bridge-auth';
import { PERMISSIONS } from '@/lib/auth/permissions';

const putSchema = z.object({
  outletCode: z.string().min(1),
  shiftId: z.string().min(1),
  status: z.enum(['OPEN', 'CLOSED']),
  propertyCode: z.string().optional(),
  openedAt: z.string().optional(),
  closedAt: z.string().optional(),
});

export async function GET(request: Request) {
  try {
    await assertPosBridgeOrPermission(request, PERMISSIONS.NIGHT_AUDIT_RUN);
    return jsonOk(serialize(await getPosShiftStatus()));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PUT(request: Request) {
  try {
    await assertPosBridgeOrPermission(request, PERMISSIONS.NIGHT_AUDIT_RUN);
    const body = putSchema.parse(await request.json());
    await reportPosShiftStatus({
      outletCode: body.outletCode,
      shiftId: body.shiftId,
      status: body.status,
      propertyCode: body.propertyCode,
      openedAt: body.openedAt,
      closedAt: body.closedAt,
    });
    return new Response(null, { status: 204 });
  } catch (err) {
    return handleRouteError(err);
  }
}

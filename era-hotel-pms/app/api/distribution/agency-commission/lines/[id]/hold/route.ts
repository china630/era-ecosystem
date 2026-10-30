import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import {
  holdCommissionLine,
  releaseCommissionHold,
} from '@/lib/services/agency-commission.service';

const schema = z
  .object({
    reason: z.string().optional(),
    release: z.boolean().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.release) return;
    if (!val.reason?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Hold reason required',
        path: ['reason'],
      });
    }
  });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertPermission(await getSatelliteSession(), PERMISSIONS.MASTER_DATA_MANAGE);
    const { id } = await params;
    const body = schema.parse(await request.json());
    if (body.release) {
      return jsonOk(serialize(await releaseCommissionHold(id)));
    }
    return jsonOk(serialize(await holdCommissionLine(id, body.reason!.trim())));
  } catch (err) {
    return handleRouteError(err);
  }
}

import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import {
  deleteChildPricingRow,
  updateChildPricingRow,
} from '@/lib/services/wave-b-master.service';

const schema = z.object({
  ageFrom: z.number().int().min(0).optional(),
  ageTo: z.number().int().min(0).optional(),
  discountPercent: z.number().min(0).max(100).optional(),
  amountOverride: z.number().min(0).nullable().optional(),
  freeCount: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertPermission(await getSessionFromHeaders(), PERMISSIONS.MASTER_DATA_MANAGE);
    const { id } = await params;
    const body = schema.parse(await request.json());
    return jsonOk(serialize(await updateChildPricingRow(id, body)));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertPermission(await getSessionFromHeaders(), PERMISSIONS.MASTER_DATA_MANAGE);
    const { id } = await params;
    await deleteChildPricingRow(id);
    return jsonOk({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}

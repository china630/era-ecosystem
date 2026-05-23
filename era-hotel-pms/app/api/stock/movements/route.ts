import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { postStockMovement } from '@/lib/services/stock.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

const schema = z.object({
  productId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  type: z.enum(['RECEIPT', 'ISSUE', 'TRANSFER']),
  qty: z.number().positive(),
  reference: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.MASTER_DATA_MANAGE);
    const body = schema.parse(await request.json());
    return jsonOk(serialize(await postStockMovement(body)), 201);
  } catch (err) {
    return handleRouteError(err);
  }
}

import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { updateProduct } from '@/lib/services/stock.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

const schema = z.object({
  name: z.string().min(1).optional(),
  productType: z.enum(['SELLABLE', 'STOCK']).optional(),
  unit: z.string().optional(),
  price: z.number().nullable().optional(),
  currency: z.string().nullable().optional(),
  vatRate: z.number().nullable().optional(),
  active: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.MASTER_DATA_MANAGE);
    const { id } = await params;
    const body = schema.parse(await request.json());
    return jsonOk(serialize(await updateProduct(id, body)));
  } catch (err) {
    return handleRouteError(err);
  }
}

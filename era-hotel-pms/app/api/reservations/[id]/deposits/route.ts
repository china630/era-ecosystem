import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { listDeposits, recordDeposit } from '@/lib/services/folio-deposit.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

const createSchema = z.object({
  amount: z.number().positive(),
  paymentMethod: z.enum(['CASH', 'CARD', 'COMPANY_ACCOUNT']),
  registerRef: z.string().optional(),
  externalRef: z.string().optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.FOLIO_READ);
    const { id } = await params;
    return jsonOk(serialize(await listDeposits(id)));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.FOLIO_PAYMENT);
    const { id } = await params;
    const body = createSchema.parse(await request.json());
    return jsonOk(serialize(await recordDeposit({ reservationId: id, ...body })), 201);
  } catch (err) {
    return handleRouteError(err);
  }
}

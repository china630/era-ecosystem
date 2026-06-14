import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import {
  createCheckInHold,
  listAuthorizations,
  captureAuthorization,
  releaseAuthorization,
} from '@/lib/services/card-auth.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

const holdSchema = z.object({ amount: z.number().positive() });

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.FOLIO_READ);
    const { id } = await params;
    return jsonOk(serialize(await listAuthorizations(id)));
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
    const body = holdSchema.parse(await request.json());
    return jsonOk(serialize(await createCheckInHold(id, body.amount)), 201);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.FOLIO_PAYMENT);
    const { id } = await params;
    const body = z
      .object({
        authorizationId: z.string().uuid(),
        action: z.enum(['capture', 'release']),
        amount: z.number().positive().optional(),
      })
      .parse(await request.json());

    if (body.action === 'capture') {
      return jsonOk(serialize(await captureAuthorization(body.authorizationId, body.amount)));
    }
    return jsonOk(serialize(await releaseAuthorization(body.authorizationId)));
  } catch (err) {
    return handleRouteError(err);
  }
}

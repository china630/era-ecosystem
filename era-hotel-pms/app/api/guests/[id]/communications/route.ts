import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { createGuestCommunication, listGuestCommunications } from '@/lib/services/guest-crm.service';

const schema = z.object({
  channel: z.enum(['WHATSAPP', 'EMAIL', 'SMS']),
  subject: z.string().optional(),
  body: z.string().min(1),
  recipient: z.string().optional(),
});

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_READ);
    const { id } = await params;
    const channel = new URL(req.url).searchParams.get('channel') ?? undefined;
    return jsonOk(serialize(await listGuestCommunications(id, channel ?? undefined)));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);
    const { id } = await params;
    const body = schema.parse(await request.json());
    return jsonOk(serialize(await createGuestCommunication(id, body)));
  } catch (err) {
    return handleRouteError(err);
  }
}

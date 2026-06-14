import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import {
  getGuestCrmExtension,
  upsertGuestCrmExtension,
} from '@/lib/services/guest-crm-extension.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

const patchSchema = z.object({
  interests: z.array(z.string()).optional(),
  socialMedia: z.record(z.string()).optional(),
  generalCrmNotes: z.string().optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_READ);
    const { id } = await params;
    return jsonOk(serialize(await getGuestCrmExtension(id)));
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
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);
    const { id } = await params;
    const body = patchSchema.parse(await request.json());
    await upsertGuestCrmExtension(id, body);
    return jsonOk(serialize(await getGuestCrmExtension(id)));
  } catch (err) {
    return handleRouteError(err);
  }
}

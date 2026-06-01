import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getGuestFull, patchGuestFull } from '@/lib/services/guest-full.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

const patchSchema = z.object({
  fullName: z.string().optional(),
  firstName: z.string().nullable().optional(),
  lastName: z.string().nullable().optional(),
  middleName: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  gender: z.string().nullable().optional(),
  nationality: z.string().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  vipType: z.string().nullable().optional(),
  birthDate: z.string().nullable().optional(),
  birthPlace: z.string().nullable().optional(),
  greyList: z.boolean().optional(),
  problematic: z.boolean().optional(),
  gdprConfirmed: z.boolean().optional(),
  smsConsent: z.boolean().optional(),
  whatsappConsent: z.boolean().optional(),
  phoneConsent: z.boolean().optional(),
  emailConsent: z.boolean().optional(),
  callBack: z.boolean().optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_READ);
    const { id } = await params;
    return jsonOk(serialize(await getGuestFull(id)));
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
    return jsonOk(serialize(await patchGuestFull(id, body)));
  } catch (err) {
    return handleRouteError(err);
  }
}

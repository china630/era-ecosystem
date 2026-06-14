import { z } from 'zod';
import { lookupGlobalPersonByFin, resolvePersonIdentity } from '@era/satellite-kit';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

const schema = z.object({
  fin: z.string().trim().optional(),
  passport: z.string().trim().optional(),
  issuingCountry: z.string().trim().optional(),
  fullName: z.string().trim().min(1),
  phone: z.string().trim().optional(),
  nationality: z.string().trim().optional(),
});

/** Resolve MDM global person id from FIN / passport (SP7 guest linkage). */
export async function POST(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);
    const body = schema.parse(await request.json());
    if (body.fin) {
      const result = await lookupGlobalPersonByFin(body.fin);
      if (result.globalPersonId) return jsonOk(result);
    }
    const resolved = await resolvePersonIdentity({
      fin: body.fin,
      passport: body.passport,
      issuingCountry: body.issuingCountry ?? body.nationality,
      fullName: body.fullName,
      phone: body.phone,
      nationality: body.nationality,
    });
    return jsonOk({
      globalPersonId: resolved.globalPersonId,
      masked: false,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

import { z } from 'zod';
import { lookupGlobalPersonByFin, resolvePersonIdentity } from '@era/satellite-kit';
import { jsonOk, handleRouteError, jsonError } from '@/lib/api-utils';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { buildMdmPersonLookupBody } from '@/lib/mdm-person-lookup-body';

const schema = z
  .object({
    fin: z.string().trim().optional(),
    passport: z.string().trim().optional(),
    issuingCountry: z.string().trim().optional(),
    firstName: z.string().trim().optional(),
    middleName: z.string().trim().optional(),
    lastName: z.string().trim().optional(),
    fullName: z.string().trim().optional(),
    phone: z.string().trim().optional(),
    nationality: z.string().trim().optional(),
  })
  .refine(
    (d) =>
      Boolean(d.fullName?.trim()) ||
      Boolean(d.firstName?.trim() && d.lastName?.trim()),
    { message: 'fullName or firstName+lastName required' },
  );

/** Resolve MDM global person id from FIN / passport (SP7 guest linkage). */
export async function POST(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? 'Invalid body', 400);
    }
    const body = parsed.data;
    if (body.fin) {
      const result = await lookupGlobalPersonByFin(body.fin);
      if (result.globalPersonId) return jsonOk(result);
    }
    const resolveBody = buildMdmPersonLookupBody(body);
    const resolved = await resolvePersonIdentity(resolveBody);
    return jsonOk({
      globalPersonId: resolved.globalPersonId,
      masked: false,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { createQuickAgency, createQuickCompany } from '@/lib/services/quick-profile.service';

const schema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('AGENCY'),
    name: z.string().trim().min(1).max(120),
    phone: z.string().trim().min(5).max(32),
  }),
  z.object({
    kind: z.literal('COMPANY'),
    name: z.string().trim().min(1).max(120),
    voen: z.string().trim().regex(/^\d{10}$/),
  }),
]);

export async function POST(request: Request) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);
    const body = schema.parse(await request.json());
    const row =
      body.kind === 'AGENCY'
        ? await createQuickAgency({ name: body.name, phone: body.phone })
        : await createQuickCompany({ name: body.name, voen: body.voen });
    return jsonOk(serialize(row));
  } catch (err) {
    return handleRouteError(err);
  }
}

import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { getSatelliteSession } from '@/lib/auth/session';
import { isPlatformSuperAdminUser } from '@/lib/auth/platform-super-admin';
import { parseMrz } from '@/lib/mrz/parse';
import { matchMrzGuest } from '@/lib/mrz/match-guest';

const schema = z.object({
  text: z.string().min(20),
  currentGuestId: z.string().nullable().optional(),
});

export async function POST(request: Request) {
  try {
    const session = await getSatelliteSession();
    if (!session) throw new Error('Unauthorized');
    if (!isPlatformSuperAdminUser({ login: session.login, email: session.email })) {
      throw new Error('Forbidden: insufficient permissions');
    }
    const body = schema.parse(await request.json());
    const parsed = parseMrz(body.text);
    if (!parsed) return jsonOk({ parsed: null, match: { kind: 'none' } });
    const match = parsed.checksOk
      ? await matchMrzGuest(parsed, body.currentGuestId)
      : { kind: 'none' as const };
    return jsonOk({ parsed, match });
  } catch (err) {
    return handleRouteError(err);
  }
}

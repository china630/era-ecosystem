import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { getSatelliteSession } from '@/lib/auth/session';
import { isPlatformSuperAdminUser } from '@/lib/auth/platform-super-admin';
import { recordHotelAudit } from '@/lib/satellite-audit';
import { countOpsWipe, runOpsWipe } from '@/lib/services/ops-wipe.service';

const confirmSchema = z.object({
  organizationId: z.string().uuid(),
  confirmPhrase: z.literal('WIPE'),
  ops: z.array(z.string()).optional(),
});

async function superAdminSession() {
  const session = await getSatelliteSession();
  if (!session) throw Object.assign(new Error('Unauthorized'), { status: 401 });
  if (!isPlatformSuperAdminUser({ email: session.email ?? null, login: session.login })) {
    throw Object.assign(new Error('Forbidden: platform super admin only'), { status: 403 });
  }
  return session;
}

export async function GET() {
  try {
    const session = await superAdminSession();
    return jsonOk({
      organizationId: session.organizationId,
      counts: await countOpsWipe(session.organizationId),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(request: Request) {
  try {
    const session = await superAdminSession();
    const body = confirmSchema.parse(await request.json());
    if (body.organizationId !== session.organizationId) {
      throw Object.assign(new Error('Organization changed since counts were loaded — reload the page'), {
        status: 409,
      });
    }
    const deleted = await runOpsWipe(
      session.organizationId,
      body.ops ? { ops: body.ops } : undefined,
    );
    await recordHotelAudit({ userId: session.sub, request }, 'OpsWipe', session.organizationId, 'WIPE', {
      deleted,
    });
    return jsonOk({
      organizationId: session.organizationId,
      deleted,
      counts: await countOpsWipe(session.organizationId),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

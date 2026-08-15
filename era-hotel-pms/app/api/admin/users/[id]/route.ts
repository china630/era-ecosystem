import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { updateUser } from '@/lib/services/user.service';

const patchSchema = z.object({
  fullName: z.string().min(1).optional(),
  password: z.string().min(6).optional(),
  roleId: z.string().uuid().optional(),
  email: z.string().email().nullable().optional(),
  department: z.string().nullable().optional(),
  status: z.enum(['ACTIVE', 'DISABLED']).optional(),
});

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.USERS_MANAGE);
    const { id } = await ctx.params;
    const body = patchSchema.parse(await request.json());
    const user = await updateUser(id, body);
    return jsonOk(
      serialize({
        id: user.id,
        login: user.login,
        fullName: user.fullName,
        email: user.email,
        department: user.department,
        status: user.status,
        role: user.role.code,
      }),
    );
  } catch (err) {
    return handleRouteError(err);
  }
}

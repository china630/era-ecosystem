import { z } from 'zod';
import { jsonOk, handleRouteError, jsonError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { createUser, listUsers } from '@/lib/services/user.service';

const createSchema = z.object({
  login: z.string().min(2),
  fullName: z.string().min(1),
  password: z.string().min(6),
  roleId: z.string().uuid(),
  email: z.string().email().optional(),
  department: z.string().optional(),
});

export async function GET() {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.USERS_MANAGE);
    const users = await listUsers();
    return jsonOk(
      serialize(
        users.map((u) => ({
          id: u.id,
          login: u.login,
          fullName: u.fullName,
          email: u.email,
          department: u.department,
          status: u.status,
          isCrossSystem: u.isCrossSystem,
          role: u.role.code,
          roleName: u.role.name,
          lastLoginAt: u.lastLoginAt,
        })),
      ),
    );
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.USERS_MANAGE);
    const body = createSchema.parse(await request.json());
    const user = await createUser(body);
    return jsonOk(serialize(user), 201);
  } catch (err) {
    if (err instanceof Error && (err as Error & { code?: string }).code === 'QUOTA_EXCEEDED') {
      return jsonError(err.message, 403);
    }
    if (err instanceof Error && err.message.includes('Forbidden')) {
      return jsonError(err.message, 403);
    }
    return handleRouteError(err);
  }
}

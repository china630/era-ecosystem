import { z } from 'zod';
import { jsonOk, handleRouteError, jsonError } from '@/lib/api-utils';
import { verifyPassword } from '@/lib/auth/password';
import { getUserByLogin } from '@/lib/services/user.service';
import { signBridgeToken } from '@/lib/integration/elektraweb-bridge/auth';
import {
  getBridgeOrganizationId,
  getExpectedElektrawebHotelId,
  isElektrawebBridgeEnabled,
  roleMayUseBridge,
} from '@/lib/integration/elektraweb-bridge/config';

const schema = z.object({
  login: z.string().min(1),
  password: z.string().min(1),
});

/**
 * Extension login form → bridge JWT bound to this deployment's
 * ERA_SATELLITE_ORGANIZATION_ID + ELEKTRAWEB_HOTEL_ID.
 */
export async function POST(request: Request) {
  try {
    if (!isElektrawebBridgeEnabled()) {
      return jsonError('Elektraweb bridge is disabled', 503);
    }

    const body = schema.parse(await request.json());
    const user = await getUserByLogin(body.login);
    if (!user || user.status !== 'ACTIVE') {
      return jsonError('Invalid credentials', 401);
    }
    const valid = await verifyPassword(body.password, user.passwordHash);
    if (!valid) return jsonError('Invalid credentials', 401);

    const role = user.role.code;
    if (!roleMayUseBridge(role)) {
      return jsonError('Forbidden: role cannot use Elektraweb bridge', 403);
    }

    const organizationId = getBridgeOrganizationId();
    const elektrawebHotelId = getExpectedElektrawebHotelId();
    const token = await signBridgeToken({
      userId: user.id,
      login: user.login,
      role,
      fullName: user.fullName,
    });

    return jsonOk({
      token,
      organizationId,
      elektrawebHotelId,
      user: {
        login: user.login,
        fullName: user.fullName,
        role,
      },
      expiresInHours: 12,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

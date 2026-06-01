import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import type { Permission } from '@/lib/auth/permissions';
import {
  isPosBridgeApiPath,
  verifyPosBridgeFromHeaders,
} from './pos-bridge-auth-edge';

export { isPosBridgeApiPath, verifyPosBridgeFromHeaders, POS_BRIDGE_API_PREFIXES } from './pos-bridge-auth-edge';

export function verifyPosBridge(request: Request): boolean {
  const secret = process.env.POS_BRIDGE_SECRET;
  if (!secret) return false;
  const header = request.headers.get('x-pos-bridge-secret');
  const auth = request.headers.get('authorization');
  if (header === secret) return true;
  if (auth?.startsWith('Bearer ') && auth.slice(7) === secret) return true;
  return false;
}

export async function assertPosBridgeOrPermission(
  request: Request,
  permission: Permission,
): Promise<void> {
  if (verifyPosBridge(request)) return;
  const session = await getSessionFromHeaders();
  assertPermission(session, permission);
}

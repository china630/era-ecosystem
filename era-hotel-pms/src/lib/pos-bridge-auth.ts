import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import type { Permission } from '@/lib/auth/permissions';

export const POS_BRIDGE_API_PREFIXES = [
  '/api/pos/room-charge',
  '/api/pms/',
] as const;

export function isPosBridgeApiPath(pathname: string): boolean {
  return POS_BRIDGE_API_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p),
  );
}

export function verifyPosBridge(request: Request): boolean {
  const secret = process.env.POS_BRIDGE_SECRET;
  if (!secret) return false;
  const header = request.headers.get('x-pos-bridge-secret');
  const auth = request.headers.get('authorization');
  if (header === secret) return true;
  if (auth?.startsWith('Bearer ') && auth.slice(7) === secret) return true;
  return false;
}

export function verifyPosBridgeFromHeaders(
  bridgeSecret: string | null,
  authorization: string | null,
): boolean {
  const secret = process.env.POS_BRIDGE_SECRET;
  if (!secret) return false;
  if (bridgeSecret === secret) return true;
  if (authorization?.startsWith('Bearer ') && authorization.slice(7) === secret) {
    return true;
  }
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

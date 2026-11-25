import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import type { Permission } from '@/lib/auth/permissions';
import {
  isPosBridgeApiPath,
  verifyPosBridgeFromHeaders,
} from './pos-bridge-auth-edge';

export { isPosBridgeApiPath, verifyPosBridgeFromHeaders, POS_BRIDGE_API_PREFIXES } from './pos-bridge-auth-edge';

export function verifyPosBridge(request: { headers: { get(name: string): string | null } }): boolean {
  const secret = process.env.POS_BRIDGE_SECRET;
  if (!secret) return false;
  const header = request.headers.get('x-pos-bridge-secret');
  const auth = request.headers.get('authorization');
  if (header === secret) return true;
  if (auth?.startsWith('Bearer ') && auth.slice(7) === secret) return true;
  return false;
}

export async function assertPosBridgeOrPermission(
  request: { headers: { get(name: string): string | null } },
  permission: Permission,
): Promise<void> {
  if (verifyPosBridge(request)) return;
  const cookieHeader = request.headers.get("cookie") ?? "";
  const session = await getSatelliteSession({
    headers: request.headers,
    cookies: {
      get(name: string) {
        for (const part of cookieHeader.split(";")) {
          const eq = part.indexOf("=");
          if (eq <= 0) continue;
          if (part.slice(0, eq).trim() === name) {
            return { value: decodeURIComponent(part.slice(eq + 1).trim()) };
          }
        }
        return undefined;
      },
    },
  });
  assertPermission(session, permission);
}

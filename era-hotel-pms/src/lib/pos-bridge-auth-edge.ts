/** POS bridge helpers safe for Next.js Edge middleware (no server session imports). */

export const POS_BRIDGE_API_PREFIXES = [
  "/api/pos/room-charge",
  "/api/settlement/pending",
  "/api/pms/",
  "/api/integrations/elektraweb-bridge/outbox",
] as const;

export function isPosBridgeApiPath(pathname: string): boolean {
  return POS_BRIDGE_API_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p),
  );
}

export function verifyPosBridgeFromHeaders(
  bridgeSecret: string | null,
  authorization: string | null,
): boolean {
  const secret = process.env.POS_BRIDGE_SECRET;
  if (!secret) return false;
  if (bridgeSecret === secret) return true;
  if (authorization?.startsWith("Bearer ") && authorization.slice(7) === secret) {
    return true;
  }
  return false;
}

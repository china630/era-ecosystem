/** Pure cron auth gate (AC-AUTO-PLAT negative paths). */

export function cronUnauthorized(
  authorization: string | null | undefined,
  secret: string,
): boolean {
  if (!secret) return false;
  return authorization !== `Bearer ${secret}`;
}

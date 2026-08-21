/** Pure cron auth gate (AC-CON-PLAT negative paths). */

export function cronUnauthorized(
  authorization: string | null | undefined,
  secret: string,
): boolean {
  if (!secret) return false;
  return authorization !== `Bearer ${secret}`;
}

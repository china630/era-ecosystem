"use client";

import { useOpsNavProfile } from "./use-ops-nav-profile";

function grantsReady(permissions: readonly string[] | undefined, status: string): string[] | null {
  if (status !== "ready" || !permissions) return null;
  return [...permissions];
}

/** True only after the ops profile has loaded and includes this permission. */
export function useCan(permission: string): boolean {
  const { profile, status } = useOpsNavProfile();
  const permissions = grantsReady(profile?.permissions, status);
  if (!permissions) return false;
  return permissions.includes(permission);
}

/** True only after the ops profile has loaded and includes one of these permissions. */
export function useCanAny(permissions: readonly string[]): boolean {
  const { profile, status } = useOpsNavProfile();
  const held = grantsReady(profile?.permissions, status);
  if (!held) return false;
  return permissions.some((permission) => held.includes(permission));
}

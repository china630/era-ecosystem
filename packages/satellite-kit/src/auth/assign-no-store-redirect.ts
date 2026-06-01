"use client";

/** Full navigation after auth — avoids stale RSC shell from router.push + refresh. */
export function assignNoStoreRedirect(url: string): void {
  if (typeof window === "undefined") return;
  window.location.assign(url);
}

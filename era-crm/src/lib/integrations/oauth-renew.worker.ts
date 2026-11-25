/**
 * Periodic OAuth token renew + calendar task sync (T-I24 / T-I28).
 */
import { renewExpiringOAuthTokens } from "@/lib/integrations/oauth-google-ms.service";
import { syncOpenTasksToCalendars } from "@/lib/integrations/calendar-sync.service";

let started = false;

export function startOauthRenewLoop(intervalMs = 15 * 60_000): void {
  if (started) return;
  started = true;
  const tick = async () => {
    try {
      const n = await renewExpiringOAuthTokens();
      if (n) console.log("[oauth-renew] refreshed", n);
      const c = await syncOpenTasksToCalendars();
      if (c) console.log("[calendar-sync] upserted", c);
    } catch (err) {
      console.error("[oauth-renew]", err);
    }
  };
  void tick();
  setInterval(() => void tick(), intervalMs);
}

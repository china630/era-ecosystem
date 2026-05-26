import { financeWebUrl } from "@era/satellite-kit";
import { orchFetch, ORCH_TOKEN_KEY } from "./orch-api";

/** One-time ticket handoff (preferred). Falls back to legacy JWT-in-query. */
export async function buildFinanceHandoffUrl(
  accessToken: string,
): Promise<string | null> {
  const base = financeWebUrl();
  if (!base || !accessToken) return null;
  const url = new URL("/auth/cp-handoff", base.replace(/\/$/, ""));
  try {
    const res = await orchFetch("/auth/finance-handoff", {
      method: "POST",
      token: accessToken,
    });
    if (res.ok) {
      const data = (await res.json()) as { ticket?: string };
      if (data.ticket) {
        url.searchParams.set("ticket", data.ticket);
        return url.toString();
      }
    }
  } catch {
    /* legacy fallback */
  }
  url.searchParams.set("token", accessToken);
  return url.toString();
}

export function getOrchAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ORCH_TOKEN_KEY);
}

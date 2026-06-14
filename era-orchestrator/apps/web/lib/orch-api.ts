export const ORCH_API_URL =
  process.env.NEXT_PUBLIC_ORCH_API_URL ?? "http://127.0.0.1:4000";

export const ORCH_TOKEN_KEY = "era_orch_access_token";

export function getOrchAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ORCH_TOKEN_KEY);
}

export async function orchFetch(
  path: string,
  init: RequestInit & { token?: string | null } = {},
): Promise<Response> {
  const { token, ...rest } = init;
  const headers = new Headers(rest.headers);
  if (!headers.has("Content-Type") && rest.body) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const url = `${ORCH_API_URL.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
  return fetch(url, { ...rest, headers });
}

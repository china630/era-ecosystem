"use client";

import { ORCH_TOKEN_KEY } from "./orch-api";

export async function cpAdminFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem(ORCH_TOKEN_KEY)
      : null;
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  const p = path.startsWith("/") ? path.slice(1) : path;
  return fetch(`/api/cp-admin/${p}`, { ...init, headers });
}

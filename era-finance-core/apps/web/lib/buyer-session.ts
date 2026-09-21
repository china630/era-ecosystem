import {
  buyerAuthCookieName,
  verifyBuyerSession,
  type BuyerSessionPayload,
} from "@era/satellite-kit";
import { cookies, headers } from "next/headers";

export async function getBuyerSession(): Promise<BuyerSessionPayload> {
  const jar = await cookies();
  const hdrs = await headers();
  const cookieToken = jar.get(buyerAuthCookieName())?.value;
  const auth = hdrs.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : undefined;
  const token = bearer || cookieToken;
  if (!token) {
    throw Object.assign(new Error("Buyer session required"), { status: 401 });
  }
  try {
    return await verifyBuyerSession(token);
  } catch {
    throw Object.assign(new Error("Invalid buyer session"), { status: 401 });
  }
}

function nestApiBase(): string {
  return (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4100").replace(
    /\/$/,
    "",
  );
}

/** Proxy to Nest buyer APIs with the buyer session cookie forwarded. */
export async function nestBuyerFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const jar = await cookies();
  const cookieName = buyerAuthCookieName();
  const token = jar.get(cookieName)?.value;
  if (!token) {
    throw Object.assign(new Error("Buyer session required"), { status: 401 });
  }
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type") && init?.body) {
    headers.set("Content-Type", "application/json");
  }
  headers.set("Cookie", `${cookieName}=${token}`);
  return fetch(`${nestApiBase()}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
}

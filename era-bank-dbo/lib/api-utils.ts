import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import type { CustomerSession } from "@prisma/client";
import { resolveCustomerSession } from "@/lib/customer-session";
import { DBO_SESSION_COOKIE } from "@/lib/dbo-session-cookie";
import type { EngineDboError } from "@/lib/engine-dbo-client";

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export function handleRouteError(err: unknown) {
  if (err && typeof err === "object" && "issues" in err) {
    return jsonError("Validation failed", 400);
  }
  if (err && typeof err === "object" && "status" in err && "message" in err) {
    const engineErr = err as EngineDboError;
    return jsonError(engineErr.message, engineErr.status);
  }
  const msg = err instanceof Error ? err.message : "Internal error";
  return jsonError(msg, 500);
}

export async function getSessionTokenFromRequest(): Promise<string | null> {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const cookieToken = cookieStore.get(DBO_SESSION_COOKIE)?.value;
  if (cookieToken) return cookieToken;
  const auth = headerStore.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  return null;
}

export async function requireCustomerSession(): Promise<
  { session: CustomerSession } | NextResponse
> {
  const token = await getSessionTokenFromRequest();
  const session = await resolveCustomerSession(token);
  if (!session) return jsonError("Unauthorized", 401);
  return { session };
}

export function setSessionCookie(res: NextResponse, token: string, maxAge: number) {
  res.cookies.set(DBO_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge,
    secure: process.env.NODE_ENV === "production",
  });
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(DBO_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

#!/usr/bin/env node
/**
 * Applies SSO auth + middleware + login to all W1–W7 industry satellites.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apps = [
  "era-retail-pos",
  "era-logistics",
  "era-construction",
  "era-crm-field",
  "era-auto-sto",
  "era-clinic",
  "era-wholesale",
];

const authModels = `
model Role {
  id              String   @id @default(cuid())
  code            String   @unique
  name            String
  permissionsJson String   @default("[]")
  users           User[]
}

model User {
  id              String    @id @default(cuid())
  login           String    @unique
  email           String?
  fullName        String
  passwordHash    String
  roleId          String
  role            Role      @relation(fields: [roleId], references: [id])
  status          String    @default("ACTIVE")
  isCrossSystem   Boolean   @default(false) @map("is_cross_system")
  lastLoginAt     DateTime? @map("last_login_at")
  createdAt       DateTime  @default(now()) @map("created_at")
}
`;

const apiUtils = `import { NextResponse } from "next/server";

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
  const msg = err instanceof Error ? err.message : "Internal error";
  return jsonError(msg, 500);
}
`;

const ssoRoute = `import {
  authCookieName,
  buildSsoPayload,
  executeSatelliteSsoExchange,
  ssoExchangeBodySchema,
  verifySsoSignature,
} from "@era/satellite-kit";
import { jsonError, jsonOk, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = ssoExchangeBodySchema.parse(await request.json());
    if (body.expiresAt < Math.floor(Date.now() / 1000)) {
      return jsonError("SSO token expired", 401);
    }
    const payload = buildSsoPayload(body.email, body.organizationId, body.expiresAt);
    if (!verifySsoSignature(payload, body.signature)) {
      return jsonError("Invalid SSO signature", 401);
    }

    const { token, user } = await executeSatelliteSsoExchange(body, prisma);

    const res = jsonOk({ user, token });
    res.cookies.set(authCookieName(), token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 4,
    });
    return res;
  } catch (err) {
    return handleRouteError(err);
  }
}
`;

const loginRoute = `import { NextResponse } from "next/server";
import { authCookieName, signSatelliteSession } from "@era/satellite-kit";
import { jsonError, jsonOk, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({ login: z.string().min(1), password: z.string().min(1) });

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const user = await prisma.user.findUnique({
      where: { login: body.login },
      include: { role: true },
    });
    if (!user || user.passwordHash === "sso:no-password") {
      return jsonError("Invalid credentials", 401);
    }
    const token = await signSatelliteSession({
      sub: user.id,
      login: user.login,
      role: user.role.code,
      fullName: user.fullName,
    });
    const res = jsonOk({
      user: { id: user.id, login: user.login, fullName: user.fullName, role: user.role.code },
      token,
    });
    res.cookies.set(authCookieName(), token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 4,
    });
    return res;
  } catch (err) {
    return handleRouteError(err);
  }
}
`;

const middlewareTs = `import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  authCookieName,
  getBearerOrCookieToken,
  isPublicApiPath,
  verifySatelliteSession,
} from "@era/satellite-kit";

const COOKIE = authCookieName();

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api")) {
    if (isPublicApiPath(pathname)) return NextResponse.next();
    const token = getBearerOrCookieToken(request.cookies, request.headers, COOKIE);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    try {
      const session = await verifySatelliteSession(token);
      const headers = new Headers(request.headers);
      headers.set("x-user-id", session.sub);
      headers.set("x-user-role", session.role);
      return NextResponse.next({ request: { headers } });
    } catch {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }
  }

  if (pathname === "/login" || pathname === "/sso/callback") return NextResponse.next();
  const token = getBearerOrCookieToken(request, COOKIE);
  if (!token) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  try {
    await verifySatelliteSession(token);
    return NextResponse.next();
  } catch {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
`;

const loginPage = `"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login, password }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Login failed");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-6">
      <h1 className="mb-4 text-2xl font-semibold text-[#34495E]">ERA Satellite</h1>
      <form onSubmit={onSubmit} className="space-y-3 rounded-2xl border border-[#D5DADF] bg-white p-6">
        <input
          className="h-9 w-full rounded-lg border border-[#D5DADF] px-3"
          placeholder="Login"
          value={login}
          onChange={(e) => setLogin(e.target.value)}
        />
        <input
          type="password"
          className="h-9 w-full rounded-lg border border-[#D5DADF] px-3"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button
          type="submit"
          className="h-9 w-full rounded-lg bg-[#2980B9] text-sm font-medium text-white"
        >
          Sign in
        </button>
      </form>
      <p className="mt-4 text-center text-xs text-[#7F8C8D]">
        Or use SSO from ERA Finance / Orchestrator
      </p>
    </main>
  );
}
`;

const eventDispatch = `import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { isSatelliteEvent } from "@era/contracts";
import { publishToOrchestratorGateway, satelliteOrganizationId } from "@era/satellite-kit";

export async function POST(req: Request) {
  const body = (await req.json()) as Record<string, unknown>;
  const event = {
    ...body,
    organizationId:
      typeof body.organizationId === "string"
        ? body.organizationId
        : satelliteOrganizationId(),
    correlationId:
      typeof body.correlationId === "string" ? body.correlationId : randomUUID(),
    occurredAt:
      typeof body.occurredAt === "string"
        ? body.occurredAt
        : new Date().toISOString(),
  };
  if (!isSatelliteEvent(event)) {
    return NextResponse.json(
      { ok: false, error: "Unknown or invalid satellite event type" },
      { status: 400 },
    );
  }
  const result = await publishToOrchestratorGateway(event as Record<string, unknown>);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  }
  return NextResponse.json({ ok: true, event });
}
`;

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, "utf8");
}

for (const app of apps) {
  const base = path.join(root, app);
  const schemaPath = path.join(base, "prisma", "schema.prisma");
  let schema = fs.readFileSync(schemaPath, "utf8");
  if (!schema.includes("model User")) {
    schema = schema.trimEnd() + "\n" + authModels;
    fs.writeFileSync(schemaPath, schema, "utf8");
  }

  write(path.join(base, "src/lib/api-utils.ts"), apiUtils);
  write(path.join(base, "app/api/auth/sso/exchange/route.ts"), ssoRoute);
  write(path.join(base, "app/api/auth/login/route.ts"), loginRoute);
  write(path.join(base, "middleware.ts"), middlewareTs);
  write(path.join(base, "app/login/page.tsx"), loginPage);
  write(
    path.join(base, "app/sso/callback/page.tsx"),
    `"use client";

import { Suspense } from "react";
import { SsoCallbackPage } from "@era/satellite-kit/ui";

export default function Page() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-[#7F8C8D]">Signing you in…</p>}>
      <SsoCallbackPage />
    </Suspense>
  );
}
`,
  );
  write(path.join(base, "app/api/events/dispatch/route.ts"), eventDispatch);

  const pkgPath = path.join(base, "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  pkg.dependencies ??= {};
  pkg.dependencies.jose = "^6.0.11";
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf8");

  const envPath = path.join(base, ".env.example");
  let env = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
  for (const line of [
    "AUTH_JWT_SECRET=change-me-min-16-chars",
    "ERA_SSO_SHARED_SECRET=dev-sso-shared-secret",
    "ORCHESTRATOR_URL=http://localhost:4100",
    "SATELLITE_EVENT_SERVICE_TOKEN=dev-satellite-event-token",
    "ERA_SATELLITE_ORGANIZATION_ID=demo-org",
  ]) {
    const key = line.split("=")[0];
    if (!env.includes(key + "=")) env += (env.endsWith("\n") || !env ? "" : "\n") + line + "\n";
  }
  fs.writeFileSync(envPath, env, "utf8");

  console.log("Applied integration:", app);
}

console.log("Done.");

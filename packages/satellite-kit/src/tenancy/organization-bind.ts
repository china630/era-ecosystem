import { z } from "zod";
import { NextResponse } from "next/server";
import { assertEnvServiceToken } from "../auth/assert-service-token";
import {
  applyOrganizationBind,
  hydrateOrganizationBindFromDb,
  resolveSatelliteOrganizationId,
  type OrgBindPrisma,
} from "./organization-bind-core";
import { satelliteRuntimeConfig } from "./runtime-config-core";
import type { KitHeaderSource } from "../http/kit-call";

export type KitHttpResult = {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
};

export function kitJson(body: unknown, status = 200, headers?: Record<string, string>): KitHttpResult {
  return { status, body, headers };
}

export function kitResultToNext(result: KitHttpResult) {
  return NextResponse.json(result.body, { status: result.status, headers: result.headers });
}

const bindBodySchema = z.object({
  organizationId: z.string().uuid(),
  boundBy: z.string().max(200).optional(),
});

export type OrganizationBindHandlerOptions = {
  getPrisma?: () => OrgBindPrisma | null | undefined;
};

/**
 * Next.js App Router handlers for POST/GET organization bind.
 */
export function createOrganizationBindHandlers(
  opts: OrganizationBindHandlerOptions = {},
) {
  async function authorize(headers: KitHeaderSource) {
    return assertEnvServiceToken({
      expectedEnvKeys: [
        "SATELLITE_EVENT_SERVICE_TOKEN",
        "CLINIC_INTERNAL_SERVICE_TOKEN",
        "CONTROL_PLANE_SERVICE_TOKEN",
      ],
      authorization: headers.get("authorization"),
      xServiceToken: headers.get("x-service-token"),
    });
  }

  async function readFrom(headers: KitHeaderSource): Promise<KitHttpResult> {
    const auth = await authorize(headers);
    if (!auth.ok) return kitJson({ error: auth.error }, auth.status);
    if (satelliteRuntimeConfig().deploymentTopology === "SHARED") {
      return kitJson({ ok: true, organizationId: "", source: "shared" as const });
    }
    const prisma = opts.getPrisma?.() ?? null;
    if (prisma) await hydrateOrganizationBindFromDb(prisma);
    const resolved = resolveSatelliteOrganizationId({ allowFallback: true });
    return kitJson({
      ok: true,
      organizationId: resolved.organizationId,
      source: resolved.source,
    });
  }

  async function read(request: Request): Promise<KitHttpResult> {
    return readFrom(request.headers);
  }

  async function writeFrom(headers: KitHeaderSource, rawBody: unknown): Promise<KitHttpResult> {
    const auth = await authorize(headers);
    if (!auth.ok) return kitJson({ error: auth.error }, auth.status);
    let body: z.infer<typeof bindBodySchema>;
    try {
      body = bindBodySchema.parse(rawBody);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid body";
      return kitJson({ error: message }, 400);
    }
    if (satelliteRuntimeConfig().deploymentTopology === "SHARED") {
      return kitJson({
        ok: true,
        organizationId: body.organizationId,
        source: "request" as const,
      });
    }
    const prisma = opts.getPrisma?.() ?? null;
    await applyOrganizationBind({
      organizationId: body.organizationId,
      boundBy: body.boundBy,
      prisma,
    });
    return kitJson({
      ok: true,
      organizationId: body.organizationId,
      source: "runtime" as const,
    });
  }

  async function write(request: Request): Promise<KitHttpResult> {
    let raw: unknown;
    try {
      raw = await request.json();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid body";
      return kitJson({ error: message }, 400);
    }
    return writeFrom(request.headers, raw);
  }

  async function GET(request: Request) {
    return kitResultToNext(await read(request));
  }

  async function POST(request: Request) {
    return kitResultToNext(await write(request));
  }

  return { GET, POST, read, write, readFrom, writeFrom };
}

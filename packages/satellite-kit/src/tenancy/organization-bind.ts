import { z } from "zod";
import { NextResponse } from "next/server";
import { assertEnvServiceToken } from "../auth/assert-service-token";
import {
  applyOrganizationBind,
  hydrateOrganizationBindFromDb,
  resolveSatelliteOrganizationId,
  type OrgBindPrisma,
} from "./organization-bind-core";

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
  async function authorize(request: Request) {
    return assertEnvServiceToken({
      expectedEnvKeys: [
        "SATELLITE_EVENT_SERVICE_TOKEN",
        "CLINIC_INTERNAL_SERVICE_TOKEN",
      ],
      authorization: request.headers.get("authorization"),
      xServiceToken: request.headers.get("x-service-token"),
    });
  }

  async function GET(request: Request) {
    const auth = await authorize(request);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const prisma = opts.getPrisma?.() ?? null;
    if (prisma) {
      await hydrateOrganizationBindFromDb(prisma);
    }
    // Diagnostics must not throw when unbound (GET shows fallback/demo in non-prod).
    const resolved = resolveSatelliteOrganizationId({ allowFallback: true });
    return NextResponse.json({
      ok: true,
      organizationId: resolved.organizationId,
      source: resolved.source,
    });
  }

  async function POST(request: Request) {
    const auth = await authorize(request);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    let body: z.infer<typeof bindBodySchema>;
    try {
      body = bindBodySchema.parse(await request.json());
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid body";
      return NextResponse.json({ error: message }, { status: 400 });
    }
    const prisma = opts.getPrisma?.() ?? null;
    await applyOrganizationBind({
      organizationId: body.organizationId,
      boundBy: body.boundBy,
      prisma,
    });
    return NextResponse.json({
      ok: true,
      organizationId: body.organizationId,
      source: "runtime" as const,
    });
  }

  return { GET, POST };
}

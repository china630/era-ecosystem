import { z } from "zod";
import { NextResponse } from "next/server";
import { assertEnvServiceToken } from "../auth/assert-service-token";
import {
  applySatelliteRuntimeConfig,
  hydrateRuntimeConfigFromDb,
  publicRuntimeConfigView,
  satelliteRuntimeConfig,
  type SatelliteRuntimeConfig,
} from "./runtime-config-core";
import { applyOrganizationBind, type OrgBindPrisma } from "./organization-bind-core";

const runtimeBodySchema = z.object({
  organizationId: z.string().uuid().optional(),
  orchestratorEventUrl: z.string().url().optional(),
  publicBaseUrl: z.string().url().optional(),
  platformSuperAdminEmails: z.array(z.string().email()).max(50).optional(),
  ssoSharedSecret: z.string().min(16).max(512).optional(),
  satelliteEventServiceToken: z.string().min(8).max(512).optional(),
  activeModules: z.array(z.string().min(1).max(120)).max(500).optional(),
  hotelModules: z.record(z.boolean()).optional(),
  deploymentTopology: z.enum(["SHARED", "DEDICATED", "ONPREM"]).optional(),
  edition: z.string().min(1).max(120).optional(),
  updatedBy: z.string().max(200).optional(),
});

export type RuntimeConfigHandlerOptions = {
  getPrisma?: () => OrgBindPrisma | null | undefined;
};

export function createRuntimeConfigHandlers(opts: RuntimeConfigHandlerOptions = {}) {
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
      await hydrateRuntimeConfigFromDb(prisma);
    }
    return NextResponse.json({
      ok: true,
      config: publicRuntimeConfigView(satelliteRuntimeConfig()),
    });
  }

  async function POST(request: Request) {
    const auth = await authorize(request);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    let body: z.infer<typeof runtimeBodySchema>;
    try {
      body = runtimeBodySchema.parse(await request.json());
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid body";
      return NextResponse.json({ error: message }, { status: 400 });
    }
    const prisma = opts.getPrisma?.() ?? null;
    const patch: SatelliteRuntimeConfig = {
      organizationId: body.organizationId,
      orchestratorEventUrl: body.orchestratorEventUrl,
      publicBaseUrl: body.publicBaseUrl,
      platformSuperAdminEmails: body.platformSuperAdminEmails,
      ssoSharedSecret: body.ssoSharedSecret,
      satelliteEventServiceToken: body.satelliteEventServiceToken,
      activeModules: body.activeModules,
      hotelModules: body.hotelModules,
      deploymentTopology: body.deploymentTopology,
      edition: body.edition,
    };
    if (body.organizationId) {
      await applyOrganizationBind({
        organizationId: body.organizationId,
        boundBy: body.updatedBy ?? "runtime-config",
        prisma,
      });
    }
    const cfg = await applySatelliteRuntimeConfig({
      config: patch,
      updatedBy: body.updatedBy,
      prisma,
    });
    return NextResponse.json({
      ok: true,
      config: publicRuntimeConfigView(cfg),
    });
  }

  return { GET, POST };
}

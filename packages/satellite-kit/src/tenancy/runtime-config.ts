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

const elektrawebBridgeSchema = z.object({
  inboundEnabled: z.boolean(),
  writeEnabled: z.boolean(),
  elektrawebHotelId: z.number().int().positive().nullable().optional(),
  spaDepId: z.number().int().positive().nullable().optional(),
  spaCurrencyId: z.number().int().positive().nullable().optional(),
  walkinResId: z.string().max(64).nullable().optional(),
  walkinResNameId: z.string().max(64).nullable().optional(),
});

const clinicCutoverSchema = z.object({
  elektrawebDualRun: z.boolean(),
  hotelOrganizationId: z.string().uuid().nullable().optional(),
});

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
  /** Per-org Elektraweb dual-run policy — upserted by satellite handler, not process-wide memory. */
  elektrawebBridge: elektrawebBridgeSchema.optional(),
  /** Per-org clinic cutover — upserted by clinic satellite handler. */
  clinicCutover: clinicCutoverSchema.optional(),
});

export type ElektrawebBridgeSyncPayload = z.infer<typeof elektrawebBridgeSchema>;
export type ClinicCutoverSyncPayload = z.infer<typeof clinicCutoverSchema>;
export type RuntimeConfigBody = z.infer<typeof runtimeBodySchema>;

export type RuntimeConfigHandlerOptions = {
  getPrisma?: () => OrgBindPrisma | null | undefined;
  /** Hotel: upsert ElektrawebBridgePolicy for body.organizationId. */
  onElektrawebBridge?: (
    organizationId: string,
    policy: ElektrawebBridgeSyncPayload,
  ) => Promise<void>;
  /** Clinic: upsert ClinicCutoverPolicy for body.organizationId. */
  onClinicCutover?: (
    organizationId: string,
    policy: ClinicCutoverSyncPayload,
  ) => Promise<void>;
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
    const topology =
      body.deploymentTopology ?? satelliteRuntimeConfig().deploymentTopology;
    const isShared = topology === "SHARED";
    const patch: SatelliteRuntimeConfig = {
      // SHARED: do not stamp process-wide blob with last Sync org id.
      organizationId: isShared ? undefined : body.organizationId,
      orchestratorEventUrl: body.orchestratorEventUrl,
      publicBaseUrl: body.publicBaseUrl,
      platformSuperAdminEmails: body.platformSuperAdminEmails,
      ssoSharedSecret: body.ssoSharedSecret,
      satelliteEventServiceToken: body.satelliteEventServiceToken,
      activeModules: body.activeModules,
      hotelModules: body.hotelModules,
      deploymentTopology: body.deploymentTopology,
      edition: isShared ? undefined : body.edition,
    };
    if (body.organizationId && !isShared) {
      await applyOrganizationBind({
        organizationId: body.organizationId,
        boundBy: body.updatedBy ?? "runtime-config",
        prisma,
      });
    }
    // SHARED: skip process bind — per-org vendor/cutover policies still upsert below.
    if (body.organizationId && body.elektrawebBridge && opts.onElektrawebBridge) {
      await opts.onElektrawebBridge(body.organizationId, body.elektrawebBridge);
    }
    if (body.organizationId && body.clinicCutover && opts.onClinicCutover) {
      await opts.onClinicCutover(body.organizationId, body.clinicCutover);
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
